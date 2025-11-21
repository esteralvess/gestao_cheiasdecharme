# salon_api/views.py (VERSÃO COM DEBUG)
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
import requests 
import json
import pytz

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
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
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
    authentication_classes = [] 

class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] 
    
    def get_queryset(self):
        queryset = super().get_queryset()
        show_inactive = self.request.query_params.get('show_inactive', 'false')
        if show_inactive.lower() != 'true':
            queryset = queryset.filter(active=True)
        return queryset.order_by('name')
    
    def destroy(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
             return Response(status=status.HTTP_401_UNAUTHORIZED)
        instance = self.get_object()
        instance.active = False
        instance.save()
        return Response({"message": f"Staff '{instance.name}' desativado com sucesso"}, status=status.HTTP_200_OK)

class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] 

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] 

    def get_queryset(self):
        return Customer.objects.annotate(
            visits= F('previous_visits') + Count('appointment', filter=Q(appointment__status='completed'))
        ).order_by('-created_at')
    
    @action(detail=False, methods=['get'], url_path='check-phone')
    def check_phone(self, request):
        phone = request.query_params.get('phone')
        if not phone:
             return Response({"error": "Telefone é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            customer = Customer.objects.get(whatsapp=phone)
            return Response({
                "exists": True,
                "id": customer.id,
                "name": customer.full_name,
                "email": customer.email
            })
        except Customer.DoesNotExist:
            return Response({"exists": False})

    @action(detail=True, methods=['post'], url_path='redeem-points')
    def redeem_points(self, request, pk=None):
        customer = self.get_object()
        points_to_redeem = request.data.get('points_to_redeem')
        if not points_to_redeem or points_to_redeem <= 0:
            return Response({"error": "Pontos inválidos."}, status=400)
        if customer.points < points_to_redeem:
            return Response({"error": "Pontos insuficientes."}, status=400)
        customer.points -= points_to_redeem
        customer.save()
        return Response(self.get_serializer(customer).data)
        
    @action(detail=True, methods=['post'], url_path='adjust-points')
    def adjust_points(self, request, pk=None):
        customer = self.get_object()
        points = request.data.get('points_to_adjust')
        if points is None: return Response({"error": "Valor inválido."}, status=400)
        customer.points = (customer.points or 0) + points
        customer.save()
        return Response(self.get_serializer(customer).data)


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] 

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        # 1. Customer
        customer_id = data.get('customer')
        customer_name = data.pop('customer_name', None)
        customer_phone = data.pop('customer_phone', None)
        customer_email = data.pop('customer_email', None)
        if customer_email == "": customer_email = None

        if not customer_id and customer_name and customer_phone:
            try:
                customer = Customer.objects.get(whatsapp=customer_phone) 
            except Customer.DoesNotExist:
                customer = Customer.objects.create(
                    full_name=customer_name,
                    whatsapp=customer_phone, 
                    email=customer_email,
                    is_truly_new=True 
                )
            data['customer'] = customer.id 
        
        if not data.get('customer'):
            return Response({"error": "Dados do cliente obrigatórios."}, status=400)
        
        # 2. Preparação dos Itens
        items = data.pop('items', [])
        if not items and data.get('service') and data.get('staff'):
            items = [{'service': data.get('service'), 'staff': data.get('staff')}]
        if not items:
             return Response({"error": "Nenhum serviço selecionado."}, status=400)

        # 3. Validação de Location
        if not data.get('location'):
            staff_id = items[0].get('staff')
            if staff_id:
                staff_shift = StaffShift.objects.filter(staff_id=staff_id).first()
                if staff_shift: data['location'] = staff_shift.location_id
            if not data.get('location'):
                first_location = Location.objects.all().first()
                if first_location: data['location'] = first_location.id
                else: return Response({"error": "Localização obrigatória."}, status=400)
        
        # 🔥 DEBUG + CORREÇÃO
        try:
            start_time_str = data['start_time']
            print(f"🔍 RECEBIDO DO FRONTEND: {start_time_str}")
            
            # Remove o 'Z' se existir
            if start_time_str.endswith('Z'):
                start_time_str = start_time_str[:-1]
                print(f"🔍 APÓS REMOVER Z: {start_time_str}")
            
            # Parse como datetime naive
            naive_dt = datetime.fromisoformat(start_time_str)
            print(f"🔍 DATETIME NAIVE (sem TZ): {naive_dt}")
            
            # Marca como horário de São Paulo
            sao_paulo_tz = pytz.timezone('America/Sao_Paulo')
            current_start_time = sao_paulo_tz.localize(naive_dt)
            print(f"🔍 COM TIMEZONE SP: {current_start_time}")
            print(f"🔍 ISO STRING: {current_start_time.isoformat()}")
            
        except (ValueError, TypeError) as e:
             print(f"❌ ERRO NO PARSING: {e}")
             return Response({"error": f"Start time inválido: {e}"}, status=400)

        created_appointments = []
        n8n_services_list = []
        total_value_centavos = 0
        
        data.pop('service', None)
        data.pop('staff', None)
        data.pop('end_time', None)

        # 4. Loop SEQUENCIAL
        for i, item in enumerate(items):
            service_id = item.get('service')
            staff_id = item.get('staff')
            
            try:
                service_obj = Service.objects.get(pk=service_id)
                staff_obj = Staff.objects.get(pk=staff_id)
            except: return Response({"error": "Dados inválidos."}, status=400)

            if not StaffService.objects.filter(staff_id=staff_id, service_id=service_id).exists():
                 return Response({"error": f"{staff_obj.name} não realiza {service_obj.name}."}, status=400)

            duration = service_obj.default_duration_min or 30
            appt_end_time = current_start_time + timedelta(minutes=duration)

            total_value_centavos += (service_obj.price_centavos or 0)
            n8n_services_list.append(f"{i+1}. {service_obj.name} com {staff_obj.name}")

            now = timezone.localtime(timezone.now())
            auto_note = f"Pré-agendamento via Site em {now.strftime('%d/%m/%Y às %H:%M')}."
            existing_notes = data.get('notes', '')
            final_notes = f"{existing_notes}\n{auto_note}" if existing_notes else auto_note

            appt_data = data.copy()
            appt_data['service'] = service_id
            appt_data['staff'] = staff_id
            appt_data['start_time'] = current_start_time.isoformat()
            appt_data['end_time'] = appt_end_time.isoformat()
            appt_data['status'] = 'pending' 
            appt_data['notes'] = final_notes
            
            print(f"🔍 SALVANDO NO BANCO: start_time={appt_data['start_time']}")
            
            serializer = self.get_serializer(data=appt_data)
            serializer.is_valid(raise_exception=True)
            appointment = serializer.save()
            created_appointments.append(appointment)
            
            print(f"🔍 SALVO NO BANCO: {appointment.start_time}")
            print(f"🔍 LOCALTIME DO SALVO: {timezone.localtime(appointment.start_time)}")
            
            current_start_time = appt_end_time 

        # 5. Disparo N8N
        if created_appointments:
            try:
                total_reais = total_value_centavos / 100
                sinal_reais = total_reais * 0.10
                first_appt = created_appointments[0]
                local_start = timezone.localtime(first_appt.start_time)
                
                n8n_payload = {
                    "customer_name": customer.full_name,
                    "customer_phone": customer.whatsapp,
                    "appointment_date": local_start.strftime("%d/%m/%Y"),
                    "appointment_time": local_start.strftime("%H:%M"),
                    "location": first_appt.location.name,
                    "services": "\n".join(n8n_services_list),
                    "total_value": f"R$ {total_reais:.2f}".replace('.', ','),
                    "signal_value": f"R$ {sinal_reais:.2f}".replace('.', ','),
                }
                requests.post("https://webhooks.gerenc.com/webhook/pre-agendamento", json=n8n_payload, timeout=3)
            except Exception as e:
                print(f"Erro n8n: {e}")

            return Response(self.get_serializer(created_appointments[0]).data, status=status.HTTP_201_CREATED)
        else:
             return Response({"error": "Erro ao criar."}, status=500)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        was_completed = instance.status == 'completed'
        response = super().update(request, *args, **kwargs)
        if response.status_code == 200 and request.data.get('status') == 'completed' and not was_completed:
            instance.refresh_from_db()
            if instance.service.price_centavos > 0:
                instance.customer.points += int(instance.final_amount_centavos / 100)
                instance.customer.save()
            
            if instance.staff and instance.final_amount_centavos:
                 commission_pct = instance.staff.default_commission_percentage or 0
                 commission_val = (instance.final_amount_centavos * commission_pct) / 100
                 StaffCommission.objects.update_or_create(
                    appointment=instance,
                    defaults={
                        'staff': instance.staff,
                        'service': instance.service,
                        'date': instance.start_time.date(),
                        'service_price_centavos': instance.service.price_centavos,
                        'commission_percentage': commission_pct,
                        'commission_amount_centavos': commission_val,
                        'status': 'pendente_pagamento',
                    }
                 )
        return response

class StaffShiftViewSet(viewsets.ModelViewSet):
    serializer_class = StaffShiftSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] 
    def get_queryset(self):
        queryset = StaffShift.objects.select_related('staff', 'location').all()
        staff_id = self.request.query_params.get('staff_id', None)
        if staff_id: queryset = queryset.filter(staff_id=staff_id)
        return queryset

class StaffServiceViewSet(viewsets.ModelViewSet):
    queryset = StaffService.objects.all()
    serializer_class = StaffServiceSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] 
    def create(self, request, *args, **kwargs): return super().create(request, *args, **kwargs)
    @action(detail=False, methods=['delete'], url_path='delete-by-params')
    def delete_by_params(self, request):
        try:
            StaffService.objects.get(staff_id=request.query_params.get('staff_id'), service_id=request.query_params.get('service_id')).delete()
            return Response(status=204)
        except: return Response(status=404)

class StaffExceptionViewSet(viewsets.ModelViewSet):
    serializer_class = StaffExceptionSerializer
    permissions_classes = [permissions.AllowAny] 
    def get_queryset(self): return StaffException.objects.all().order_by('-start_date')

class StaffCommissionViewSet(viewsets.ModelViewSet):
    queryset = StaffCommission.objects.all()
    serializer_class = StaffCommissionSerializer
    permission_classes = [permissions.AllowAny] 

class ReferralViewSet(viewsets.ModelViewSet):
    queryset = Referral.objects.all()
    serializer_class = ReferralSerializer
    permission_classes = [permissions.AllowAny] 
    @action(detail=True, methods=['post'], url_path='apply-reward')
    def apply_reward(self, request, pk=None):
        try:
            instance = self.get_object()
            instance.status = 'reward_used'
            instance.save()
            return Response(self.get_serializer(instance).data)
        except: return Response(status=404)

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.AllowAny] 

class RevenueByStaffReport(APIView):
    permission_classes = [permissions.IsAuthenticated] 
    def get(self, request): return Response([]) 

class RevenueByLocationReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response([]) 

class RevenueByServiceReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response([])