from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# Importando as Views da sua aplicação (salon_api)
from salon_api.views import (
    LocationViewSet, StaffViewSet, ServiceViewSet, CustomerViewSet, 
    AppointmentViewSet, StaffShiftViewSet, StaffServiceViewSet, 
    StaffExceptionViewSet, StaffCommissionViewSet, ReferralViewSet, 
    ExpenseViewSet, UserViewSet, GroupViewSet, PermissionViewSet,
    RevenueByStaffReport, RevenueByLocationReport, RevenueByServiceReport,
    CurrentUserView, PromotionViewSet
)

# Configurando o Router
router = DefaultRouter()
router.register(r'locations', LocationViewSet)
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'services', ServiceViewSet)
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'appointments', AppointmentViewSet)
router.register(r'staff_shifts', StaffShiftViewSet, basename='staff_shifts')
router.register(r'staff_services', StaffServiceViewSet, basename='staff_services')
router.register(r'staff_exceptions', StaffExceptionViewSet, basename='staff_exceptions')
router.register(r'staff_commissions', StaffCommissionViewSet, basename='staff_commissions')
router.register(r'referrals', ReferralViewSet, basename='referrals')
router.register(r'expenses', ExpenseViewSet, basename='expenses')
router.register(r'users', UserViewSet, basename='users')
router.register(r'groups', GroupViewSet, basename='groups')
router.register(r'permissions', PermissionViewSet, basename='permissions')
router.register(r'promotions', PromotionViewSet, basename='promotions')

urlpatterns = [
    # Painel Admin
    path('admin/', admin.site.urls),

    # --- ROTAS DA API (Tudo começa com api/) ---
    
    # 1. Rotas do Router (CRUDs automáticos)
    path('api/', include(router.urls)),

    # 2. Autenticação JWT
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/users/me/', CurrentUserView.as_view(), name='current_user'),
    
    # 3. Relatórios
    path('api/reports/revenue-by-staff/', RevenueByStaffReport.as_view()),
    path('api/reports/revenue-by-location/', RevenueByLocationReport.as_view()),
    path('api/reports/revenue-by-service/', RevenueByServiceReport.as_view()),
]