from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    LocationViewSet, StaffViewSet, ServiceViewSet,
    CustomerViewSet, AppointmentViewSet
)

router = DefaultRouter()
router.register(r'locations', LocationViewSet)
router.register(r'staff', StaffViewSet)
router.register(r'services', ServiceViewSet)
router.register(r'customers', CustomerViewSet)
router.register(r'appointments', AppointmentViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
