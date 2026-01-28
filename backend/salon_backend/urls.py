from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Este arquivo é apenas o ponto de entrada.
# Ele delega TODAS as rotas para o seu app principal: salon_api/urls.py

urlpatterns = [
    # Redireciona para as rotas definidas no seu app salon_api
    path('', include('salon_api.urls')),
]

# Configuração para servir arquivos de mídia (imagens) em desenvolvimento
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)