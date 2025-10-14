from django.db import models
import uuid

class Location(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    slug = models.TextField(unique=True)
    address = models.TextField(null=True, blank=True)
    reference_point = models.TextField(null=True, blank=True)
    
    class Meta:
        managed = False
        db_table = 'locations'

    def __str__(self):
        return self.name


class Staff(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    role = models.TextField(null=True, blank=True)
    active = models.BooleanField(default=True)
    default_commission_percentage = models.FloatField(default=0.0) 

    
    class Meta:
        managed = False
        db_table = 'staff'

    def __str__(self):
        return self.name


class Service(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.TextField(null=True, blank=True)
    name = models.TextField()
    description = models.TextField(null=True, blank=True)
    default_duration_min = models.IntegerField(null=True, blank=True)
    variable_duration = models.BooleanField(default=False)
    price_centavos = models.IntegerField(null=True, blank=True)
    popular = models.BooleanField(default=False)
    image_url = models.TextField(null=True, blank=True)
    active = models.BooleanField(default=True)
    
    class Meta:
        managed = False
        db_table = 'services'

    def __str__(self):
        return self.name


class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.TextField()
    whatsapp = models.TextField(
        unique=True,
        error_messages={'unique': "Este número de WhatsApp já está cadastrado."}
    )
    email = models.TextField(null=True, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    previous_visits = models.IntegerField(default=0) 
    points = models.IntegerField(default=0)

    STATUS_CHOICES = [
        ('Atendimento Humano', 'Atendimento Humano'),
        ('Atendimento Robo', 'Atendimento Robo'),
    ]
    chat_status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='Atendimento Robo',
        db_column='chat_status', # Mapeia para a nova coluna
        null=True, blank=True
    )
    
    favorite_polish_colors = models.TextField(null=True, blank=True)
    preferred_polish_shades = models.TextField(null=True, blank=True)
    preferred_location_id = models.UUIDField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        managed = False
        db_table = 'customers'

    def __str__(self):
        return self.full_name
    
class Appointment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('confirmed', 'Confirmado'),
        ('completed', 'Concluído'),
        ('cancelled', 'Cancelado'),
    ]
    
    # ✅ NOVAS OPÇÕES PARA MÉTODO DE PAGAMENTO
    PAYMENT_METHOD_CHOICES = [
        ('pix', 'Pix'),
        ('credito', 'Crédito'),
        ('debito', 'Débito'),
        ('dinheiro', 'Dinheiro'),
        ('outro', 'Outro'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, db_column='customer_id')
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, db_column='staff_id')
    service = models.ForeignKey(Service, on_delete=models.CASCADE, db_column='service_id')
    location = models.ForeignKey(Location, on_delete=models.CASCADE, db_column='location_id')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    google_calendar_event_id = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    # ✅ NOVOS CAMPOS FINANCEIROS
    payment_method = models.CharField(
        max_length=20, 
        choices=PAYMENT_METHOD_CHOICES, 
        null=True, 
        blank=True
    )
    discount_centavos = models.IntegerField(default=0, null=True, blank=True)
    final_amount_centavos = models.IntegerField(null=True, blank=True)
    
    class Meta:
        managed = False
        db_table = 'appointments'

    def __str__(self):
        return f"{self.customer.full_name} - {self.service.name}"


class StaffService(models.Model):
    staff = models.ForeignKey(
        Staff, 
        on_delete=models.CASCADE, 
        db_column='staff_id',
        primary_key=True
    )
    service = models.ForeignKey(
        Service, 
        on_delete=models.CASCADE, 
        db_column='service_id'
    )
    
    class Meta:
        managed = False
        db_table = 'staff_services'
        unique_together = ('staff', 'service')
    
    def __str__(self):
        return f"{self.staff.name} - {self.service.name}"

    
class ServiceLocation(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, db_column='service_id')
    location = models.ForeignKey(Location, on_delete=models.CASCADE, db_column='location_id')
    
    class Meta:
        managed = False
        db_table = 'service_locations'
        unique_together = ('service', 'location')


class StaffShift(models.Model):
    """
    Turnos de trabalho dos profissionais
    """
    WEEKDAY_CHOICES = [
        (1, 'Segunda-feira'),
        (2, 'Terça-feira'),
        (3, 'Quarta-feira'),
        (4, 'Quinta-feira'),
        (5, 'Sexta-feira'),
        (6, 'Sábado'),
        (7, 'Domingo'),
    ]
    
    id = models.AutoField(primary_key=True)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, db_column='staff_id')
    location = models.ForeignKey(Location, on_delete=models.CASCADE, db_column='location_id')
    weekday = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    class Meta:
        managed = False
        db_table = 'staff_shifts'
        ordering = ['staff_id', 'weekday', 'start_time']
        
    def __str__(self):
        return f"{self.staff.name} - {self.get_weekday_display()} ({self.start_time}-{self.end_time})"


class BusinessException(models.Model):
    """
    Folgas, férias e atestados
    """
    TYPE_CHOICES = [
        ('folga', 'Folga'),
        ('férias', 'Férias'),
        ('atestado', 'Atestado'),
    ]
    
    STATUS_CHOICES = [
        ('aprovado', 'Aprovado'),
        ('pendente', 'Pendente'),
        ('rejeitado', 'Rejeitado'),
    ]
    
    id = models.AutoField(primary_key=True)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, db_column='staff_id')
    start_date = models.DateField()
    end_date = models.DateField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        managed = False
        db_table = 'business_exceptions'
        ordering = ['-start_date']
        
    def __str__(self):
        return f"{self.staff.name} - {self.type} ({self.start_date} a {self.end_date})"

    
class StaffException(models.Model):
    """
    Folgas, férias e atestados dos colaboradores
    """
    TYPE_CHOICES = [
        ('folga', 'Folga'),
        ('férias', 'Férias'),
        ('atestado', 'Atestado'),
    ]
    
    STATUS_CHOICES = [
        ('aprovado', 'Aprovado'),
        ('pendente', 'Pendente'),
        ('rejeitado', 'Rejeitado'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, db_column='staff_id')
    start_date = models.DateField()
    end_date = models.DateField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        managed = False
        db_table = 'staff_exceptions'
        ordering = ['-start_date']
        
    def __str__(self):
        return f"{self.staff.name} - {self.type} ({self.start_date} a {self.end_date})"

    
class StaffCommission(models.Model):
    """
    Comissões dos colaboradores por serviços realizados
    """
    STATUS_CHOICES = [
        ('pendente_pagamento', 'Pendente de Pagamento'),
        ('pago', 'Pago'),
        ('cancelado', 'Cancelado'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, db_column='staff_id')
    appointment = models.ForeignKey(
        Appointment, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        db_column='appointment_id'
    )
    service = models.ForeignKey(Service, on_delete=models.CASCADE, db_column='service_id')
    date = models.DateField()
    service_price_centavos = models.FloatField()
    commission_percentage = models.FloatField()
    commission_amount_centavos = models.FloatField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pendente_pagamento')
    payment_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        managed = False
        db_table = 'staff_commissions'
        ordering = ['-date']
        
    def __str__(self):
        return f"{self.staff.name} - {self.service.name} - R$ {self.commission_amount_centavos/100:.2f}"
    
class Referral(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('completed', 'Recompensa Liberada'),
        ('reward_used', 'Recompensa Utilizada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    referrer_customer = models.ForeignKey(
        Customer, 
        on_delete=models.CASCADE,
        related_name='referrals_made'
    )
    
    referred_customer = models.OneToOneField(
        Customer,
        on_delete=models.CASCADE,
        related_name='referral_received'
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reward_applied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        managed = False
        db_table = 'referrals'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.referrer_customer.full_name} indicou {self.referred_customer.full_name}"

# ✅ NOVO MODELO PARA DESPESAS
class Expense(models.Model):
    """
    Registra as despesas fixas e variáveis do negócio.
    """
    CATEGORY_CHOICES = [
        ('aluguel', 'Aluguel'),
        ('produtos', 'Produtos/Estoque'),
        ('salarios', 'Salários/Pró-labore'),
        ('marketing', 'Marketing'),
        ('contas', 'Contas (Água, Luz, Internet)'),
        ('impostos', 'Impostos e Taxas'),
        ('outros', 'Outros'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    description = models.CharField(max_length=255)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    amount_centavos = models.IntegerField()
    payment_date = models.DateField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'expenses'
        ordering = ['-payment_date']

    def __str__(self):
        return f"{self.description} - R$ {self.amount_centavos / 100:.2f}"