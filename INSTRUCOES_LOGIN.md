# Sistema de Gestão - Salão de Beleza

## Credenciais de Login

Para acessar o sistema, use as seguintes credenciais:

**Usuário:** admin  
**Senha:** admin123

## Informações do Sistema

### Backend (Django + DRF)
- **URL:** http://localhost:8000
- **API Endpoints:** http://localhost:8000/api/
- **Admin Django:** http://localhost:8000/admin/

### Frontend (React + Vite)
- **URL:** http://localhost:5000

### Banco de Dados
- **PostgreSQL (Supabase)** - Configurado via variáveis de ambiente

## Estrutura do Projeto

### Backend
- **Modelos mapeados do Supabase:**
  - Locations (Unidades)
  - Staff (Colaboradores)
  - Services (Serviços)
  - Customers (Clientes)
  - Appointments (Agendamentos)

### Frontend - Páginas Implementadas
- ✅ Login
- ✅ Dashboard
- ✅ Agenda (com calendário)
- ✅ Clientes
- ✅ Colaboradores
- ✅ Serviços
- ✅ Unidades
- ✅ Financeiro
- ✅ Relatórios

## Tecnologias Utilizadas

### Backend
- Django 4.2
- Django REST Framework
- Django CORS Headers
- JWT Authentication
- PostgreSQL (psycopg2)

### Frontend
- React 18
- Vite
- Tailwind CSS (tema bege/dourado)
- React Router DOM
- Axios
- Lucide React (ícones)
- date-fns

## Próximos Passos

Para desenvolvimento futuro:
1. Implementar formulários de criação/edição para todas as entidades
2. Adicionar sistema de pagamentos completo
3. Desenvolver relatórios com gráficos
4. Implementar validação de conflitos de horários
5. Sistema de bloqueios de horário para colaboradores
