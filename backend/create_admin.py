import os
import django

# Configura o ambiente do Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "salon_backend.settings")
django.setup()

from django.contrib.auth.models import User

def create_superuser():
    username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
    email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
    password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'admin123') # Senha fixa para garantir

    try:
        user = User.objects.get(username=username)
        print(f"🔄 Usuário '{username}' já existe. Atualizando senha...")
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.save()
        print(f"✅ Senha do usuário '{username}' atualizada com sucesso para: {password}")
    except User.DoesNotExist:
        print(f"🆕 Criando superusuário: {username}")
        User.objects.create_superuser(username, email, password)
        print(f"✅ Superusuário criado com sucesso! Senha: {password}")

if __name__ == "__main__":
    create_superuser()