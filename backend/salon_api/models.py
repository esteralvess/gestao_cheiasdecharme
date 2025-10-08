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
    price_centavos = models.FloatField(null=True, blank=True)
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
    whatsapp = models.TextField(unique=True)
    email = models.TextField(null=True, blank=True)
    birth_date = models.DateField(null=True, blank=True)
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
    
    class Meta:
        managed = False
        db_table = 'appointments'

    def __str__(self):
        return f"{self.customer.full_name} - {self.service.name}"


class StaffService(models.Model):
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, db_column='staff_id')
    service = models.ForeignKey(Service, on_delete=models.CASCADE, db_column='service_id')
    
    class Meta:
        managed = False
        db_table = 'staff_services'
        unique_together = ('staff', 'service')


class ServiceLocation(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, db_column='service_id')
    location = models.ForeignKey(Location, on_delete=models.CASCADE, db_column='location_id')
    
    class Meta:
        managed = False
        db_table = 'service_locations'
        unique_together = ('service', 'location')
