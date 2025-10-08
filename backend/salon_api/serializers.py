from rest_framework import serializers
from .models import Location, Staff, Service, Customer, Appointment, StaffService, ServiceLocation

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
    class Meta:
        model = Customer
        fields = '__all__'

class AppointmentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    
    class Meta:
        model = Appointment
        fields = '__all__'

class StaffServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffService
        fields = '__all__'

class ServiceLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceLocation
        fields = '__all__'
