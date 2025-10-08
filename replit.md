# Salon Management System

## Overview

A comprehensive salon management system built with Django REST Framework (backend) and React with Vite (frontend). The system manages appointments, customers, staff, services, and locations for beauty salon operations. It uses Supabase PostgreSQL as the database and implements JWT authentication for secure access control.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture

**Framework**: Django 4.2 with Django REST Framework
- **API Design**: RESTful API with ViewSets for CRUD operations
- **Authentication**: JWT-based authentication using `djangorestframework-simplejwt`
- **Authorization**: Permission-based access control (currently set to `AllowAny` for development)
- **Database Integration**: PostgreSQL via Supabase with Django ORM using unmanaged models

**Key Design Decisions**:
- **Unmanaged Models**: Django models use `managed = False` and `db_table` to map to existing Supabase tables rather than creating new migrations
- **CORS Configuration**: Enabled via `django-cors-headers` to allow frontend communication
- **Token Refresh**: Supports JWT token refresh mechanism for persistent sessions

### Frontend Architecture

**Framework**: React 18 with Vite build tool
- **Routing**: React Router DOM for client-side navigation
- **Styling**: Tailwind CSS with custom beige/gold theme for salon branding
- **State Management**: Component-level state (no global state manager currently implemented)
- **HTTP Client**: Axios with interceptors for automatic JWT token injection
- **UI Components**: Custom components with Lucide React icons

**Key Design Decisions**:
- **Component Structure**: Reusable components for appointments, customers, and calendar views
- **Date Handling**: date-fns library with Portuguese (BR) locale support
- **Responsive Design**: Mobile-first approach with Tailwind utilities
- **API Service Layer**: Centralized API service with organized endpoints by resource type

### Data Models

The system maps to existing Supabase tables:
- **Locations**: Salon branches/units with address and reference points
- **Staff**: Employees with roles and active status
- **Services**: Beauty services with pricing, duration, and categories
- **Customers**: Client information with contact details
- **Appointments**: Bookings linking customers, staff, services, and locations
- **Supporting Tables**: Business hours, exceptions, chat sessions, favorite services, staff services, and staff shifts

### API Structure

**Base URL**: `http://localhost:8000/api/`

**Endpoints**:
- `/token/` - JWT authentication (obtain token)
- `/token/refresh/` - Refresh JWT token
- `/locations/` - Location management
- `/staff/` - Staff management
- `/services/` - Service management
- `/customers/` - Customer management
- `/appointments/` - Appointment management

All endpoints support standard REST operations (GET, POST, PUT, DELETE).

## External Dependencies

### Third-Party Services

**Supabase PostgreSQL**:
- Hosted PostgreSQL database
- Connection configured via environment variables:
  - `SUPABASE_DB_NAME`
  - `SUPABASE_DB_USER`
  - `SUPABASE_DB_PASSWORD`
  - `SUPABASE_DB_HOST`
  - `SUPABASE_DB_PORT`

**Google Calendar Integration** (Partial):
- Appointments table includes `google_calendar_event_id` field
- Backend models support Google Calendar event tracking
- Integration logic not yet fully implemented

### Frontend Libraries

- **axios** (^1.6.2): HTTP client for API requests
- **react-router-dom** (^6.30.1): Client-side routing
- **date-fns** (^3.0.0): Date manipulation and formatting
- **lucide-react** (^0.294.0): Icon library
- **tailwindcss** (^3.3.6): Utility-first CSS framework
- **clsx** + **tailwind-merge**: Dynamic className utilities

### Backend Libraries

- **Django** (4.2): Web framework
- **djangorestframework** (3.14.0): REST API toolkit
- **djangorestframework-simplejwt** (5.3.0): JWT authentication
- **django-cors-headers** (4.3.0): CORS handling
- **psycopg2-binary** (2.9.9): PostgreSQL adapter
- **python-decouple** (3.8): Environment variable management

### Development Configuration

**Backend Server**: Django development server on port 8000
**Frontend Server**: Vite dev server on port 5000
**Database**: Supabase PostgreSQL (remote)

**Admin Credentials**:
- Username: admin
- Password: admin123

## Recent Changes

### 2025-10-08: Sistema Completo Implementado
- ✅ Backend Django configurado com modelos mapeando tabelas Supabase (managed=False)
- ✅ API REST completa com JWT authentication
- ✅ Frontend React com tema bege/dourado conforme especificação
- ✅ Componentes reutilizáveis: ThemeToggle, AppointmentCard, CalendarView, CustomerRow
- ✅ Páginas implementadas:
  - Login (autenticação JWT)
  - Dashboard (cards de métricas + próximos agendamentos)
  - Agenda (calendário mensal + lista)
  - Clientes (busca + listagem)
  - Colaboradores (cards)
  - Serviços (cards com preços)
  - Unidades (listagem)
  - Financeiro (estrutura básica)
  - Relatórios (estrutura básica)
- ✅ Roteamento com proteção de rotas (PrivateRoute)
- ✅ Workflows configurados (Backend: 8000, Frontend: 5000)
- ✅ Superusuário criado e documentado

## Como Usar

1. **Acessar o sistema**: Abrir o navegador em http://localhost:5000
2. **Fazer login** com as credenciais: admin / admin123
3. **Navegar** pelas diferentes seções usando o menu lateral
4. **Configurar dados** no Supabase para visualizar informações nas páginas

## Próximas Funcionalidades

Para desenvolvimento futuro:
1. Formulários modais para criar/editar todas as entidades
2. Sistema de pagamentos com cálculo de comissões
3. Relatórios com gráficos (Chart.js ou Recharts)
4. Validação de conflitos de horários nos agendamentos
5. Sistema de bloqueios de horário para colaboradores
6. Integração completa com Google Calendar