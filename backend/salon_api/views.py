# salon_api/views.py
from django.contrib.auth.models import User, Group, Permission
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
    Location, Staff, Service, Customer, Appointment, StaffCommission, 
    StaffShift, StaffService, StaffException, BusinessException, Referral,
    Expense
)
from .serializers import (
    GroupSerializer, LocationSerializer, PermissionSerializer, StaffCommissionSerializer, StaffSerializer, ServiceSerializer,
    CustomerSerializer, AppointmentSerializer, StaffShiftSerializer, 
    StaffServiceSerializer, StaffExceptionSerializer, BusinessExceptionSerializer, ReferralSerializer,
    ExpenseSerializer, UserSerializer
)
from django.db.models import Count, Q, F, Sum
from django.utils import timezone
from rest_framework.views import APIView
from datetime import datetime, date, timedelta 
from django.db import transaction 

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_superuser=False).order_by('username')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password')
        if not password:
            return Response({'error': 'A senha é obrigatória.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save()
        return Response({'status': 'senha definida com sucesso'})

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all().order_by('name')
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all().order_by('name')
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Retorna os dados do usuário logado."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        """Atualiza os dados do usuário logado."""
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [permissions.AllowAny]


class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        show_inactive = self.request.query_params.get('show_inactive', 'false')
        if show_inactive.lower() != 'true':
            queryset = queryset.filter(active=True)
        return queryset.order_by('name')
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.active = False
        instance.save()
        return Response({"message": f"Staff '{instance.name}' desativado com sucesso"}, status=status.HTTP_200_OK)


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Customer.objects.annotate(
            visits= F('previous_visits') + Count('appointment', filter=Q(appointment__status='completed'))
        ).order_by('-created_at')
        return queryset

    @action(detail=True, methods=['post'], url_path='redeem-points')
    def redeem_points(self, request, pk=None):
        customer = self.get_object()
        points_to_redeem = request.data.get('points_to_redeem')
        if points_to_redeem is None or not isinstance(points_to_redeem, int) or points_to_redeem <= 0:
            return Response({"error": "Forneça uma quantidade de pontos válida para resgatar."}, status=status.HTTP_400_BAD_REQUEST)
        current_points = customer.points or 0
        if current_points < points_to_redeem:
            return Response({"error": f"Pontos insuficientes. Saldo atual: {current_points}."}, status=status.HTTP_400_BAD_REQUEST)
        customer.points -= points_to_redeem
        customer.save()
        serializer = self.get_serializer(customer)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    @action(detail=True, methods=['post'], url_path='adjust-points')
    def adjust_points(self, request, pk=None):
        customer = self.get_object()
        points_to_adjust = request.data.get('points_to_adjust')
        if points_to_adjust is None or not isinstance(points_to_adjust, int):
            return Response({"error": "Forneça um valor de 'points_to_adjust' válido."}, status=status.HTTP_400_BAD_REQUEST)
        new_balance = (customer.points or 0) + points_to_adjust
        if new_balance < 0:
            return Response({"error": "Ajuste inválido. O saldo de pontos não pode ser negativo."}, status=status.HTTP_400_BAD_REQUEST)
        customer.points = new_balance
        customer.save()
        serializer = self.get_serializer(customer)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        # --- 1. Customer Lookup/Creation ---
        customer_id = data.get('customer')
        customer_name = data.pop('customer_name', None)
        customer_phone = data.pop('customer_phone', None)
        customer_email = data.pop('customer_email', None)

        if not customer_id and customer_name and customer_phone:
            # Tenta encontrar o cliente pelo WhatsApp (campo 'whatsapp' no modelo Customer)
            try:
                customer = Customer.objects.get(whatsapp=customer_phone) 
            except Customer.DoesNotExist:
                # Se não encontrar, cria um novo cliente
                customer = Customer.objects.create(
                    full_name=customer_name,
                    whatsapp=customer_phone, 
                    email=customer_email,
                    is_truly_new=True 
                )
            data['customer'] = customer.id 
        
        if not data.get('customer'):
            return Response({"error": "ID do cliente ou dados de contato (nome e telefone) são obrigatórios."}, status=status.HTTP_400_BAD_REQUEST)
        
        # --- 2. Multi-Appointment Handling & Sequencing ---
        
        # 💡 NOVO: Extrai o array de serviços (campo 'services' do Serializer)
        service_ids = data.pop('services', [data.get('service')])
        
        if not service_ids or (len(service_ids) == 1 and not service_ids[0]):
             return Response({"error": "Nenhum serviço fornecido para agendamento."}, status=status.HTTP_400_BAD_REQUEST)

        # 2a. Busca os objetos Service e ordena pelo ID (garante sequência estável)
        services_to_book = Service.objects.filter(id__in=service_ids).order_by('pk')
        
        # Garantia de dados obrigatórios
        required_fields = ['staff', 'location', 'start_time']
        for field in required_fields:
            if not data.get(field):
                 return Response({"error": f"O campo '{field}' é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        # Se a localização não foi definida (fallback para agendamento online)
        if not data.get('location'):
            staff_id = data.get('staff')
            staff_shift = StaffShift.objects.filter(staff_id=staff_id).first()
            if staff_shift:
                data['location'] = staff_shift.location_id
            else:
                first_location = Location.objects.all().first()
                if first_location:
                    data['location'] = first_location.id
                else:
                    return Response({"error": "Não foi possível determinar a localização do agendamento."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Converte a string ISO para objeto datetime (tratando o offset se necessário)
            current_start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        except ValueError:
             return Response({"error": "Formato de start_time inválido."}, status=status.HTTP_400_BAD_REQUEST)

        created_appointments = []
        
        # Remove campos que serão redefinidos
        data.pop('service', None) 
        data.pop('end_time', None)

        # 2b. Itera sobre os serviços e calcula o sequenciamento
        for service_obj in services_to_book:
            duration_minutes = service_obj.default_duration_min or 30
            current_end_time = current_start_time + timedelta(minutes=duration_minutes)
            
            # Prepara os dados para o agendamento individual
            appointment_data = data.copy()
            appointment_data['service'] = service_obj.id # ID do Serviço atual
            appointment_data['start_time'] = current_start_time.isoformat()
            appointment_data['end_time'] = current_end_time.isoformat()
            
            # 2c. Valida e Cria
            serializer = self.get_serializer(data=appointment_data)
            serializer.is_valid(raise_exception=True)
            
            # Cria o objeto no banco de dados
            created_appointments.append(serializer.save())
            
            # 2d. Atualiza o start_time para o PRÓXIMO agendamento
            current_start_time = current_end_time 

        # Retorna o primeiro agendamento criado (como representação da requisição)
        if created_appointments:
             return Response(self.get_serializer(created_appointments[0]).data, status=status.HTTP_201_CREATED)
        else:
             return Response({"error": "Erro desconhecido na criação dos agendamentos."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        was_completed = instance.status == 'completed'
        
        response = super().update(request, *args, **kwargs)

        if response.status_code == 200 and request.data.get('status') == 'completed' and not was_completed:
            instance.refresh_from_db()
            
            customer = instance.customer
            service = instance.service
            staff = instance.staff

            try:
                referral = Referral.objects.get(referred_customer=customer, status='pending')
                referral.status = 'completed'
                referral.save()
            except Referral.DoesNotExist:
                pass

            if service and service.price_centavos and service.price_centavos > 0:
                points_earned = int(instance.final_amount_centavos / 100)
                customer.points = (customer.points or 0) + points_earned
                customer.save()

            if staff and service and instance.final_amount_centavos is not None:
                commission_percentage = staff.default_commission_percentage or 0
                commission_amount = (instance.final_amount_centavos * commission_percentage) / 100

                StaffCommission.objects.update_or_create(
                    appointment=instance,
                    defaults={
                        'staff': staff,
                        'service': service,
                        'date': instance.start_time.date(),
                        'service_price_centavos': service.price_centavos,
                        'commission_percentage': commission_percentage,
                        'commission_amount_centavos': commission_amount,
                        'status': 'pendente_pagamento',
                    }
                )
        return response


class StaffShiftViewSet(viewsets.ModelViewSet):
    serializer_class = StaffShiftSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        queryset = StaffShift.objects.select_related('staff', 'location').all()
        staff_id = self.request.query_params.get('staff_id', None)
        if staff_id: queryset = queryset.filter(staff_id=staff_id)
        return queryset


class StaffServiceViewSet(viewsets.ModelViewSet):
    queryset = StaffService.objects.all()
    serializer_class = StaffServiceSerializer
    permission_classes = [permissions.AllowAny]
    def create(self, request, *args, **kwargs):
        staff_id = request.data.get("staff") or request.data.get("staff_id")
        service_id = request.data.get("service") or request.data.get("service_id")
        if not staff_id or not service_id: return Response({"error": "Campos 'staff' e 'service' são obrigatórios."}, status=status.HTTP_400_BAD_REQUEST)
        if StaffService.objects.filter(staff_id=staff_id, service_id=service_id).exists(): return Response({"detail": "Este vínculo já existe."}, status=status.HTTP_200_OK)
        serializer = self.get_serializer(data={"staff": staff_id, "service": service_id})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    @action(detail=False, methods=['delete'], url_path='delete-by-params')
    def delete_by_params(self, request):
        staff_id = request.query_params.get('staff_id')
        service_id = request.query_params.get('service_id')
        if not staff_id or not service_id: return Response({"error": "Parâmetros 'staff_id' e 'service_id' são obrigatórios."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            instance = StaffService.objects.get(staff_id=staff_id, service_id=service_id)
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except StaffService.DoesNotExist:
            return Response({"error": "Relação não encontrada."}, status=status.HTTP_404_NOT_FOUND)


class StaffExceptionViewSet(viewsets.ModelViewSet):
    serializer_class = StaffExceptionSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        queryset = StaffException.objects.select_related('staff').all()
        staff_id = self.request.query_params.get('staff_id', None)
        if staff_id: queryset = queryset.filter(staff_id=staff_id)
        return queryset.order_by('-start_date')
    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class StaffCommissionViewSet(viewsets.ModelViewSet):
    queryset = StaffCommission.objects.all()
    serializer_class = StaffCommissionSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        queryset = StaffCommission.objects.select_related('staff', 'service', 'appointment').all()
        staff_id = self.request.query_params.get('staff_id', None)
        if staff_id: queryset = queryset.filter(staff_id=staff_id)
        return queryset.order_by('-date')

class ReferralViewSet(viewsets.ModelViewSet):
    queryset = Referral.objects.select_related('referrer_customer', 'referred_customer').all()
    serializer_class = ReferralSerializer
    permission_classes = [permissions.AllowAny]
    @action(detail=True, methods=['post'], url_path='apply-reward')
    def apply_reward(self, request, pk=None):
        try:
            instance = self.get_object()
            if instance.status != 'completed': return Response({"error": "Esta recompensa não está disponível para uso."}, status=status.HTTP_400_BAD_REQUEST)
            instance.status = 'reward_used'
            instance.reward_applied_at = timezone.now()
            return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)
        except Referral.DoesNotExist:
            return Response({"error": "Indicação não encontrada."}, status=status.HTTP_404_NOT_FOUND)

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.AllowAny]

# --- VIEWS DE RELATÓRIOS ---

class RevenueByStaffReport(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        today = date.today()
        start_date_str = request.query_params.get('start_date', today.replace(day=1).isoformat())
        end_date_str = request.query_params.get('end_date', today.isoformat())
        try:
            start_date = datetime.fromisoformat(start_date_str).date()
            end_date = datetime.fromisoformat(end_date_str).date()
        except ValueError:
            return Response({"error": "Formato de data inválido. Use AAAA-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        revenue_data = Appointment.objects.filter(
            status='completed',
            start_time__date__gte=start_date,
            start_time__date__lte=end_date
        ).values(
            'staff__name'
        ).annotate(
            total_revenue=Sum('final_amount_centavos'),
            appointments=Count('id')
        ).order_by('-total_revenue')

        report = [{
                "name": item['staff__name'],
                "value": item['total_revenue'],
                "appointments": item['appointments']
            } for item in revenue_data if item['staff__name'] is not None]
        return Response(report)

# ✅ ADICIONADO
class RevenueByLocationReport(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        today = date.today()
        start_date_str = request.query_params.get('start_date', today.replace(day=1).isoformat())
        end_date_str = request.query_params.get('end_date', today.isoformat())
        try:
            start_date = datetime.fromisoformat(start_date_str).date()
            end_date = datetime.fromisoformat(end_date_str).date()
        except ValueError:
            return Response({"error": "Formato de data inválido. Use AAAA-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        revenue_data = Appointment.objects.filter(
            status='completed',
            start_time__date__gte=start_date,
            start_time__date__lte=end_date
        ).values(
            'location__name'
        ).annotate(
            total_revenue=Sum('final_amount_centavos')
        ).order_by('-total_revenue')

        report = [{
                "name": item['location__name'],
                "value": item['total_revenue']
            } for item in revenue_data if item['location__name'] is not None]
        return Response(report)
    
class RevenueByServiceReport(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        today = date.today()
        start_date_str = request.query_params.get('start_date', today.replace(day=1).isoformat())
        end_date_str = request.query_params.get('end_date', today.isoformat())

        try:
            start_date = datetime.fromisoformat(start_date_str).date()
            end_date = datetime.fromisoformat(end_date_str).date()
        except ValueError:
            return Response({"error": "Formato de data inválido. Use AAAA-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        revenue_data = Appointment.objects.filter(
            status='completed',
            start_time__date__gte=start_date,
            start_time__date__lte=end_date
        ).values(
            'service__name',
            'service__category'
        ).annotate(
            total_revenue=Sum('final_amount_centavos'),
            count=Count('id')
        ).order_by('-total_revenue')

        report = [
            {
                "name": item['service__name'],
                "category": item['service__category'] or 'Sem Categoria',
                "value": item['total_revenue'],
                "count": item['count']
            }
            for item in revenue_data if item['service__name'] is not None
        ]

        return Response(report)