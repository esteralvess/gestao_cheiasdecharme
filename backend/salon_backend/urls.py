from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # O prefixo 'api/' é fundamental para que o frontend encontre as rotas
    path('api/', include('salon_api.urls')), 
]