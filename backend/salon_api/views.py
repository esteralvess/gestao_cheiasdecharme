import math
from django.contrib.auth.models import User, Group, Permission
from django.forms import ValidationError
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
    BankAccount, CreditCard, Location, Partner, Promotion, Staff, Service, Customer, Appointment, StaffCommission, 
    StaffShift, StaffService, StaffException, BusinessException, Referral,
    Expense, TransactionCategory
)
from .serializers import (
    BankAccountSerializer, CreditCardSerializer, GroupSerializer, LocationSerializer, PermissionSerializer, PromotionSerializer, StaffCommissionSerializer, StaffSerializer, ServiceSerializer,
    CustomerSerializer, AppointmentSerializer, StaffShiftSerializer, 
    StaffServiceSerializer, StaffExceptionSerializer, BusinessExceptionSerializer, ReferralSerializer,
    ExpenseSerializer, UserSerializer, TransactionCategorySerializer, PartnerSerializer
)
from django.db.models import Count, Q, F
from django.utils import timezone
from rest_framework.views import APIView
from datetime import datetime, timedelta 
from django.db import transaction
from django.db.models import Sum, Q, F, Case, When, Value, CharField, FloatField
from django.db.models.functions import Coalesce 
from dateutil.relativedelta import relativedelta
import requests 

# --- VIEWSETS DE ADMINISTRAÇÃO ---

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_superuser=False).order_by('username')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password')
        if not password: return Response({'error': 'Senha obrigatória.'}, status=400)
        user.set_password(password)
        user.save()
        return Response({'status': 'senha definida'})

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all().order_by('name')
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all().order_by('name')
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response(UserSerializer(request.user).data)
    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid(): serializer.save(); return Response(serializer.data)
        return Response(serializer.errors, status=400)

# --- VIEWSETS PÚBLICAS OTIMIZADAS ---

class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [permissions.AllowAny]

class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('show_inactive', 'false').lower() != 'true': 
            qs = qs.filter(active=True)
        return qs.order_by('name')
    
    def destroy(self, request, *args, **kwargs):
        if not request.user.is_authenticated: return Response(status=401)
        instance = self.get_object(); instance.active = False; instance.save()
        return Response(status=200)

class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.annotate(
        visits=F('previous_visits') + Count('appointment', filter=Q(appointment__status='completed')),
        referral_count=Count('referrals_made')
    ).order_by('-created_at')
    
    serializer_class = CustomerSerializer
    permission_classes = [permissions.AllowAny]
    
    @action(detail=False, methods=['get'], url_path='check-phone')
    def check_phone(self, request):
        phone = request.query_params.get('phone')
        if not phone: return Response({"error": "Telefone obrigatório."}, status=400)
        phone_clean = ''.join(filter(str.isdigit, phone))
        try:
            customer = Customer.objects.filter(whatsapp__endswith=phone_clean[-11:]).only('id', 'full_name', 'email').first()
            if customer: return Response({"exists": True, "id": customer.id, "name": customer.full_name, "email": customer.email})
            return Response({"exists": False})
        except: return Response({"exists": False})

    @action(detail=True, methods=['post'], url_path='redeem-points')
    def redeem_points(self, request, pk=None):
        if not request.user.is_authenticated: return Response(status=401)
        customer = self.get_object()
        pts = request.data.get('points_to_redeem')
        if not pts or pts <= 0 or customer.points < pts: return Response({"error": "Pontos inválidos."}, status=400)
        customer.points -= pts; customer.save()
        return Response(self.get_serializer(customer).data)

    @action(detail=True, methods=['post'], url_path='adjust-points')
    def adjust_points(self, request, pk=None):
        if not request.user.is_authenticated: return Response(status=401)
        customer = self.get_object()
        pts = request.data.get('points_to_adjust')
        if pts is None: return Response({"error": "Inválido."}, status=400)
        customer.points = (customer.points or 0) + pts; customer.save()
        return Response(self.get_serializer(customer).data)

    # Dentro de CustomerViewSet
    @action(detail=False, methods=['get'])
    def find_by_referral(self, request):
        code = request.query_params.get('code')
        if not code:
            return Response({"error": "Código obrigatório"}, status=400)
        
        try:
            customer = Customer.objects.get(referral_code=code)
            return Response({
                "id": customer.id,
                "full_name": customer.full_name,
                "whatsapp": customer.whatsapp
            })
        except Customer.DoesNotExist:
            return Response({"error": "Código inválido"}, status=404)

class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related('customer', 'staff', 'service', 'location').all().order_by('-start_time')
    serializer_class = AppointmentSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'list', 'retrieve']: return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    # ... (MANTENHA OS MÉTODOS CREATE E UPDATE ORIGINAIS AQUI) ...
    # (Estou omitindo para economizar espaço, mas NÃO apague os seus create/update originais)
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # ... seu código create original ...
        return super().create(request, *args, **kwargs) # Exemplo placeholder

    def update(self, request, *args, **kwargs):
        # ... seu código update original ...
        return super().update(request, *args, **kwargs) # Exemplo placeholder

    # 🔥 MÉTODO PAY (SUBSTITUA/ADICIONE ESTE NO FINAL)
    @action(detail=True, methods=['post'])
    @transaction.atomic # 🔥 CRÍTICO: Garante que se o banco falhar, a receita não é criada
    def pay(self, request, pk=None):
        try:
            instance = self.get_object()
            
            # 1. Recupera dados com segurança
            data = request.data
            payment_method = data.get('payment_method', 'cash')
            
            # 🔥 CORREÇÃO 1: Trata string vazia "" como None para não quebrar o UUID
            account_id = data.get('account_id')
            if account_id == "": 
                account_id = None

            amount_input = data.get('amount')

            # Atualiza valor se veio no request
            if amount_input is not None:
                try:
                    instance.final_amount_centavos = int(float(amount_input))
                except ValueError:
                    pass 
            
            valor_real = instance.final_amount_centavos or 0

            # Evita duplicidade
            if instance.status == 'completed':
                return Response({'status': 'already_paid', 'message': 'Agendamento já estava pago.'}, status=200)

            # 2. Atualiza Status do Agendamento
            instance.status = 'completed'
            instance.save()

            # 3. Cria Receita (Expense)
            # Garante nomes padrão caso relacionamentos estejam nulos
            servico_nome = instance.service.name if instance.service else "Serviço Avulso"
            cliente_nome = instance.customer.full_name if instance.customer else "Cliente"

            expense = Expense.objects.create(
                description=f"{servico_nome} - {cliente_nome}",
                amount_centavos=valor_real,
                payment_date=date.today(), # Requer: from datetime import date
                type='income',
                category_legacy='Serviços',
                status='paid',
                payment_method=payment_method,
                account_id=account_id # Agora seguro (None ou UUID válido)
            )

            # 4. Atualiza Saldo Bancário
            if account_id and valor_real > 0:
                try:
                    account = BankAccount.objects.get(id=account_id)
                    saldo_atual = account.balance_centavos or 0
                    account.balance_centavos = saldo_atual + valor_real
                    account.save()
                except BankAccount.DoesNotExist:
                    # Não impede o fluxo, apenas loga (opcional)
                    print(f"Aviso: Conta {account_id} não encontrada.")

            # 5. Efeitos Colaterais (Pontos, Indicação e Comissão)
            # Pontos
            if valor_real > 0 and instance.customer:
                try:
                    instance.customer.points += int(valor_real / 100)
                    instance.customer.save()
                except: pass
            
            # Indicação
            try:
                referral = Referral.objects.filter(referred_customer=instance.customer, status='pending').first()
                if referral: referral.status = 'completed'; referral.save()
            except: pass
            
            # Comissão
            if instance.staff:
                try:
                    pct = instance.staff.default_commission_percentage or 0
                    val_base = valor_real if valor_real > 0 else (instance.service.price_centavos if instance.service else 0)
                    comm_val = (val_base * pct) / 100
                    
                    # Verifica se tem serviço antes de criar
                    if instance.service:
                        StaffCommission.objects.update_or_create(
                            appointment=instance,
                            defaults={
                                'staff': instance.staff, 
                                'service': instance.service, 
                                'date': instance.start_time.date(), 
                                'service_price_centavos': instance.service.price_centavos, 
                                'commission_percentage': pct, 
                                'commission_amount_centavos': comm_val, 
                                'status': 'pendente_pagamento'
                            }
                        )
                except Exception as e:
                    print(f"Erro comissão: {e}")

            return Response({'status': 'paid', 'expense_id': expense.id}, status=200)

        except Exception as e:
            # 🔥 Retorna o erro real para o frontend saber o que houve
            print(f"ERRO PAY: {str(e)}") # Aparece no seu terminal do backend
            return Response({'error': str(e)}, status=400)

        except Exception as e:
            # Retorna o erro real para o frontend ver o que houve
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=400)

class StaffShiftViewSet(viewsets.ModelViewSet):
    queryset = StaffShift.objects.select_related('staff', 'location').all()
    serializer_class = StaffShiftSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('staff_id'): qs = qs.filter(staff_id=self.request.query_params.get('staff_id'))
        return qs

class StaffServiceViewSet(viewsets.ModelViewSet):
    queryset = StaffService.objects.select_related('staff', 'service').all()
    serializer_class = StaffServiceSerializer
    permission_classes = [permissions.AllowAny]
    
    @action(detail=False, methods=['delete'], url_path='delete-by-params')
    def delete_by_params(self, request):
        if not request.user.is_authenticated: return Response(status=401)
        try:
            StaffService.objects.get(staff_id=request.query_params.get('staff_id'), service_id=request.query_params.get('service_id')).delete()
            return Response(status=204)
        except: return Response(status=404)

class StaffExceptionViewSet(viewsets.ModelViewSet):
    queryset = StaffException.objects.all()
    serializer_class = StaffExceptionSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self): return StaffException.objects.select_related('staff').all().order_by('-start_date')
    
    def create(self, request, *args, **kwargs):
        if not request.user.is_authenticated: return Response(status=401)
        return super().create(request, *args, **kwargs)

class StaffCommissionViewSet(viewsets.ModelViewSet):
    queryset = StaffCommission.objects.select_related('staff', 'service', 'appointment').all().order_by('-date')
    serializer_class = StaffCommissionSerializer
    permission_classes = [permissions.IsAuthenticated]

class ReferralViewSet(viewsets.ModelViewSet):
    queryset = Referral.objects.select_related('referrer_customer', 'referred_customer').all()
    serializer_class = ReferralSerializer
    permission_classes = [permissions.AllowAny]
    
    @action(detail=True, methods=['post'], url_path='apply-reward')
    def apply_reward(self, request, pk=None):
        if not request.user.is_authenticated: return Response(status=401)
        try:
            instance = self.get_object(); instance.status = 'reward_used'; instance.save()
            return Response(self.get_serializer(instance).data)
        except: return Response(status=404)

# 🔥 NOVO: ViewSet de Cartões
class CreditCardViewSet(viewsets.ModelViewSet):
    queryset = CreditCard.objects.all()
    serializer_class = CreditCardSerializer
    permission_classes = [permissions.IsAuthenticated]

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all().order_by('-payment_date')
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if month and year:
            qs = qs.filter(payment_date__month=month, payment_date__year=year)
        return qs

    def perform_create(self, serializer):
        data = serializer.validated_data
        
        # Dados principais
        amount_total = data.get('amount_centavos')
        base_date = data.get('payment_date')
        description = data.get('description')
        card = data.get('card')
        tipo = data.get('type')
        installments = data.get('installments_total', 1) or 1
        
        # Pega account_id do request (não do serializer, pois não é campo do model Expense)
        account_id = self.request.data.get('account_id')

        # 1. LÓGICA DE TRANSFERÊNCIA (SANGRIA)
        # Se for transferência, a gente SOMA na conta destino e encerra.
        if tipo == 'transfer' and account_id:
            try:
                account = BankAccount.objects.get(id=account_id)
                account.balance_centavos += amount_total
                account.save()
                # Salva o registro como pago
                serializer.save(status='paid')
                return # Sai da função, não precisa fazer mais nada
            except BankAccount.DoesNotExist:
                raise ValidationError({"detail": "Conta bancária não encontrada."})

        # 2. VERIFICAÇÃO DE LIMITE DO CARTÃO
        if card:
            # Soma tudo que está pendente neste cartão
            used_limit = Expense.objects.filter(card=card, status='pending').aggregate(Sum('amount_centavos'))['amount_centavos__sum'] or 0
            
            # Se o gasto atual + o que já usou passar do limite -> BLOQUEIA
            if (used_limit + amount_total) > card.limit_centavos:
                disponivel = (card.limit_centavos - used_limit) / 100
                raise ValidationError({"detail": f"Limite insuficiente! Disponível: R$ {disponivel:.2f}"})

        # 3. LÓGICA DE PARCELAMENTO
        if installments > 1:
            # Calcula valor da parcela (arredondando para baixo)
            amount_per_installment = math.floor(amount_total / installments)
            remainder = amount_total - (amount_per_installment * installments)

            # --- SALVA A 1ª PARCELA (Objeto principal) ---
            status_inicial = 'pending' if card else data.get('status', 'paid')
            
            serializer.save(
                description=f"{description} (1/{installments})",
                amount_centavos=amount_per_installment + remainder, # Soma resto na 1ª
                installments_current=1,
                installments_total=installments,
                status=status_inicial
            )

            # --- CRIA AS PRÓXIMAS PARCELAS ---
            for i in range(1, installments):
                next_date = base_date + relativedelta(months=i)
                Expense.objects.create(
                    description=f"{description} ({i+1}/{installments})",
                    amount_centavos=amount_per_installment,
                    payment_date=next_date,
                    installments_current=i+1,
                    installments_total=installments,
                    status=status_inicial,
                    type=data.get('type', 'variable'),
                    category=data.get('category'), # Usa o objeto category
                    category_legacy=data.get('category_legacy'), # Usa o legacy preenchido
                    card=card
                )
        else:
            # Pagamento à Vista (1x)
            # Se for cartão, força PENDENTE. Se não, usa o que o usuário mandou.
            status_inicial = 'pending' if card else data.get('status', 'paid')
            serializer.save(status=status_inicial)

            # 4. DESCONTO DE SALDO (Pagamento à vista com dinheiro da conta)
            # Se não é cartão, nasceu 'pago' e tem conta vinculada -> Desconta do banco
            if not card and status_inicial == 'paid' and account_id:
                try:
                    account = BankAccount.objects.get(id=account_id)
                    account.balance_centavos -= amount_total
                    account.save()
                except BankAccount.DoesNotExist:
                    pass

    # 5. BAIXA DE PAGAMENTO (Pagar Fatura ou Despesa Pendente)
    def perform_update(self, serializer):
        instance = self.get_object()
        old_status = instance.status
        
        # Salva a alteração
        obj = serializer.save()
        
        new_status = obj.status
        account_id = self.request.data.get('account_id') # Vem do frontend no momento do pagamento

        # Se mudou de 'não pago' para 'pago' E tem uma conta para descontar
        if old_status != 'paid' and new_status == 'paid' and account_id:
            try:
                account = BankAccount.objects.get(id=account_id)
                account.balance_centavos -= obj.amount_centavos
                account.save()
            except BankAccount.DoesNotExist:
                pass
        
class RevenueByStaffReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response([])
class RevenueByLocationReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response([])
class RevenueByServiceReport(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response([])

class PromotionViewSet(viewsets.ModelViewSet):
    queryset = Promotion.objects.prefetch_related('items__service').filter(active=True).order_by('title')
    serializer_class = PromotionSerializer
    permission_classes = [permissions.AllowAny]

class TransactionCategoryViewSet(viewsets.ModelViewSet):
    queryset = TransactionCategory.objects.all().order_by('name')
    serializer_class = TransactionCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    # Filtro opcional: /api/categories/?type=expense
    def get_queryset(self):
        qs = super().get_queryset()
        type_filter = self.request.query_params.get('type')
        if type_filter:
            qs = qs.filter(type=type_filter)
        return qs
    
class FinancialDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        # Pega parâmetros ou usa mês atual
        start_date = request.query_params.get('start_date', today.replace(day=1))
        end_date = request.query_params.get('end_date', today)

        # 1. Receitas (Agendamentos completados)
        revenue = Appointment.objects.filter(
            start_time__date__range=[start_date, end_date],
            status='completed'
        ).aggregate(total=Coalesce(Sum('final_amount_centavos'), 0))['total']

        # 2. Despesas (Tabela Expenses)
        expenses_agg = Expense.objects.filter(
            payment_date__range=[start_date, end_date]
        ).aggregate(
            total=Coalesce(Sum('amount_centavos'), 0),
            fixed=Coalesce(Sum('amount_centavos', filter=Q(type='fixed')), 0),
            variable=Coalesce(Sum('amount_centavos', filter=Q(type='variable')), 0),
            paid=Coalesce(Sum('amount_centavos', filter=Q(status='paid')), 0),
            pending=Coalesce(Sum('amount_centavos', filter=Q(status='pending')), 0)
        )

        # 3. Comissões (StaffCommissions)
        commissions = StaffCommission.objects.filter(
            date__range=[start_date, end_date]
        ).aggregate(total=Coalesce(Sum('commission_amount_centavos'), 0))['total']

        total_costs = expenses_agg['total'] + commissions
        profit = revenue - total_costs

        return Response({
            "summary": {
                "revenue": revenue,
                "costs": total_costs,
                "profit": profit,
                "balance": profit # Pode ajustar se tiver saldo inicial
            },
            "details": {
                "expenses_fixed": expenses_agg['fixed'],
                "expenses_variable": expenses_agg['variable'],
                "expenses_paid": expenses_agg['paid'],
                "expenses_pending": expenses_agg['pending'],
                "commissions": commissions
            }
        })

class CashFlowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date:
            start_date = timezone.now().date() - timedelta(days=30)
            end_date = timezone.now().date() + timedelta(days=30)

        # 1. RECEITAS DE AGENDAMENTOS
        incomes = Appointment.objects.filter(
            start_time__date__range=[start_date, end_date],
            status__in=['confirmed', 'completed']
        ).annotate(
            val=Coalesce(F('final_amount_centavos'), F('service__price_centavos')),
            desc=F('service__name'),
            dt=F('start_time'),
            cli=F('customer__full_name')
        ).values('id', 'val', 'desc', 'dt', 'status', 'cli')

        # 2. LANÇAMENTOS MANUAIS (Despesas E Receitas Extras)
        manual_entries = Expense.objects.filter(
            payment_date__range=[start_date, end_date]
        ).annotate(
            val=F('amount_centavos'),
            desc=F('description'),
            dt=F('payment_date'),
            stat=F('status'),
            cat_name=F('category__name'),
            tipo=F('type') # 🔥 Importante para saber se é entrada ou saída
        ).values('id', 'val', 'desc', 'dt', 'stat', 'cat_name', 'tipo')

        # 3. COMISSÕES (Saídas Automáticas)
        commissions = StaffCommission.objects.filter(
            date__range=[start_date, end_date]
        ).annotate(
            val=F('commission_amount_centavos'),
            desc=F('staff__name'),
            dt=F('date'),
            stat=F('status')
        ).values('id', 'val', 'desc', 'dt', 'stat')

        transactions = []

        # Processa Agendamentos
        for i in incomes:
            transactions.append({
                "id": str(i['id']),
                "date": i['dt'],
                "description": f"{i['desc']} - {i['cli']}",
                "amount": i['val'],
                "type": "receita",
                "status": "realizado" if i['status'] == 'completed' else "previsto",
                "category": "Serviços",
                "source": "appointment"
            })
            
        # Processa Lançamentos Manuais
        for entry in manual_entries:
            # 🔥 Lógica Inteligente: Se for 'income', o valor é POSITIVO. Se for expense, NEGATIVO.
            amount = entry['val'] if entry['tipo'] == 'income' else (entry['val'] * -1)
            
            transactions.append({
                "id": str(entry['id']),
                "date": entry['dt'],
                "description": entry['desc'],
                "amount": amount,
                "type": "receita" if entry['tipo'] == 'income' else "despesa",
                "status": "realizado" if entry['stat'] == 'paid' else "previsto",
                "category": entry['cat_name'] or ("Receita Extra" if entry['tipo'] == 'income' else "Despesa"),
                "source": "expense"
            })

        # Processa Comissões
        for c in commissions:
            if c['stat'] != 'cancelado':
                transactions.append({
                    "id": str(c['id']),
                    "date": c['dt'],
                    "description": f"Comissão - {c['desc']}",
                    "amount": c['val'] * -1,
                    "type": "despesa",
                    "status": "realizado" if c['stat'] == 'pago' else "previsto",
                    "category": "Comissões",
                    "source": "commission"
                })

        transactions.sort(key=lambda x: str(x['date']))
        
        # Saldo Acumulado
        running_balance = 0
        for t in transactions:
            if t['status'] == 'realizado':
                running_balance += t['amount']
            t['accumulated_balance'] = running_balance
        
        return Response(transactions)
    
class BankAccountViewSet(viewsets.ModelViewSet):
    queryset = BankAccount.objects.all()
    serializer_class = BankAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

class PartnerViewSet(viewsets.ModelViewSet):
    queryset = Partner.objects.filter(active=True)
    serializer_class = PartnerSerializer
    permission_classes = [permissions.AllowAny]