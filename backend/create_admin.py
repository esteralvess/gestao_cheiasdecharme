import os
import django

# Configura o ambiente do Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "salon_backend.settings")
django.setup()

from django.contrib.auth.models import User

def create_superuser():
    username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
    email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
    password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'admin123')

    if not User.objects.filter(username=username).exists():
        print(f"Criando superusuário: {username}")
        User.objects.create_superuser(username, email, password)
        print("Superusuário criado com sucesso!")
    else:
        # 🔥 AQUI ESTÁ A CORREÇÃO:
        print(f"Usuário {username} já existe. Forçando reset de senha...")
        user = User.objects.get(username=username)
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.save()
        print(f"Senha do usuário '{username}' foi redefinida para: {password}")

if __name__ == "__main__":
    create_superuser()