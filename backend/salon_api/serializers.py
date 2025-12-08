from django.contrib.auth.models import User, Group, Permission
from rest_framework import serializers
from django.utils import timezone
import pytz
from .models import (
    Location, Promotion, PromotionItem, Referral, Staff, Service, Customer, Appointment, 
    StaffCommission, StaffException, StaffService, ServiceLocation, 
    StaffShift, BusinessException, Expense
)

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


class CustomerSerializer(serializers.ModelSerializer):
    visits = serializers.IntegerField(read_only=True)
    category = serializers.SerializerMethodField()
    is_truly_new = serializers.SerializerMethodField()

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
            'chat_status'
        ]
        
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'points': {'read_only': True} 
        }
    
    def get_category(self, obj):
        visits_count = obj.visits if hasattr(obj, 'visits') else 0
        
        if visits_count >= 5:
            return "fidelizado"
        elif visits_count >= 2:
            return "recorrente"
        else:
            return "novo"

    def get_is_truly_new(self, obj):
        system_visits = 0
        if hasattr(obj, 'visits') and hasattr(obj, 'previous_visits'):
             system_visits = (obj.visits or 0) - (obj.previous_visits or 0)

        return (obj.previous_visits or 0) == 0 and system_visits <= 0


class AppointmentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    
    # 💡 NOVO: Campo write_only para receber o array de service IDs
    services = serializers.ListField(
        child=serializers.UUIDField(), 
        write_only=True, 
        required=False,
        allow_empty=True
    )
    
    # 🔥 CORREÇÃO CRÍTICA: Sobrescrever os campos de datetime para forçar timezone local na saída
    start_time = serializers.DateTimeField(format='%Y-%m-%dT%H:%M:%S')
    end_time = serializers.DateTimeField(format='%Y-%m-%dT%H:%M:%S')

    class Meta:
        model = Appointment
        fields = [
            'id', 'customer', 'staff', 'service', 'location', 'start_time', 'end_time', 
            'google_calendar_event_id', 'status', 'notes', 'created_at', 'updated_at', 
            'cancelled_at', 'payment_method', 'discount_centavos', 'final_amount_centavos',
            'customer_name', 'staff_name', 'service_name', 'location_name', 'services'
        ]
        extra_kwargs = {
            'customer': {'required': False},
            'staff': {'required': False},
            'service': {'required': False},
            'location': {'required': False},
            'start_time': {'required': False},
            'end_time': {'required': False},
            'payment_method': {'required': False},
            'discount_centavos': {'required': False},
            'final_amount_centavos': {'required': False},
        }
    
    def to_representation(self, instance):
        """
        🔥 CRÍTICO: Converte os datetimes para timezone local antes de serializar
        Lida com datetimes naive (antigos) e aware (novos)
        """
        ret = super().to_representation(instance)
        
        # Converte start_time e end_time para o timezone local
        if instance.start_time:
            # Se o datetime for naive (sem timezone), assume São Paulo
            if timezone.is_naive(instance.start_time):
                sao_paulo_tz = pytz.timezone('America/Sao_Paulo')
                aware_start = sao_paulo_tz.localize(instance.start_time)
                local_start = timezone.localtime(aware_start)
            else:
                local_start = timezone.localtime(instance.start_time)
            ret['start_time'] = local_start.strftime('%Y-%m-%dT%H:%M:%S')
        
        if instance.end_time:
            # Se o datetime for naive (sem timezone), assume São Paulo
            if timezone.is_naive(instance.end_time):
                sao_paulo_tz = pytz.timezone('America/Sao_Paulo')
                aware_end = sao_paulo_tz.localize(instance.end_time)
                local_end = timezone.localtime(aware_end)
            else:
                local_end = timezone.localtime(instance.end_time)
            ret['end_time'] = local_end.strftime('%Y-%m-%dT%H:%M:%S')
        
        return ret


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
        fields = ['id', 'staff_id', 'staff_name', 'location_id', 'location_name', 
                  'weekday', 'start_time', 'end_time', 'staff', 'location'] 
        
        read_only_fields = ['staff_id', 'location_id', 'staff_name', 'location_name']
        
    def validate_weekday(self, value):
        if value < 1 or value > 7:
            raise serializers.ValidationError("Weekday deve estar entre 1 (Segunda) e 7 (Domingo)")
        return value


class StaffServiceSerializer(serializers.ModelSerializer):
    staff_id = serializers.UUIDField(source='staff.id', read_only=True)
    service_id = serializers.UUIDField(source='service.id', read_only=True)
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    
    staff = serializers.PrimaryKeyRelatedField(
        queryset=Staff.objects.all(),
        write_only=True,
        required=False
    )
    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = StaffService
        fields = ['staff_id', 'service_id', 'staff_name', 'service_name', 'staff', 'service']
    
    def create(self, validated_data):
        return StaffService.objects.create(**validated_data)


class BusinessExceptionSerializer(serializers.ModelSerializer):
    staff_id = serializers.UUIDField(source='staff.id', read_only=True)
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    
    class Meta:
        model = BusinessException
        fields = [
            'id', 
            'staff_id', 
            'staff_name',
            'start_date', 
            'end_date', 
            'type', 
            'status',
            'notes',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        
    def validate(self, data):
        if data.get('end_date') and data.get('start_date'):
            if data['end_date'] < data['start_date']:
                raise serializers.ValidationError(
                    "A data de término deve ser maior ou igual à data de início"
                )
        return data


class StaffExceptionSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    
    staff_id = serializers.PrimaryKeyRelatedField(
        queryset=Staff.objects.all(),
        source='staff',
        required=False,
    )
    
    class Meta:
        model = StaffException
        fields = [
            'id',
            'staff_id',      
            'staff_name',    
            'start_date',
            'end_date',
            'type',
            'status',        
            'notes',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'staff_name']
        
    def to_internal_value(self, data):
        is_patch_status_only = self.instance is not None and len(data.keys()) == 1 and 'status' in data

        if is_patch_status_only:
            fields_to_make_optional = ['staff_id', 'start_date', 'end_date', 'type', 'notes']
            
            for field_name in fields_to_make_optional:
                if field_name in self.fields:
                    self.fields[field_name].required = False
        
        return super().to_internal_value(data)
    
    def validate(self, data):
        start_date = data.get('start_date') or (self.instance and self.instance.start_date)
        end_date = data.get('end_date') or (self.instance and self.instance.end_date)
        
        if end_date and start_date:
            if end_date < start_date:
                raise serializers.ValidationError(
                    "A data de término deve ser maior ou igual à data de início"
                )
        return data


class StaffCommissionSerializer(serializers.ModelSerializer):
    staff_id = serializers.UUIDField(source='staff.id', read_only=True)
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    service_id = serializers.UUIDField(source='service.id', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    appointment_id = serializers.UUIDField(source='appointment.id', read_only=True, allow_null=True)

    staff = serializers.PrimaryKeyRelatedField(
        queryset=Staff.objects.all(), write_only=True
    )
    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), write_only=True
    )
    
    service_price_reais = serializers.SerializerMethodField()
    commission_amount_reais = serializers.SerializerMethodField()
    
    class Meta:
        model = StaffCommission
        fields = [
            'id',
            'staff_id',
            'staff_name',
            'appointment_id',
            'service_id',
            'service_name',
            'date',
            'service_price_centavos',
            'service_price_reais',
            'commission_percentage',
            'commission_amount_centavos',
            'commission_amount_reais',
            'status',
            'payment_date',
            'notes',
            'created_at',
            'updated_at',
            'staff',      
            'service'    
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_service_price_reais(self, obj):
        return f"R$ {obj.service_price_centavos / 100:.2f}"
    
    def get_commission_amount_reais(self, obj):
        return f"R$ {obj.commission_amount_centavos / 100:.2f}"
    
    def validate(self, data):
        if data.get('commission_percentage'):
            if data['commission_percentage'] < 0 or data['commission_percentage'] > 100:
                raise serializers.ValidationError(
                    "Percentual de comissão deve estar entre 0 e 100"
                )
        return data
    
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

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'

class PromotionItemSerializer(serializers.ModelSerializer):
    # Configura para aceitar ID na escrita e devolver Objeto na leitura
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), 
        source='service', 
        write_only=True
    )
    service_name = serializers.CharField(source='service.name', read_only=True)
    
    # Devolve o ID do serviço também na leitura para o frontend preencher o Select
    service = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PromotionItem
        fields = ['id', 'service_id', 'service', 'service_name', 'quantity']

class PromotionSerializer(serializers.ModelSerializer):
    items = PromotionItemSerializer(many=True) 

    class Meta:
        model = Promotion
        # 💡 Adicionei os novos campos na lista
        fields = [
            'id', 'title', 'description', 'type', 'price_centavos', 
            'discount_percentage', 'image_url', 'active', 'items',
            'days_to_expire', 'min_interval_days', 'suggested_interval_days'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        promotion = Promotion.objects.create(**validated_data)
        for item in items_data:
            PromotionItem.objects.create(promotion=promotion, **item)
        return promotion

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        
        # Atualiza campos básicos e as novas regras
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.type = validated_data.get('type', instance.type)
        instance.price_centavos = validated_data.get('price_centavos', instance.price_centavos)
        instance.discount_percentage = validated_data.get('discount_percentage', instance.discount_percentage)
        instance.image_url = validated_data.get('image_url', instance.image_url)
        instance.active = validated_data.get('active', instance.active)
        
        # Novos campos
        instance.days_to_expire = validated_data.get('days_to_expire', instance.days_to_expire)
        instance.min_interval_days = validated_data.get('min_interval_days', instance.min_interval_days)
        instance.suggested_interval_days = validated_data.get('suggested_interval_days', instance.suggested_interval_days)
        
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                PromotionItem.objects.create(promotion=instance, **item)

        return instance
    
# Adicione isso no final ou junto com os outros Appointment serializers

class PublicAppointmentSerializer(serializers.ModelSerializer):
    """
    Serializer leve para uso público: Mostra apenas que o horário está ocupado,
    sem revelar quem é o cliente ou o valor.
    """
    class Meta:
        model = Appointment
        fields = ['id', 'staff', 'start_time', 'end_time', 'status']