from django.contrib.auth.models import User, Group, Permission
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
    Location, Promotion, Staff, Service, Customer, Appointment, StaffCommission, 
    StaffShift, StaffService, StaffException, BusinessException, Referral,
    Expense
)
from .serializers import (
    GroupSerializer, LocationSerializer, PermissionSerializer, PromotionSerializer, StaffCommissionSerializer, StaffSerializer, ServiceSerializer,
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

# --- VIEWSETS DE ADMINISTRAÇÃO ---

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

# --- VIEWSETS PÚBLICAS ---

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
    queryset = Customer.objects.all() 
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
        
        phone_clean = ''.join(filter(str.isdigit, phone))
        
        try:
            if len(phone_clean) <= 11: 
                 customer = Customer.objects.filter(whatsapp__endswith=phone_clean).first()
            else:
                 customer = Customer.objects.filter(whatsapp=phone_clean).first()
            
            if customer:
                return Response({
                    "exists": True,
                    "id": customer.id,
                    "name": customer.full_name,
                    "email": customer.email
                })
            return Response({"exists": False})
        except Exception:
            return Response({"exists": False})

    @action(detail=True, methods=['post'], url_path='redeem-points')
    def redeem_points(self, request, pk=None):
        if not request.user.is_authenticated: return Response(status=401)
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
        if not request.user.is_authenticated: return Response(status=401)
        customer = self.get_object()
        points = request.data.get('points_to_adjust')
        if points is None: return Response({"error": "Valor inválido."}, status=400)
        customer.points = (customer.points or 0) + points
        customer.save()
        return Response(self.get_serializer(customer).data)


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    
    # 💡 CORREÇÃO: Removemos authentication_classes=[] para que o Django leia o Token do Admin.
    # Usamos get_permissions para diferenciar acesso público de acesso admin.

    def get_permissions(self):
        """
        create/list/retrieve: Público (para o agendamento online)
        update/destroy: Apenas Admin (para o painel de gestão)
        """
        if self.action in ['create', 'list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        # --- LÓGICA DE CLIENTE E INDICAÇÃO ---
        customer_id = data.get('customer')
        customer_name = data.pop('customer_name', None)
        customer_phone = data.pop('customer_phone', None)
        customer_email = data.pop('customer_email', None)
        
        # Novos campos vindos do frontend
        customer_notes = data.pop('customer_notes', None)
        referrer_phone = data.pop('referrer_phone', None)

        if customer_email == "": customer_email = None

        customer = None

        # 1. Busca ou Cria o Cliente
        if customer_id:
            try:
                customer = Customer.objects.get(pk=customer_id)
            except Customer.DoesNotExist:
                pass
        
        if not customer and customer_name and customer_phone:
            try:
                phone_clean = ''.join(filter(str.isdigit, str(customer_phone)))
                # Tenta buscar pelo telefone se o ID não veio
                customer = Customer.objects.filter(whatsapp__endswith=phone_clean[-11:]).first()
                
                if not customer:
                    customer = Customer.objects.create(
                        full_name=customer_name,
                        whatsapp=phone_clean,
                        email=customer_email,
                        is_truly_new=True 
                    )
                
                data['customer'] = customer.id
            except Exception as e:
                return Response({"error": f"Erro ao processar cliente: {str(e)}"}, status=400)

        if not data.get('customer'):
            return Response({"error": "Dados do cliente obrigatórios ou inválidos."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Atualiza Nota do Cliente (Indicado por...)
        if customer and customer_notes:
            # Se já tiver notas, concatena. Se for igual, mantém.
            if not customer.notes:
                customer.notes = customer_notes
                customer.save()
            elif customer_notes not in customer.notes:
                customer.notes = f"{customer.notes}\n{customer_notes}"
                customer.save()

        # 3. Cria o Registro de Indicação (Referral)
        if customer and referrer_phone and customer.is_truly_new:
            try:
                ref_phone_clean = ''.join(filter(str.isdigit, str(referrer_phone)))
                # Busca quem indicou
                referrer = Customer.objects.filter(whatsapp__endswith=ref_phone_clean[-11:]).first()
                
                if referrer and referrer.id != customer.id:
                    # Verifica se já existe indicação para não duplicar
                    if not Referral.objects.filter(referred_customer=customer).exists():
                        Referral.objects.create(
                            referrer_customer=referrer,
                            referred_customer=customer,
                            status='pending'
                        )
            except Exception as e:
                print(f"Erro ao criar referral: {e}") # Não trava o agendamento

        # --- FIM LÓGICA CLIENTE ---

        # 4. Itens (Serviços)
        items = data.pop('items', [])
        # Tratamento para envio simples (sem array)
        if not items and data.get('service') and data.get('staff'):
            items = [{'service': data.get('service'), 'staff': data.get('staff'), 'start_time': data.get('start_time')}]
        
        if not items:
             return Response({"error": "Nenhum serviço selecionado."}, status=status.HTTP_400_BAD_REQUEST)

        # 5. Location
        if not data.get('location'):
            staff_id = items[0].get('staff')
            if staff_id:
                staff_shift = StaffShift.objects.filter(staff_id=staff_id).first()
                if staff_shift:
                    data['location'] = staff_shift.location_id
            if not data.get('location'):
                first_location = Location.objects.all().first()
                if first_location:
                    data['location'] = first_location.id
                else:
                    return Response({"error": "Localização obrigatória."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse Data Inicial Global
        try:
            raw_start = data.get('start_time')
            current_start_time = datetime.fromisoformat(raw_start.replace('Z', ''))
        except (ValueError, TypeError):
             return Response({"error": "Data inválida"}, status=400)

        created_appointments = []
        n8n_services_list = []
        total_value_centavos = 0
        
        data.pop('service', None); data.pop('staff', None); data.pop('end_time', None)

        # 6. Loop de Criação dos Agendamentos
        for i, item in enumerate(items):
            service_id = item.get('service')
            staff_id = item.get('staff')
            
            try:
                service_obj = Service.objects.get(pk=service_id)
                staff_obj = Staff.objects.get(pk=staff_id)
            except: return Response({"error": "Dados de serviço/staff inválidos."}, status=400)

            duration = service_obj.default_duration_min or 30
            
            item_start_str = item.get('start_time')
            if item_start_str:
                try:
                    appt_start_time = datetime.fromisoformat(item_start_str.replace('Z', ''))
                except: appt_start_time = current_start_time
            else:
                appt_start_time = current_start_time

            appt_end_time = appt_start_time + timedelta(minutes=duration)

            total_value_centavos += (service_obj.price_centavos or 0)
            n8n_services_list.append(f"{i+1}. {service_obj.name} com {staff_obj.name}")

            now = datetime.now()
            auto_note = f"Agendamento via Site em {now.strftime('%d/%m/%Y às %H:%M')}."
            existing_notes = data.get('notes', '')
            
            # Adiciona nota de indicação também no agendamento se houver
            referral_note_appt = ""
            if customer_notes and i == 0:
                referral_note_appt = f" ({customer_notes})"

            final_notes = f"{existing_notes}{referral_note_appt}\n{auto_note}" if i == 0 else existing_notes

            appt_data = data.copy()
            appt_data['service'] = service_id
            appt_data['staff'] = staff_id
            appt_data['start_time'] = appt_start_time.isoformat()
            appt_data['end_time'] = appt_end_time.isoformat()
            appt_data['status'] = 'pending' 
            appt_data['notes'] = final_notes
            appt_data['customer'] = customer.id # Garante o ID
            
            serializer = self.get_serializer(data=appt_data)
            serializer.is_valid(raise_exception=True)
            
            appt = serializer.save()
            created_appointments.append(appt)
            
            current_start_time = appt_end_time 

        # 7. Webhook N8N
        if created_appointments:
            try:
                total_reais = total_value_centavos / 100
                sinal_reais = total_reais * 0.10 
                
                first_appt = created_appointments[0]
                local_start = first_appt.start_time
                if timezone.is_aware(local_start):
                     local_start = local_start.astimezone(pytz.timezone('America/Sao_Paulo'))

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
             return Response({"error": "Erro ao criar agendamentos."}, status=500)

    def update(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
            
        instance = self.get_object()
        was_completed = instance.status == 'completed'
        
        response = super().update(request, *args, **kwargs)

        if response.status_code == 200 and request.data.get('status') == 'completed' and not was_completed:
            instance.refresh_from_db()
            
            # Lógica de Pontos
            if instance.service.price_centavos > 0:
                val = instance.final_amount_centavos if instance.final_amount_centavos is not None else instance.service.price_centavos
                instance.customer.points += int(val / 100)
                instance.customer.save()
            
            # Lógica de Confirmação de Indicação (Referral)
            try:
                referral = Referral.objects.filter(referred_customer=instance.customer, status='pending').first()
                if referral:
                    referral.status = 'completed' # Recompensa liberada para quem indicou
                    referral.save()
            except Exception:
                pass

            # Lógica de Comissão
            if instance.staff:
                pct = instance.staff.default_commission_percentage or 0
                val_base = instance.final_amount_centavos if instance.final_amount_centavos is not None else instance.service.price_centavos
                comm_val = (val_base * pct) / 100
                StaffCommission.objects.update_or_create(
                    appointment=instance,
                    defaults={
                        'staff': instance.staff,
                        'service': instance.service,
                        'date': instance.start_time.date(),
                        'service_price_centavos': instance.service.price_centavos,
                        'commission_percentage': pct,
                        'commission_amount_centavos': comm_val,
                        'status': 'pendente_pagamento',
                    }
                )
        return response

class StaffShiftViewSet(viewsets.ModelViewSet):
    queryset = StaffShift.objects.all()
    serializer_class = StaffShiftSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] 
    
    def get_queryset(self):
        queryset = StaffShift.objects.select_related('staff', 'location').all()
        if self.request.query_params.get('staff_id'):
            queryset = queryset.filter(staff_id=self.request.query_params.get('staff_id'))
        return queryset

class StaffServiceViewSet(viewsets.ModelViewSet):
    queryset = StaffService.objects.all()
    serializer_class = StaffServiceSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] 
    
    @action(detail=False, methods=['delete'], url_path='delete-by-params')
    def delete_by_params(self, request):
        if not request.user.is_authenticated: return Response(status=401)
        try:
            StaffService.objects.get(staff_id=request.query_params.get('staff_id'), service_id=request.query_params.get('service_id')).delete()
            return Response(status=204)
        except: return Response(status=404)

class StaffExceptionViewSet(viewsets.ModelViewSet):
    queryset = StaffException.objects.all()
    serializer_class = StaffExceptionSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    
    def get_queryset(self): return StaffException.objects.all().order_by('-start_date')
    
    def create(self, request, *args, **kwargs):
        if not request.user.is_authenticated: return Response(status=401)
        return super().create(request, *args, **kwargs)

class StaffCommissionViewSet(viewsets.ModelViewSet):
    queryset = StaffCommission.objects.all()
    serializer_class = StaffCommissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return StaffCommission.objects.select_related('staff', 'service', 'appointment').all().order_by('-date')

class ReferralViewSet(viewsets.ModelViewSet):
    queryset = Referral.objects.all()
    serializer_class = ReferralSerializer
    permission_classes = [permissions.AllowAny]
    
    @action(detail=True, methods=['post'], url_path='apply-reward')
    def apply_reward(self, request, pk=None):
        if not request.user.is_authenticated: return Response(status=401)
        try:
            instance = self.get_object()
            instance.status = 'reward_used'
            instance.save()
            return Response(self.get_serializer(instance).data)
        except: return Response(status=404)

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

class RevenueByStaffReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, *args, **kwargs): return Response([]) 
class RevenueByLocationReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, *args, **kwargs): return Response([]) 
class RevenueByServiceReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, *args, **kwargs): return Response([])

class PromotionViewSet(viewsets.ModelViewSet):
    queryset = Promotion.objects.all()
    serializer_class = PromotionSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get_queryset(self):
        return Promotion.objects.filter(active=True).order_by('title')