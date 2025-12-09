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
from django.db.models import Count, Q, F
from django.utils import timezone
from rest_framework.views import APIView
from datetime import datetime, timedelta 
from django.db import transaction 
import requests 

# --- VIEWSETS DE ADMINISTRAÇÃO ---

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_superuser=False).order_by('username')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password')
        if not password: return Response({'error': 'Senha obrigatória.'}, status=400)
        user.set_password(password)
        user.save()
        return Response({'status': 'senha definida'})

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
    def get(self, request): return Response(UserSerializer(request.user).data)
    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid(): serializer.save(); return Response(serializer.data)
        return Response(serializer.errors, status=400)

# --- VIEWSETS PÚBLICAS OTIMIZADAS ---

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
        qs = super().get_queryset()
        if self.request.query_params.get('show_inactive', 'false').lower() != 'true': 
            qs = qs.filter(active=True)
        return qs.order_by('name')
    
    def destroy(self, request, *args, **kwargs):
        if not request.user.is_authenticated: return Response(status=401)
        instance = self.get_object(); instance.active = False; instance.save()
        return Response(status=200)

class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

class CustomerViewSet(viewsets.ModelViewSet):
    # Otimização: annotate já faz a conta no banco
    queryset = Customer.objects.annotate(
        visits=F('previous_visits') + Count('appointment', filter=Q(appointment__status='completed'))
    ).order_by('-created_at')
    serializer_class = CustomerSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    
    @action(detail=False, methods=['get'], url_path='check-phone')
    def check_phone(self, request):
        phone = request.query_params.get('phone')
        if not phone: return Response({"error": "Telefone obrigatório."}, status=400)
        phone_clean = ''.join(filter(str.isdigit, phone))
        try:
            # Otimização: .only() busca apenas os campos necessários
            customer = Customer.objects.filter(whatsapp__endswith=phone_clean[-11:]).only('id', 'full_name', 'email').first()
            if customer: return Response({"exists": True, "id": customer.id, "name": customer.full_name, "email": customer.email})
            return Response({"exists": False})
        except: return Response({"exists": False})

    @action(detail=True, methods=['post'], url_path='redeem-points')
    def redeem_points(self, request, pk=None):
        if not request.user.is_authenticated: return Response(status=401)
        customer = self.get_object()
        pts = request.data.get('points_to_redeem')
        if not pts or pts <= 0 or customer.points < pts: return Response({"error": "Pontos inválidos."}, status=400)
        customer.points -= pts; customer.save()
        return Response(self.get_serializer(customer).data)

    @action(detail=True, methods=['post'], url_path='adjust-points')
    def adjust_points(self, request, pk=None):
        if not request.user.is_authenticated: return Response(status=401)
        customer = self.get_object()
        pts = request.data.get('points_to_adjust')
        if pts is None: return Response({"error": "Inválido."}, status=400)
        customer.points = (customer.points or 0) + pts; customer.save()
        return Response(self.get_serializer(customer).data)

class AppointmentViewSet(viewsets.ModelViewSet):
    # 🔥 SUPER OTIMIZAÇÃO: select_related busca os dados das tabelas relacionadas em UMA query só.
    queryset = Appointment.objects.select_related('customer', 'staff', 'service', 'location').all().order_by('-start_time')
    serializer_class = AppointmentSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'list', 'retrieve']: return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        customer_id = data.get('customer')
        customer_name = data.get('customer_name')
        customer_phone = data.get('customer_phone')
        customer_email = data.get('customer_email')
        
        customer_notes = data.get('customer_notes') or data.get('notes')
        referrer_phone = data.get('referrer_phone')

        if customer_email == "": customer_email = None
        customer = None

        if customer_id:
            try: customer = Customer.objects.get(pk=customer_id)
            except Customer.DoesNotExist: pass
        
        if not customer and customer_name and customer_phone:
            try:
                phone_clean = ''.join(filter(str.isdigit, str(customer_phone)))
                customer = Customer.objects.filter(whatsapp__endswith=phone_clean[-11:]).first()
                if not customer:
                    customer = Customer.objects.create(full_name=customer_name, whatsapp=phone_clean, email=customer_email, is_truly_new=True)
                data['customer'] = customer.id
            except Exception as e:
                return Response({"error": str(e)}, status=400)

        if not data.get('customer'): return Response({"error": "Cliente não identificado."}, status=400)

        if customer and customer_notes:
            if not customer.notes:
                customer.notes = customer_notes; customer.save()
            elif customer_notes not in customer.notes:
                customer.notes = f"{customer.notes}\n{customer_notes}"; customer.save()

        if customer and referrer_phone and customer.is_truly_new:
            try:
                ref_phone_clean = ''.join(filter(str.isdigit, str(referrer_phone)))
                if len(ref_phone_clean) > 0:
                    referrer = Customer.objects.filter(whatsapp__endswith=ref_phone_clean[-11:]).first()
                    if referrer and referrer.id != customer.id:
                        if not Referral.objects.filter(referred_customer=customer).exists():
                            Referral.objects.create(referrer_customer=referrer, referred_customer=customer, status='pending')
            except: pass

        items = data.get('items', [])
        if not items and data.get('service') and data.get('staff'):
            items = [{'service': data.get('service'), 'staff': data.get('staff'), 'start_time': data.get('start_time')}]
        
        if not items: return Response({"error": "Nenhum serviço."}, status=400)

        if not data.get('location'):
            staff_id = items[0].get('staff')
            if staff_id:
                shift = StaffShift.objects.filter(staff_id=staff_id).first()
                if shift: data['location'] = shift.location_id
            if not data.get('location'):
                loc = Location.objects.first()
                if loc: data['location'] = loc.id
                else: return Response({"error": "Localização obrigatória."}, status=400)
        
        try:
            raw_start = data.get('start_time')
            current_start_time = datetime.fromisoformat(raw_start.replace('Z', ''))
        except: return Response({"error": "Data inválida"}, status=400)

        created_appointments = []
        n8n_services_list = []
        total_value_centavos = 0
        
        data.pop('items', None)
        
        for i, item in enumerate(items):
            service_id = item.get('service')
            staff_id = item.get('staff')
            
            try:
                service_obj = Service.objects.get(pk=service_id)
                staff_obj = Staff.objects.get(pk=staff_id)
            except: continue

            duration = service_obj.default_duration_min or 30
            item_start = item.get('start_time')
            
            if item_start:
                try: appt_start = datetime.fromisoformat(item_start.replace('Z', ''))
                except: appt_start = current_start_time
            else: appt_start = current_start_time

            appt_end = appt_start + timedelta(minutes=duration)
            total_value_centavos += (service_obj.price_centavos or 0)
            n8n_services_list.append(f"{i+1}. {service_obj.name} com {staff_obj.name}")

            now = datetime.now()
            auto_note = f"Agendamento via Site em {now.strftime('%d/%m às %H:%M')}."
            base_notes = data.get('notes', '')
            referral_txt = f" ({customer_notes})" if (customer_notes and i == 0) else ""
            final_notes = f"{base_notes}{referral_txt}\n{auto_note}" if i == 0 else base_notes

            appt_payload = data.copy()
            appt_payload.update({'service': service_id, 'staff': staff_id, 'start_time': appt_start.isoformat(), 'end_time': appt_end.isoformat(), 'status': 'pending', 'notes': final_notes, 'customer': customer.id})

            serializer = self.get_serializer(data=appt_payload)
            if not serializer.is_valid(): return Response(serializer.errors, status=400)
            created_appointments.append(serializer.save())
            current_start_time = appt_end

        if created_appointments:
            try:
                # Webhook Otimizado
                first_appt = created_appointments[0]
                n8n_payload = {
                    "customer_name": customer.full_name,
                    "customer_phone": customer.whatsapp,
                    "date": first_appt.start_time.strftime("%d/%m/%Y"),
                    "time": first_appt.start_time.strftime("%H:%M"),
                    "services": "\n".join(n8n_services_list),
                    "total_value": f"R$ {total_value_centavos/100:.2f}".replace('.', ',')
                }
                requests.post("https://webhooks.gerenc.com/webhook/pre-agendamento", json=n8n_payload, timeout=1) # Timeout bem curto para não travar
            except: pass

            return Response(self.get_serializer(created_appointments[0]).data, status=status.HTTP_201_CREATED)
        else:
            return Response({"error": "Falha ao criar agendamento"}, status=500)

    def update(self, request, *args, **kwargs):
        if not request.user.is_authenticated: return Response(status=401)
        instance = self.get_object()
        was_completed = instance.status == 'completed'
        response = super().update(request, *args, **kwargs)

        if response.status_code == 200 and request.data.get('status') == 'completed' and not was_completed:
            instance.refresh_from_db()
            if instance.service.price_centavos > 0:
                val = instance.final_amount_centavos if instance.final_amount_centavos else instance.service.price_centavos
                instance.customer.points += int(val / 100)
                instance.customer.save()
            try:
                referral = Referral.objects.filter(referred_customer=instance.customer, status='pending').first()
                if referral: referral.status = 'completed'; referral.save()
            except: pass
            
            if instance.staff:
                pct = instance.staff.default_commission_percentage or 0
                val_base = instance.final_amount_centavos if instance.final_amount_centavos is not None else instance.service.price_centavos
                comm_val = (val_base * pct) / 100
                StaffCommission.objects.update_or_create(
                    appointment=instance,
                    defaults={'staff': instance.staff, 'service': instance.service, 'date': instance.start_time.date(), 'service_price_centavos': instance.service.price_centavos, 'commission_percentage': pct, 'commission_amount_centavos': comm_val, 'status': 'pendente_pagamento'}
                )
        return response

class StaffShiftViewSet(viewsets.ModelViewSet):
    # Otimização com select_related
    queryset = StaffShift.objects.select_related('staff', 'location').all()
    serializer_class = StaffShiftSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] 
    
    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('staff_id'): qs = qs.filter(staff_id=self.request.query_params.get('staff_id'))
        return qs

class StaffServiceViewSet(viewsets.ModelViewSet):
    # Otimização com select_related
    queryset = StaffService.objects.select_related('staff', 'service').all()
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
    def get_queryset(self): return StaffException.objects.select_related('staff').all().order_by('-start_date')
    
    def create(self, request, *args, **kwargs):
        if not request.user.is_authenticated: return Response(status=401)
        return super().create(request, *args, **kwargs)

class StaffCommissionViewSet(viewsets.ModelViewSet):
    queryset = StaffCommission.objects.select_related('staff', 'service', 'appointment').all().order_by('-date')
    serializer_class = StaffCommissionSerializer
    permission_classes = [permissions.IsAuthenticated]

class ReferralViewSet(viewsets.ModelViewSet):
    queryset = Referral.objects.select_related('referrer_customer', 'referred_customer').all()
    serializer_class = ReferralSerializer
    permission_classes = [permissions.AllowAny]
    
    @action(detail=True, methods=['post'], url_path='apply-reward')
    def apply_reward(self, request, pk=None):
        if not request.user.is_authenticated: return Response(status=401)
        try:
            instance = self.get_object(); instance.status = 'reward_used'; instance.save()
            return Response(self.get_serializer(instance).data)
        except: return Response(status=404)

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

class RevenueByStaffReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response([])
class RevenueByLocationReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response([])
class RevenueByServiceReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response([])

class PromotionViewSet(viewsets.ModelViewSet):
    queryset = Promotion.objects.prefetch_related('items__service').filter(active=True).order_by('title')
    serializer_class = PromotionSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []