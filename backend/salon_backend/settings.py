"""
Django settings for salon_backend project.
"""

from pathlib import Path
from decouple import config, Csv
from datetime import timedelta
import os
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# =====================================================
# SECURITY
# =====================================================

# Em produção no Render, defina essa variável de ambiente
SECRET_KEY = config('SECRET_KEY', default='django-insecure-chave-padrao-seguranca')

# Em produção no Render, defina DEBUG=False
DEBUG = config('DEBUG', default=False, cast=bool)

# No Render, defina ALLOWED_HOSTS=* ou o domínio exato da sua API
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*', cast=Csv())

# =====================================================
# APPS
# =====================================================

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local
    'salon_api',
]

# =====================================================
# MIDDLEWARE
# =====================================================

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    
    # Whitenoise deve vir logo após Security para servir arquivos estáticos no Render
    "whitenoise.middleware.WhiteNoiseMiddleware",

    # CorsMiddleware deve vir antes de CommonMiddleware
    'corsheaders.middleware.CorsMiddleware',

    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'salon_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'salon_backend.wsgi.application'

# =====================================================
# DATABASE (SUPABASE / RENDER)
# =====================================================

# No Render, você deve criar uma variável de ambiente chamada DATABASE_URL
# e colar a "Connection String" (URI) que você pega no painel do Supabase.
# Ex: postgres://postgres:senha@db.supabase.co:5432/postgres

DATABASES = {
    "default": dj_database_url.config(
        default=config("DATABASE_URL", default="sqlite:///db.sqlite3"),
        conn_max_age=0,           # Importante para Supabase (evita segurar conexões)
        conn_health_checks=True,
    )
}

# =====================================================
# PASSWORD VALIDATION
# =====================================================

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# =====================================================
# INTERNATIONALIZATION
# =====================================================

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
# Mantive False conforme seu código original, pois você trata TZ manualmente nas views/serializers
USE_TZ = False 

# =====================================================
# STATIC FILES (Para o Admin funcionar no Render)
# =====================================================

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Compressão e cache de estáticos para produção
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =====================================================
# CORS & CSRF (Conexão com Vercel)
# =====================================================

# Permite que qualquer domínio acesse a API (Ideal para início rápido)
CORS_ALLOW_ALL_ORIGINS = True 
CORS_ALLOW_CREDENTIALS = True

# Lista de origens confiáveis para CSRF (POST requests do Admin)
# Se o seu domínio no Vercel mudar, adicione ele aqui ou na env var ALLOWED_ORIGINS
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
]

# Adiciona domínios extras vindos do ambiente (Ex: no Render, adicione a URL do seu Vercel)
extra_origins = config('ALLOWED_ORIGINS', default='', cast=Csv())
for origin in extra_origins:
    CSRF_TRUSTED_ORIGINS.append(origin)

# Configurações de segurança para HTTPS (Produção)
if not DEBUG:
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SAMESITE = "None"

# =====================================================
# REST FRAMEWORK
# =====================================================

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# =====================================================
# JWT
# =====================================================

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}