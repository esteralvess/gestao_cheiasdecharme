from django.contrib.auth.models import User, Group, Permission
from rest_framework import serializers
from django.utils import timezone
import pytz
from .models import (
    Location, Promotion, PromotionItem, Referral, Staff, Service, Customer, Appointment, 
    StaffCommission, StaffException, StaffService, ServiceLocation, 
    StaffShift, BusinessException, Expense
)

# --- USUÁRIOS E PERMISSÕES ---

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'groups', 'is_staff', 'is_active']

class GroupSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(queryset=Permission.objects.all(), many=True)
    class Meta:
        model = Group
        fields = ['id', 'name', 'permissions']

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename']

# --- CADASTROS BÁSICOS ---

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'

class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = '__all__'

class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = '__all__'

# --- CLIENTES E INDICAÇÕES ---

class CustomerSerializer(serializers.ModelSerializer):
    visits = serializers.IntegerField(read_only=True)
    category = serializers.SerializerMethodField()
    is_truly_new = serializers.SerializerMethodField()
    
    # 🔥 NOVOS CAMPOS PARA O SISTEMA DE INDICAÇÃO
    # referral_count: Vem da anotação no ViewSet (conta quantos ele indicou)
    referral_count = serializers.IntegerField(read_only=True) 
    # referrer_name: Busca o nome de quem indicou este cliente
    referrer_name = serializers.SerializerMethodField()       

    class Meta:
        model = Customer
        fields = [
            'id', 
            'full_name', 
            'whatsapp', 
            'email', 
            'birth_date', 
            'notes', 
            'created_at',
            'previous_visits',
            'points',
            'visits',      
            'category',
            'is_truly_new',
            'chat_status',
            'referral_count', 
            'referrer_name'   
        ]
        
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'points': {'read_only': True} 
        }
    
    def get_category(self, obj):
        visits_count = obj.visits if hasattr(obj, 'visits') else 0
        if visits_count >= 5: return "fidelizado"
        elif visits_count >= 2: return "recorrente"
        else: return "novo"

    def get_is_truly_new(self, obj):
        system_visits = 0
        if hasattr(obj, 'visits') and hasattr(obj, 'previous_visits'):
             system_visits = (obj.visits or 0) - (obj.previous_visits or 0)
        return (obj.previous_visits or 0) == 0 and system_visits <= 0

    def get_referrer_name(self, obj):
        # Tenta buscar o registro na tabela Referral onde este cliente é o "indicado" (referred)
        try:
            if hasattr(obj, 'referral_received'):
                return obj.referral_received.referrer_customer.full_name
        except:
            pass
        return None

class ReferralSerializer(serializers.ModelSerializer):
    referrer_customer_name = serializers.CharField(source='referrer_customer.full_name', read_only=True)
    referred_customer_name = serializers.CharField(source='referred_customer.full_name', read_only=True)

    class Meta:
        model = Referral
        fields = [
            'id',
            'referrer_customer',
            'referrer_customer_name',
            'referred_customer',
            'referred_customer_name',
            'status',
            'reward_applied_at',
            'created_at',
        ]
        read_only_fields = ['status', 'reward_applied_at', 'created_at']

# --- AGENDAMENTOS ---

class AppointmentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    
    # Campo auxiliar para o frontend saber o preço base caso venha zerado
    service_price = serializers.IntegerField(source='service.price_centavos', read_only=True)
    
    # Campo write_only para receber múltiplos serviços (se necessário no futuro)
    services = serializers.ListField(child=serializers.UUIDField(), write_only=True, required=False, allow_empty=True)
    
    # 🔥 Força formato ISO sem timezone confuso na saída
    start_time = serializers.DateTimeField(format='%Y-%m-%dT%H:%M:%S')
    end_time = serializers.DateTimeField(format='%Y-%m-%dT%H:%M:%S')

    class Meta:
        model = Appointment
        fields = [
            'id', 'customer', 'staff', 'service', 'location', 'start_time', 'end_time', 
            'google_calendar_event_id', 'status', 'notes', 'created_at', 'updated_at', 
            'cancelled_at', 'payment_method', 'discount_centavos', 'final_amount_centavos',
            'customer_name', 'staff_name', 'service_name', 'location_name', 'services', 'service_price'
        ]
        extra_kwargs = {
            'customer': {'required': False}, 'staff': {'required': False}, 'service': {'required': False},
            'location': {'required': False}, 'start_time': {'required': False}, 'end_time': {'required': False},
            'payment_method': {'required': False}, 'discount_centavos': {'required': False}, 'final_amount_centavos': {'required': False},
        }
    
    def to_representation(self, instance):
        # Garante que as datas enviadas ao frontend estejam no horário local (Brasil)
        ret = super().to_representation(instance)
        if instance.start_time:
            if timezone.is_naive(instance.start_time):
                sao_paulo_tz = pytz.timezone('America/Sao_Paulo')
                local_start = timezone.localtime(sao_paulo_tz.localize(instance.start_time))
            else:
                local_start = timezone.localtime(instance.start_time)
            ret['start_time'] = local_start.strftime('%Y-%m-%dT%H:%M:%S')
        
        if instance.end_time:
            if timezone.is_naive(instance.end_time):
                sao_paulo_tz = pytz.timezone('America/Sao_Paulo')
                local_end = timezone.localtime(sao_paulo_tz.localize(instance.end_time))
            else:
                local_end = timezone.localtime(instance.end_time)
            ret['end_time'] = local_end.strftime('%Y-%m-%dT%H:%M:%S')
        return ret

class PublicAppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['id', 'staff', 'start_time', 'end_time', 'status']

# --- ESCALAS E SERVIÇOS DE STAFF ---

class ServiceLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceLocation
        fields = '__all__'

class StaffShiftSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    staff_id = serializers.UUIDField(source='staff.id', read_only=True)
    location_id = serializers.UUIDField(source='location.id', read_only=True)
    class Meta:
        model = StaffShift
        fields = ['id', 'staff_id', 'staff_name', 'location_id', 'location_name', 'weekday', 'start_time', 'end_time', 'staff', 'location'] 
        read_only_fields = ['staff_id', 'location_id', 'staff_name', 'location_name']
    def validate_weekday(self, value):
        if value < 1 or value > 7: raise serializers.ValidationError("Weekday deve estar entre 1 e 7")
        return value

class StaffServiceSerializer(serializers.ModelSerializer):
    staff_id = serializers.UUIDField(source='staff.id', read_only=True)
    service_id = serializers.UUIDField(source='service.id', read_only=True)
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    staff = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.all(), write_only=True, required=False)
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all(), write_only=True, required=False)
    class Meta:
        model = StaffService
        fields = ['staff_id', 'service_id', 'staff_name', 'service_name', 'staff', 'service']
    def create(self, validated_data): return StaffService.objects.create(**validated_data)

class BusinessExceptionSerializer(serializers.ModelSerializer):
    staff_id = serializers.UUIDField(source='staff.id', read_only=True)
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    class Meta:
        model = BusinessException
        fields = ['id', 'staff_id', 'staff_name', 'start_date', 'end_date', 'type', 'status', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    def validate(self, data):
        if data.get('end_date') and data.get('start_date') and data['end_date'] < data['start_date']:
            raise serializers.ValidationError("Data término menor que início")
        return data

class StaffExceptionSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    staff_id = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.all(), source='staff', required=False)
    class Meta:
        model = StaffException
        fields = ['id', 'staff_id', 'staff_name', 'start_date', 'end_date', 'type', 'status', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'staff_name']
    def to_internal_value(self, data):
        if self.instance and len(data.keys()) == 1 and 'status' in data:
            for f in ['staff_id', 'start_date', 'end_date', 'type', 'notes']: 
                if f in self.fields: self.fields[f].required = False
        return super().to_internal_value(data)
    def validate(self, data):
        start = data.get('start_date') or (self.instance and self.instance.start_date)
        end = data.get('end_date') or (self.instance and self.instance.end_date)
        if end and start and end < start: raise serializers.ValidationError("Data inválida")
        return data

class StaffCommissionSerializer(serializers.ModelSerializer):
    staff_id = serializers.UUIDField(source='staff.id', read_only=True)
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    service_id = serializers.UUIDField(source='service.id', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    appointment_id = serializers.UUIDField(source='appointment.id', read_only=True, allow_null=True)
    staff = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.all(), write_only=True)
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all(), write_only=True)
    service_price_reais = serializers.SerializerMethodField()
    commission_amount_reais = serializers.SerializerMethodField()
    class Meta:
        model = StaffCommission
        fields = ['id', 'staff_id', 'staff_name', 'appointment_id', 'service_id', 'service_name', 'date', 'service_price_centavos', 'service_price_reais', 'commission_percentage', 'commission_amount_centavos', 'commission_amount_reais', 'status', 'payment_date', 'notes', 'created_at', 'updated_at', 'staff', 'service']
        read_only_fields = ['created_at', 'updated_at']
    def get_service_price_reais(self, obj): return f"R$ {obj.service_price_centavos / 100:.2f}"
    def get_commission_amount_reais(self, obj): return f"R$ {obj.commission_amount_centavos / 100:.2f}"
    def validate(self, data):
        if data.get('commission_percentage') and (data['commission_percentage'] < 0 or data['commission_percentage'] > 100): raise serializers.ValidationError("Percentual inválido")
        return data

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'

# --- PROMOÇÕES (COMBOS E PACOTES) ---

class PromotionItemSerializer(serializers.ModelSerializer):
    # Permite enviar o ID do serviço no campo 'service_id'
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), 
        source='service', 
        write_only=True,
        allow_null=True, # Importante para flexibilidade
        required=False
    )
    service_name = serializers.CharField(source='service.name', read_only=True)
    
    class Meta:
        model = PromotionItem
        fields = [
            'id', 
            'service_id', 
            'service', 
            'service_name', 
            'quantity', 
            'custom_interval', # 👈 Novo campo
            'combo_id',        # 👈 Novo campo
            'item_type'        # 👈 Novo campo
        ]

class PromotionSerializer(serializers.ModelSerializer):
    items = PromotionItemSerializer(many=True) 
    
    class Meta:
        model = Promotion
        fields = [
            'id', 'title', 'description', 'type', 'price_centavos', 
            'discount_percentage', 'image_url', 'active', 'items', 
            'days_to_expire', 'min_interval_days', 'suggested_interval_days'
        ]
    
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        promotion = Promotion.objects.create(**validated_data)
        for item_data in items_data:
            PromotionItem.objects.create(promotion=promotion, **item_data)
        return promotion
        
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        
        # Atualiza campos básicos da promoção
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Atualiza os itens (deleta os antigos e cria os novos com os campos extras)
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                PromotionItem.objects.create(promotion=instance, **item_data)
        
        return instance