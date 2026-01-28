import uuid
import random
import string
from django.db import models
from django.utils.text import slugify

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
        db_column='chat_status',
        null=True, blank=True
    )
    
    favorite_polish_colors = models.TextField(null=True, blank=True)
    preferred_polish_shades = models.TextField(null=True, blank=True)
    preferred_location_id = models.UUIDField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # 💡 CAMPO NOVO: Identifica clientes realmente novos
    is_truly_new = models.BooleanField(default=False, null=True, blank=True)
    
    class Meta:
        managed = False
        db_table = 'customers'

    def __str__(self):
        return self.full_name
    
    def save(self, *args, **kwargs):
        # Gera código automático se não existir (ex: maria-silva-a1b2)
        if not self.referral_code and self.full_name:
            base_slug = slugify(self.full_name)
            random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
            self.referral_code = f"{base_slug}-{random_suffix}"
        
        super().save(*args, **kwargs)

class Appointment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('confirmed', 'Confirmado'),
        ('completed', 'Concluído'),
        ('cancelled', 'Cancelado'),
    ]
    
    PAYMENT_METHOD_CHOICES = [
        ('pix', 'Pix'),
        ('credito', 'Crédito'),
        ('debito', 'Débito'),
        ('dinheiro', 'Dinheiro'),
        ('outro', 'Outro'),
        ('pacote_pre_pago', 'Pacote Pré-Pago'),
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
    # 💡 CORREÇÃO CRÍTICA: ID explícito para permitir múltiplos serviços
    id = models.BigAutoField(primary_key=True)
    
    staff = models.ForeignKey(
        Staff, 
        on_delete=models.CASCADE, 
        db_column='staff_id'
        # primary_key=True removido
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
    WEEKDAY_CHOICES = [
        (1, 'Segunda-feira'), (2, 'Terça-feira'), (3, 'Quarta-feira'),
        (4, 'Quinta-feira'), (5, 'Sexta-feira'), (6, 'Sábado'), (7, 'Domingo'),
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
    TYPE_CHOICES = [('folga', 'Folga'), ('férias', 'Férias'), ('atestado', 'Atestado')]
    STATUS_CHOICES = [('aprovado', 'Aprovado'), ('pendente', 'Pendente'), ('rejeitado', 'Rejeitado')]
    
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
    TYPE_CHOICES = [('folga', 'Folga'), ('férias', 'Férias'), ('atestado', 'Atestado')]
    STATUS_CHOICES = [('aprovado', 'Aprovado'), ('pendente', 'Pendente'), ('rejeitado', 'Rejeitado')]
    
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
    STATUS_CHOICES = [('pendente_pagamento', 'Pendente de Pagamento'), ('pago', 'Pago'), ('cancelado', 'Cancelado')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, db_column='staff_id')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, db_column='appointment_id')
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
    STATUS_CHOICES = [('pending', 'Pendente'), ('completed', 'Recompensa Liberada'), ('reward_used', 'Recompensa Utilizada')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referrer_customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='referrals_made')
    referred_customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='referral_received')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reward_applied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        managed = False
        db_table = 'referrals'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.referrer_customer.full_name} indicou {self.referred_customer.full_name}"

class CreditCard(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100) # Ex: Nubank, Visa Platinum
    limit_centavos = models.IntegerField()
    closing_day = models.IntegerField()
    due_day = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'credit_cards'

    def __str__(self):
        return self.name

class TransactionCategory(models.Model):
    TYPE_CHOICES = [('income', 'Receita'), ('expense', 'Despesa')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'transaction_categories'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"

class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    description = models.CharField(max_length=255)
    
    # Categorias
    category_legacy = models.CharField(max_length=50, blank=True, null=True, db_column='category') 
    category = models.ForeignKey('TransactionCategory', on_delete=models.SET_NULL, null=True, blank=True, db_column='category_id')

    # Valores e Datas
    amount_centavos = models.IntegerField()
    payment_date = models.DateField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Tipos de Movimentação
    TYPE_CHOICES = [
        ('fixed', 'Fixa'), 
        ('variable', 'Variável'),
        ('income', 'Receita'),     
        ('transfer', 'Transferência') 
    ]
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='variable')
    
    # Status do Pagamento
    STATUS_CHOICES = [('paid', 'Pago'), ('pending', 'Pendente')]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='paid')

    # Cartão de Crédito (Se houver)
    card = models.ForeignKey('CreditCard', on_delete=models.SET_NULL, null=True, blank=True, db_column='card_id')
    installments_current = models.IntegerField(default=1)
    installments_total = models.IntegerField(default=1)
    recurrence = models.CharField(max_length=20, default='none', blank=True, null=True)

    # 🔥 NOVOS CAMPOS PARA CONTROLE FINANCEIRO
    PAYMENT_METHODS = [
        ('credit_card', 'Cartão de Crédito'),
        ('debit_card', 'Cartão de Débito'),
        ('pix', 'Pix'),
        ('cash', 'Dinheiro'),
        ('transfer', 'Transferência'),
        ('slip', 'Boleto')
    ]
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='pix', blank=True, null=True)

    # 🔥 VÍNCULO COM A CONTA BANCÁRIA (Histórico de onde saiu/entrou)
    account = models.ForeignKey('BankAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')

    class Meta:
        managed = False # Mantém False pois você usa Supabase
        db_table = 'expenses'
        ordering = ['-payment_date']

    def __str__(self):
        return f"{self.description} - R$ {self.amount_centavos / 100:.2f}"

    # 🔥 AUTOMATIZAÇÃO: Preenche campos antigos para não quebrar o banco
    def save(self, *args, **kwargs):
        if not self.category_legacy:
            if self.category:
                self.category_legacy = self.category.name
            elif self.type == 'income':
                self.category_legacy = 'Receita'
            elif self.type == 'transfer':
                self.category_legacy = 'Transferência'
            else:
                self.category_legacy = 'Geral'
        super().save(*args, **kwargs)
        
    
class Promotion(models.Model):
    TYPE_CHOICES = [('combo', 'Combo'), ('package', 'Pacote')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.TextField()
    description = models.TextField(null=True, blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    price_centavos = models.IntegerField()
    discount_percentage = models.IntegerField(null=True, blank=True)
    image_url = models.TextField(null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Validade geral do pacote
    days_to_expire = models.IntegerField(default=30, help_text="Validade do pacote em dias")
    
    # Mantidos para compatibilidade, mas o foco agora é no intervalo por item
    min_interval_days = models.IntegerField(default=0)
    suggested_interval_days = models.IntegerField(default=15)
    
    class Meta:
        # ⚠️ IMPORTANTE: Se você já criou a tabela manualmente no banco, mantenha False.
        # Se quiser que o Django gerencie as mudanças via makemigrations, mude para True.
        managed = True 
        db_table = 'promotions'

    def __str__(self):
        return self.title

class PromotionItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name='items', db_column='promotion_id')
    
    service = models.ForeignKey('Service', on_delete=models.CASCADE, db_column='service_id', null=True, blank=True)
    quantity = models.IntegerField(default=1)

    # Configuração da Recorrência/Combo
    custom_interval = models.IntegerField(default=0, help_text="Dias após o item anterior para agendar este item (0 = mesmo dia se não for linkado)")
    
    # 🔥 NOVO CAMPO FUNDAMENTAL
    is_linked_to_previous = models.BooleanField(default=False, help_text="Se True, este serviço é feito NA MESMA SESSÃO (encadeado) do item anterior.")

    # Campos auxiliares antigos (pode manter se quiser compatibilidade, ou remover)
    combo_id = models.UUIDField(null=True, blank=True)
    item_type = models.CharField(max_length=20, default='service', choices=[('service', 'Serviço'), ('combo', 'Combo')])

    class Meta:
        managed = False
        db_table = 'promotion_items'

class BankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100) # Ex: Itaú, Nubank
    balance_centavos = models.IntegerField(default=0) # Saldo Inicial
    color = models.CharField(max_length=20, default='stone') # Para o ícone visual
    
    class Meta:
        managed = False # Se você quiser que o Django crie a tabela, mude para True
        db_table = 'bank_accounts'

    def __str__(self):
        return self.name

class Partner(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    discount_percent = models.IntegerField(default=10)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'partners' 

    def __str__(self):
        return self.name