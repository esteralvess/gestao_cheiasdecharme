import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, DollarSign, Plus, Trash2, Pencil, TrendingUp, Clock, FileDown, ArrowUp, ArrowDown } from "lucide-react";
import { appointmentsAPI, servicesAPI, staffAPI, locationsAPI, expensesAPI, staffCommissionsAPI } from "@/services/api";
import { addDays, format, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

// --- Tipagem de Dados ---
interface Appointment { id: string; customer_name: string; service_name: string; staff_name: string; start_time: string; status: "completed"; service: string; staff: string; location: string; payment_method?: 'pix' | 'credito' | 'debito' | 'dinheiro' | 'outros'; discount_centavos?: number; final_amount_centavos?: number; }
interface Service { id: string; name: string; price_centavos?: number; }
interface Staff { id: string; name: string; default_commission_percentage?: number; }
interface Location { id: string; name: string; }
interface Expense { id: string; description: string; category: string; amount_centavos: number; payment_date: string; notes?: string; }
interface StaffCommission { id: string; date: string; status: 'pendente_pagamento' | 'pago' | 'cancelado'; commission_amount_centavos: number; }
interface ProcessedPayment { id: string; appointmentId: string; customerName: string; serviceName: string; amount: number; paymentDate: Date; commission: number; paymentMethod: 'pix' | 'credito' | 'debito' | 'dinheiro' | 'outros'; }

// --- Componente Auxiliar para Variação Percentual ---
function PercentageChange({ current, previous }: { current: number; previous: number }) {
    if (previous === 0) {
        if (current > 0) return <div className="flex items-center text-xs text-emerald-600"><ArrowUp className="w-4 h-4 mr-1" />Inf%</div>;
        return <div className="text-xs text-muted-foreground">-</div>;
    }
    const change = ((current - previous) / previous) * 100;
    const isPositive = change >= 0;

    return (
        <div className={`flex items-center text-xs ${isPositive ? 'text-emerald-600' : 'text-destructive'}`}>
            {isPositive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
            {change.toFixed(1)}%
        </div>
    );
}

// --- Funções Auxiliares ---
const getPreviousDateRange = (range: DateRange | undefined): DateRange | undefined => {
    if (!range?.from) return undefined;
    const to = range.to ?? range.from;
    const duration = differenceInDays(to, range.from);
    const prev_to = subDays(range.from, 1);
    const prev_from = subDays(prev_to, duration);
    return { from: prev_from, to: prev_to };
}

// --- Modal de Despesas ---
// ... (O código do Modal de Despesas permanece o mesmo)
function ExpenseModal({ expense, onClose, onSave, isSaving }: any) { const isNew = !expense?.id; const [formData, setFormData] = useState({ description: '', category: 'outros', amount_reais: '0', payment_date: format(new Date(), 'yyyy-MM-dd'), notes: '' }); useEffect(() => { if (expense) { setFormData({ description: expense.description || '', category: expense.category || 'outros', amount_reais: expense.amount_centavos ? (expense.amount_centavos / 100).toFixed(2) : '0', payment_date: expense.payment_date || format(new Date(), 'yyyy-MM-dd'), notes: expense.notes || '', }); } }, [expense]); if (!expense) return null; const handleSave = () => { const amount_centavos = Math.round(parseFloat(formData.amount_reais.replace(',', '.')) * 100); const { amount_reais, ...dataToSend } = formData; onSave({ ...expense, ...dataToSend, amount_centavos }); }; return (<Dialog open={!!expense} onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>{isNew ? 'Registrar Nova Despesa' : 'Editar Despesa'}</DialogTitle></DialogHeader><div className="py-4 space-y-4"><div><Label>Descrição</Label><Input value={formData.description} onChange={e => setFormData(f => ({...f, description: e.target.value}))}/></div><div><Label>Categoria</Label><Select value={formData.category} onValueChange={(v) => setFormData(f => ({...f, category: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="aluguel">Aluguel</SelectItem><SelectItem value="produtos">Produtos/Estoque</SelectItem><SelectItem value="salarios">Salários/Pró-labore</SelectItem><SelectItem value="marketing">Marketing</SelectItem><SelectItem value="contas">Contas (Água, Luz, Internet)</SelectItem><SelectItem value="impostos">Impostos e Taxas</SelectItem><SelectItem value="outros">Outros</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={formData.amount_reais} onChange={e => setFormData(f => ({...f, amount_reais: e.target.value}))}/></div><div><Label>Data do Pagamento</Label><Input type="date" value={formData.payment_date} onChange={e => setFormData(f => ({...f, payment_date: e.target.value}))}/></div></div><div><Label>Notas</Label><Textarea value={formData.notes} onChange={e => setFormData(f => ({...f, notes: e.target.value}))}/></div></div><DialogFooter><Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button><Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar'}</Button></DialogFooter></DialogContent></Dialog>); }

// ===============================================
// COMPONENTE PRINCIPAL DA PÁGINA
// ===============================================
export default function Payments() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: startOfDay(new Date()) });
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [editingExpense, setEditingExpense] = useState<Partial<Expense> | null>(null);

  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<Appointment[]>({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: staff = [] } = useQuery<Staff[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });
  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery<Expense[]>({ queryKey: ['expenses'], queryFn: expensesAPI.getAll });
  const { data: commissions = [], isLoading: isLoadingCommissions } = useQuery<StaffCommission[]>({ queryKey: ['staffCommissions'], queryFn: staffCommissionsAPI.getAll });

  const isLoading = isLoadingAppointments || isLoadingExpenses || isLoadingCommissions;

  // Mutations (sem alterações)
  const saveExpenseMutation = useMutation({ mutationFn: (data: Partial<Expense>) => { const { id, ...payload } = data; return id ? expensesAPI.update(id, payload) : expensesAPI.create(payload) }, onSuccess: () => { toast.success("Despesa salva com sucesso!"); setEditingExpense(null); queryClient.invalidateQueries({ queryKey: ['expenses'] }); }, onError: (error: any) => toast.error(error.message || "Erro ao salvar despesa."), });
  const deleteExpenseMutation = useMutation({ mutationFn: (id: string) => expensesAPI.delete(id), onSuccess: () => { toast.success("Despesa excluída com sucesso!"); queryClient.invalidateQueries({ queryKey: ['expenses'] }); }, onError: (error: any) => toast.error(error.message || "Erro ao excluir despesa."), });
  
  // --- LÓGICA DE CÁLCULO DE DADOS ---
  const { currentFinancials, previousFinancials, filteredData, revenueChartData, expensesByCategoryChartData } = useMemo(() => {
    const serviceMap = new Map(services.map(s => [s.id, s.price_centavos || 0]));
    const staffMap = new Map(staff.map(s => [s.id, s.default_commission_percentage || 0]));
    
    const previousDateRange = getPreviousDateRange(dateRange);

    const calculateMetrics = (range: DateRange | undefined) => {
        const filteredPayments = appointments.filter(apt => {
            if(apt.status !== 'completed') return false;
            const paymentDate = new Date(apt.start_time);
            return range?.from && range?.to ? paymentDate >= range.from && paymentDate <= addDays(range.to, 1) : true;
        }).map((apt): ProcessedPayment => ({
            id: apt.id, appointmentId: apt.id, customerName: apt.customer_name, serviceName: apt.service_name, amount: apt.final_amount_centavos ?? serviceMap.get(apt.service) ?? 0, paymentDate: new Date(apt.start_time), commission: ((apt.final_amount_centavos ?? serviceMap.get(apt.service) ?? 0) * (staffMap.get(apt.staff) || 0)) / 100, paymentMethod: apt.payment_method || 'pix',
        }));

        const filteredExpenses = expenses.filter(exp => {
            const paymentDate = new Date(exp.payment_date + 'T12:00:00');
            return range?.from && range?.to ? paymentDate >= range.from && paymentDate <= addDays(range.to, 1) : true;
        });

        const filteredCommissions = commissions.filter(com => {
            const commissionDate = new Date(com.date + 'T12:00:00');
            return range?.from && range?.to ? commissionDate >= range.from && commissionDate <= addDays(range.to, 1) : true;
        });

        const totalFaturamento = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalDespesas = filteredExpenses.reduce((sum, e) => sum + e.amount_centavos, 0);
        const totalCommissionsPaid = filteredCommissions.filter(c => c.status === 'pago').reduce((sum, c) => sum + c.commission_amount_centavos, 0);
        const totalCommissionsPending = filteredCommissions.filter(c => c.status === 'pendente_pagamento').reduce((sum, c) => sum + c.commission_amount_centavos, 0);
        const lucro = totalFaturamento - totalCommissionsPaid - totalDespesas;
        
        return { totalFaturamento, totalDespesas, totalCommissionsPaid, totalCommissionsPending, lucro, payments: filteredPayments, expenses: filteredExpenses };
    };
    
    const currentFinancials = calculateMetrics(dateRange);
    const previousFinancials = calculateMetrics(previousDateRange);
    
    const filteredPaymentsForUI = currentFinancials.payments.filter(p => (staffFilter === 'all' || p.appointmentId && appointments.find(a => a.id === p.appointmentId)?.staff === staffFilter) && (locationFilter === 'all' || p.appointmentId && appointments.find(a => a.id === p.appointmentId)?.location === locationFilter));
    const filteredData = { payments: filteredPaymentsForUI, expenses: currentFinancials.expenses };

    const revenueChartData = Array.from(filteredPaymentsForUI.reduce((acc, p) => {
        const day = format(p.paymentDate, 'dd/MM');
        acc.set(day, (acc.get(day) || 0) + p.amount);
        return acc;
    }, new Map<string, number>())).map(([name, faturamento]) => ({ name, Faturamento: faturamento / 100 })).sort((a,b) => a.name.localeCompare(b.name));

    const expensesByCategoryChartData = Array.from(currentFinancials.expenses.reduce((acc, e) => {
        const category = e.category.charAt(0).toUpperCase() + e.category.slice(1);
        acc.set(category, (acc.get(category) || 0) + e.amount_centavos);
        return acc;
    }, new Map<string, number>())).map(([name, value]) => ({ name, value: value / 100 }));

    return { currentFinancials, previousFinancials, filteredData, revenueChartData, expensesByCategoryChartData };
  }, [dateRange, appointments, services, staff, expenses, commissions, staffFilter, locationFilter]);
  
  // Funções de Filtro e Exportação
  const setDateToToday = () => { const today = startOfDay(new Date()); setDateRange({ from: today, to: today }); };
  const setDateToThisWeek = () => { const today = new Date(); setDateRange({ from: startOfWeek(today, { locale: ptBR }), to: endOfWeek(today, { locale: ptBR }) }); };
  const setDateToThisMonth = () => { const today = new Date(); setDateRange({ from: startOfMonth(today), to: endOfMonth(today) }); };

  const handleExportCSV = () => {
    let csvContent = "Data,Tipo,Descricao,Categoria/Cliente,Valor\n";
    filteredData.payments.forEach(p => {
        const row = [format(p.paymentDate, 'yyyy-MM-dd'),'Receita',p.serviceName, p.customerName.replace(/,/g, ''), (p.amount / 100).toFixed(2)].join(',');
        csvContent += row + "\n";
    });
    filteredData.expenses.forEach(e => {
        const row = [e.payment_date,'Despesa',e.description.replace(/,/g, ''), e.category, (-e.amount_centavos / 100).toFixed(2)].join(',');
        csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_financeiro_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório exportado com sucesso!");
  };
  
  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <div className="p-6 space-y-6">
      <ExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} onSave={saveExpenseMutation.mutate} isSaving={saveExpenseMutation.isPending} />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Financeiro</h1>
          <p className="text-muted-foreground">Visão geral de pagamentos, despesas e lucro</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
            <FileDown className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button id="date" variant={"outline"} className="w-[300px] justify-start text-left font-normal" >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? ( dateRange.to ? ( <> {format(dateRange.from, "LLL dd, y", { locale: ptBR })} -{" "} {format(dateRange.to, "LLL dd, y", { locale: ptBR })} </> ) : ( format(dateRange.from, "LLL dd, y", { locale: ptBR }) ) ) : ( <span>Escolha um período</span> )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} />
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={setDateToToday}>Hoje</Button>
            <Button variant="outline" size="sm" onClick={setDateToThisWeek}>Esta Semana</Button>
            <Button variant="outline" size="sm" onClick={setDateToThisMonth}>Este Mês</Button>
        </div>
        <div className="flex-grow flex items-center gap-2 justify-end">
            <Select value={staffFilter} onValueChange={setStaffFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Profissional" /></SelectTrigger><SelectContent><SelectItem value="all">Todos Profissionais</SelectItem>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Unidade" /></SelectTrigger><SelectContent><SelectItem value="all">Todas Unidades</SelectItem>{locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      
      {isLoading ? (
        <div className="space-y-6 mt-6">
            <Skeleton className="h-[320px] w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Skeleton className="h-[124px] w-full" />
                <Skeleton className="h-[124px] w-full" />
                <Skeleton className="h-[124px] w-full" />
                <Skeleton className="h-[124px] w-full" />
            </div>
            <Skeleton className="h-[108px] w-full" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="transactions">Transações</TabsTrigger>
              <TabsTrigger value="expenses">Despesas</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-6 mt-6">
              <Card><CardHeader><CardTitle>Desempenho do Faturamento no Período</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><BarChart data={revenueChartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} /><YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(value) => `R$ ${value}`} /><Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Faturamento"]} cursor={{ fill: "hsl(var(--muted))" }} /><Bar dataKey="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="p-4 flex flex-col justify-between"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Faturamento Bruto</p><p className="text-2xl font-bold text-foreground">R$ {(currentFinancials.totalFaturamento / 100).toFixed(2)}</p></div><PercentageChange current={currentFinancials.totalFaturamento} previous={previousFinancials.totalFaturamento} /></div><p className="text-xs text-muted-foreground mt-2">Período anterior: R$ {(previousFinancials.totalFaturamento / 100).toFixed(2)}</p></Card>
                  <Card onClick={() => setLocation('/staff?tab=commissions&status=pago')} className="p-4 flex flex-col justify-between cursor-pointer group hover:bg-muted/50 transition-colors" title="Clique para ver detalhes"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Comissões Pagas</p><p className="text-2xl font-bold text-amber-600">- R$ {(currentFinancials.totalCommissionsPaid / 100).toFixed(2)}</p></div><PercentageChange current={currentFinancials.totalCommissionsPaid} previous={previousFinancials.totalCommissionsPaid} /></div><p className="text-xs text-muted-foreground mt-2">Período anterior: R$ {(previousFinancials.totalCommissionsPaid / 100).toFixed(2)}</p></Card>
                  <Card className="p-4 flex flex-col justify-between"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Despesas</p><p className="text-2xl font-bold text-destructive">- R$ {(currentFinancials.totalDespesas / 100).toFixed(2)}</p></div><PercentageChange current={currentFinancials.totalDespesas} previous={previousFinancials.totalDespesas} /></div><p className="text-xs text-muted-foreground mt-2">Período anterior: R$ {(previousFinancials.totalDespesas / 100).toFixed(2)}</p></Card>
                  <Card className="p-4 flex flex-col justify-between"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Lucro Líquido</p><p className="text-2xl font-bold text-emerald-600">R$ {(currentFinancials.lucro / 100).toFixed(2)}</p></div><PercentageChange current={currentFinancials.lucro} previous={previousFinancials.lucro} /></div><p className="text-xs text-muted-foreground mt-2">Período anterior: R$ {(previousFinancials.lucro / 100).toFixed(2)}</p></Card>
              </div>
              <Card onClick={() => setLocation('/staff?tab=commissions&status=pendente_pagamento')} className="p-6 bg-blue-500/5 border-blue-500/20 cursor-pointer group hover:border-blue-500/50 transition-colors" title="Clique para ver detalhes"><div className="flex items-center gap-3"><div className="p-3 bg-blue-500/10 rounded-lg"><Clock className="w-6 h-6 text-blue-600" /></div><div><p className="text-sm text-blue-800/80">Comissões a Pagar (Geradas no Período)</p><p className="text-2xl font-bold text-blue-800">R$ {(currentFinancials.totalCommissionsPending / 100).toFixed(2)}</p></div></div></Card>
          </TabsContent>
          <TabsContent value="transactions"><Card><Table><TableHeader><TableRow><TableHead className="w-[120px]">Data</TableHead><TableHead>Cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{filteredData.payments.length > 0 ? (filteredData.payments.map(payment => (<TableRow key={payment.id}><TableCell>{format(payment.paymentDate, 'dd/MM/yyyy')}</TableCell><TableCell className="font-medium">{payment.customerName}</TableCell><TableCell>{payment.serviceName}</TableCell><TableCell className="capitalize">{payment.paymentMethod}</TableCell><TableCell className="text-right font-semibold">R$ {(payment.amount / 100).toFixed(2)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={5} className="text-center h-24">Nenhuma transação encontrada para os filtros aplicados.</TableCell></TableRow>)}</TableBody><TableFooter><TableRow><TableCell colSpan={4} className="font-bold text-lg">Total Faturado</TableCell><TableCell className="text-right font-bold text-lg text-primary">R$ {(currentFinancials.totalFaturamento / 100).toFixed(2)}</TableCell></TableRow></TableFooter></Table></Card></TabsContent>
          <TabsContent value="expenses" className="space-y-6"><Card><CardHeader><CardTitle>Distribuição de Despesas por Categoria</CardTitle></CardHeader><CardContent>{expensesByCategoryChartData.length > 0 ? (<ResponsiveContainer width="100%" height={250}><PieChart><Pie data={expensesByCategoryChartData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{expensesByCategoryChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} /><Legend /></PieChart></ResponsiveContainer>) : (<div className="text-center py-10 text-muted-foreground"><p>Nenhuma despesa registrada para exibir o gráfico.</p></div>)}</CardContent></Card><div className="flex justify-end"><Button onClick={() => setEditingExpense({})}><Plus className="w-4 h-4 mr-2"/>Registrar Despesa</Button></div><Card><Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-[100px]"></TableHead></TableRow></TableHeader><TableBody>{isLoadingExpenses ? (<TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>) : filteredData.expenses.length > 0 ? (filteredData.expenses.map(exp => (<TableRow key={exp.id}><TableCell className="font-medium">{exp.description}</TableCell><TableCell className="capitalize">{exp.category}</TableCell><TableCell>{format(new Date(exp.payment_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell><TableCell className="text-right">R$ {(exp.amount_centavos / 100).toFixed(2)}</TableCell><TableCell className="text-right"><div className="flex justify-end"><Button variant="ghost" size="icon" onClick={() => setEditingExpense(exp)}><Pencil className="w-4 h-4"/></Button><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteExpenseMutation.mutate(exp.id)}><Trash2 className="w-4 h-4"/></Button></div></TableCell></TableRow>))) : (<TableRow><TableCell colSpan={5} className="text-center h-24">Nenhuma despesa registrada neste período.</TableCell></TableRow>)}</TableBody></Table></Card></TabsContent>
        </Tabs>
      )}
    </div>
  );
}