from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    LocationViewSet, StaffViewSet, ServiceViewSet, CustomerViewSet, 
    AppointmentViewSet, StaffShiftViewSet, StaffServiceViewSet, 
    StaffExceptionViewSet, StaffCommissionViewSet, ReferralViewSet, 
    ExpenseViewSet, UserViewSet, GroupViewSet, PermissionViewSet,
    RevenueByStaffReport, RevenueByLocationReport, RevenueByServiceReport,
    CurrentUserView
)

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

urlpatterns = [
    path('', include(router.urls)),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('users/me/', CurrentUserView.as_view(), name='current_user'),
    
    # Relatórios
    path('reports/revenue-by-staff/', RevenueByStaffReport.as_view(), name='report_revenue_by_staff'),
    path('reports/revenue-by-location/', RevenueByLocationReport.as_view(), name='report_revenue_by_location'),
    path('reports/revenue-by-service/', RevenueByServiceReport.as_view(), name='report_revenue_by_service'),
]