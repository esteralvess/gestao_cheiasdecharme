import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { 
  Calendar as CalendarIcon, 
  DollarSign, 
  Plus, 
  Trash2, 
  Pencil, 
  TrendingUp, 
  Clock, 
  FileDown, 
  ArrowUp, 
  ArrowDown, 
  Wallet, 
  PieChart as PieChartIcon,
  BarChart3,
  Landmark,
  Receipt
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

// --- Tipagem de Dados ---
interface Appointment { id: string; customer_name: string; service_name: string; staff_name: string; start_time: string; status: "completed"; service: string; staff: string; location: string; payment_method?: 'pix' | 'credito' | 'debito' | 'dinheiro' | 'outros'; discount_centavos?: number; final_amount_centavos?: number; }
interface Service { id: string; name: string; price_centavos?: number; }
interface Staff { id: string; name: string; default_commission_percentage?: number; }
interface Location { id: string; name: string; }
interface Expense { 
  id: string; 
  description: string; 
  category: string; 
  amount_centavos: number; 
  payment_date: string; 
  notes?: string; 
  type: 'fixed' | 'variable'; // ✅ Novo campo: Fixa ou Variável
}
interface StaffCommission { id: string; date: string; status: 'pendente_pagamento' | 'pago' | 'cancelado'; commission_amount_centavos: number; staff_id: string; }
interface ProcessedPayment { id: string; appointmentId: string; customerName: string; serviceName: string; amount: number; paymentDate: Date; commission: number; paymentMethod: 'pix' | 'credito' | 'debito' | 'dinheiro' | 'outros'; }

// --- Componente Auxiliar para Variação Percentual ---
function PercentageChange({ current, previous }: { current: number; previous: number }) {
    if (previous === 0) {
        if (current > 0) return <div className="flex items-center text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full"><ArrowUp className="w-3 h-3 mr-1" />Inf%</div>;
        return <div className="text-xs text-muted-foreground">-</div>;
    }
    const change = ((current - previous) / previous) * 100;
    const isPositive = change >= 0;

    return (
        <div className={`flex items-center text-xs px-1.5 py-0.5 rounded-full ${isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
            {isPositive ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
            {Math.abs(change).toFixed(1)}%
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

// --- Modal de Despesas (Atualizado com Tipo) ---
function ExpenseModal({ expense, onClose, onSave, isSaving }: any) { 
    const isNew = !expense?.id; 
    const [formData, setFormData] = useState({ 
        description: '', 
        category: 'outros', 
        type: 'variable' as 'fixed' | 'variable', // Padrão Variável
        amount_reais: '0', 
        payment_date: format(new Date(), 'yyyy-MM-dd'), 
        notes: '' 
    }); 

    useEffect(() => { 
        if (expense) { 
            setFormData({ 
                description: expense.description || '', 
                category: expense.category || 'outros', 
                type: expense.type || 'variable',
                amount_reais: expense.amount_centavos ? (expense.amount_centavos / 100).toFixed(2) : '0', 
                payment_date: expense.payment_date || format(new Date(), 'yyyy-MM-dd'), 
                notes: expense.notes || '', 
            }); 
        } 
    }, [expense]); 

    if (!expense) return null; 

    const handleSave = () => { 
        const amount_centavos = Math.round(parseFloat(formData.amount_reais.replace(',', '.')) * 100); 
        const { amount_reais, ...dataToSend } = formData; 
        onSave({ ...expense, ...dataToSend, amount_centavos }); 
    }; 

    return (
        <Dialog open={!!expense} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
                <DialogHeader>
                    <DialogTitle className="text-stone-800 dark:text-stone-100">{isNew ? 'Registrar Nova Despesa' : 'Editar Despesa'}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                             <Label>Tipo de Despesa</Label>
                             <div className="flex items-center gap-2 p-1 bg-stone-100 dark:bg-stone-900 rounded-lg">
                                <Button 
                                    type="button" 
                                    variant={formData.type === 'fixed' ? 'default' : 'ghost'} 
                                    size="sm" 
                                    className={`flex-1 ${formData.type === 'fixed' ? 'bg-stone-700' : 'text-stone-500'}`}
                                    onClick={() => setFormData(f => ({...f, type: 'fixed'}))}
                                >
                                    Fixa
                                </Button>
                                <Button 
                                    type="button" 
                                    variant={formData.type === 'variable' ? 'default' : 'ghost'} 
                                    size="sm" 
                                    className={`flex-1 ${formData.type === 'variable' ? 'bg-[#C6A87C] hover:bg-[#B08D55]' : 'text-stone-500'}`}
                                    onClick={() => setFormData(f => ({...f, type: 'variable'}))}
                                >
                                    Variável
                                </Button>
                             </div>
                         </div>
                         <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Select value={formData.category} onValueChange={(v) => setFormData(f => ({...f, category: v}))}>
                                <SelectTrigger className="bg-stone-50 border-stone-200"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="aluguel">Aluguel (Fixa)</SelectItem>
                                    <SelectItem value="contas">Contas - Água/Luz (Fixa)</SelectItem>
                                    <SelectItem value="salarios">Salários/Equipe</SelectItem>
                                    <SelectItem value="produtos">Produtos/Estoque</SelectItem>
                                    <SelectItem value="marketing">Marketing</SelectItem>
                                    <SelectItem value="impostos">Impostos</SelectItem>
                                    <SelectItem value="manutencao">Manutenção</SelectItem>
                                    <SelectItem value="outros">Outros</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input value={formData.description} onChange={e => setFormData(f => ({...f, description: e.target.value}))} className="bg-stone-50 border-stone-200"/>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Valor (R$)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-medium">R$</span>
                                <Input type="number" step="0.01" className="pl-9 bg-stone-50 border-stone-200 font-bold text-lg" value={formData.amount_reais} onChange={e => setFormData(f => ({...f, amount_reais: e.target.value}))}/>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Data do Pagamento</Label>
                            <Input type="date" value={formData.payment_date} onChange={e => setFormData(f => ({...f, payment_date: e.target.value}))} className="bg-stone-50 border-stone-200"/>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea value={formData.notes} onChange={e => setFormData(f => ({...f, notes: e.target.value}))} className="bg-stone-50 border-stone-200 resize-none h-20"/>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold">{isSaving ? 'Salvando...' : 'Salvar Despesa'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    ); 
}

// ===============================================
// COMPONENTE PRINCIPAL DA PÁGINA
// ===============================================
export default function Payments() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [editingExpense, setEditingExpense] = useState<Partial<Expense> | null>(null);

  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<Appointment[]>({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: staff = [] } = useQuery<Staff[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });
  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery<Expense[]>({ queryKey: ['expenses'], queryFn: expensesAPI.getAll });
  const { data: commissions = [] } = useQuery<StaffCommission[]>({ queryKey: ['staffCommissions'], queryFn: staffCommissionsAPI.getAll });

  const isLoading = isLoadingAppointments || isLoadingExpenses;

  // Mutations
  const saveExpenseMutation = useMutation({ mutationFn: (data: Partial<Expense>) => { const { id, ...payload } = data; return id ? expensesAPI.update(id, payload) : expensesAPI.create(payload) }, onSuccess: () => { toast.success("Despesa salva com sucesso!"); setEditingExpense(null); queryClient.invalidateQueries({ queryKey: ['expenses'] }); }, onError: (error: any) => toast.error(error.message || "Erro ao salvar despesa."), });
  const deleteExpenseMutation = useMutation({ mutationFn: (id: string) => expensesAPI.delete(id), onSuccess: () => { toast.success("Despesa excluída!"); queryClient.invalidateQueries({ queryKey: ['expenses'] }); }, onError: (error: any) => toast.error("Erro ao excluir."), });
  
  // --- LÓGICA DE CÁLCULO DE DADOS ---
  const { currentFinancials, previousFinancials, filteredData, revenueChartData, expensesByTypeData } = useMemo(() => {
    const serviceMap = new Map(services.map(s => [s.id, s.price_centavos || 0]));
    const previousDateRange = getPreviousDateRange(dateRange);

    const calculateMetrics = (range: DateRange | undefined) => {
        // Receitas (Agendamentos Completos)
        const filteredPayments = appointments.filter(apt => {
            if(apt.status !== 'completed') return false;
            const paymentDate = new Date(apt.start_time);
            return range?.from && range?.to ? paymentDate >= range.from && paymentDate <= addDays(range.to, 1) : true;
        }).map((apt): ProcessedPayment => ({
            id: apt.id, appointmentId: apt.id, customerName: apt.customer_name, serviceName: apt.service_name, amount: apt.final_amount_centavos ?? serviceMap.get(apt.service) ?? 0, paymentDate: new Date(apt.start_time), commission: 0, paymentMethod: apt.payment_method || 'pix',
        }));

        // Despesas (Fixas e Variáveis)
        const filteredExpenses = expenses.filter(exp => {
            const paymentDate = new Date(exp.payment_date + 'T12:00:00');
            return range?.from && range?.to ? paymentDate >= range.from && paymentDate <= addDays(range.to, 1) : true;
        });

        // Comissões (Consideradas Custo Variável de Pessoal)
        const filteredCommissions = commissions.filter(com => {
            const commissionDate = new Date(com.date + 'T12:00:00');
            const isPaid = com.status === 'pago';
            return isPaid && (range?.from && range?.to ? commissionDate >= range.from && commissionDate <= addDays(range.to, 1) : true);
        });

        const totalFaturamento = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
        
        const totalDespesasFixas = filteredExpenses.filter(e => e.type === 'fixed').reduce((sum, e) => sum + e.amount_centavos, 0);
        const totalDespesasVariaveis = filteredExpenses.filter(e => e.type === 'variable').reduce((sum, e) => sum + e.amount_centavos, 0);
        
        const totalComissoesPagas = filteredCommissions.reduce((sum, c) => sum + c.commission_amount_centavos, 0);

        // Lucro Líquido = Faturamento - (Fixas + Variáveis + Comissões)
        const lucro = totalFaturamento - (totalDespesasFixas + totalDespesasVariaveis + totalComissoesPagas);
        
        return { 
            totalFaturamento, 
            totalDespesasFixas, 
            totalDespesasVariaveis, 
            totalComissoesPagas,
            totalCustos: totalDespesasFixas + totalDespesasVariaveis + totalComissoesPagas,
            lucro, 
            payments: filteredPayments, 
            expenses: filteredExpenses 
        };
    };
    
    const currentFinancials = calculateMetrics(dateRange);
    const previousFinancials = calculateMetrics(previousDateRange);
    
    // Gráfico de Barras (Receita)
    const revenueChartData = Array.from(currentFinancials.payments.reduce((acc, p) => {
        const day = format(p.paymentDate, 'dd/MM');
        acc.set(day, (acc.get(day) || 0) + p.amount);
        return acc;
    }, new Map<string, number>())).map(([name, value]) => ({ name, Faturamento: value / 100 })).sort((a,b) => a.name.localeCompare(b.name));

    // Gráfico de Rosca (Fixas vs Variáveis vs Comissões)
    const expensesByTypeData = [
        { name: 'Despesas Fixas', value: currentFinancials.totalDespesasFixas / 100, color: '#374151' }, // stone-700
        { name: 'Despesas Variáveis', value: currentFinancials.totalDespesasVariaveis / 100, color: '#C6A87C' }, // Dourado
        { name: 'Comissões', value: currentFinancials.totalComissoesPagas / 100, color: '#F59E0B' }, // Amber
    ].filter(i => i.value > 0);

    return { currentFinancials, previousFinancials, filteredData: currentFinancials, revenueChartData, expensesByTypeData };
  }, [dateRange, appointments, services, expenses, commissions]);
  
  // Funções de Filtro
  const setDateToToday = () => { const today = startOfDay(new Date()); setDateRange({ from: today, to: today }); };
  const setDateToThisMonth = () => { const today = new Date(); setDateRange({ from: startOfMonth(today), to: endOfMonth(today) }); };

  const handleExportCSV = () => {
    let csvContent = "Data,Tipo,Descricao,Categoria,Valor\n";
    filteredData.payments.forEach(p => csvContent += `${format(p.paymentDate, 'yyyy-MM-dd')},Receita,${p.serviceName},${p.paymentMethod},${(p.amount / 100).toFixed(2)}\n`);
    filteredData.expenses.forEach(e => csvContent += `${e.payment_date},Despesa,${e.description},${e.category},${(-e.amount_centavos / 100).toFixed(2)}\n`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `financeiro_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };
  
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans">
      <ExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} onSave={saveExpenseMutation.mutate} isSaving={saveExpenseMutation.isPending} />
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <DollarSign className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Financeiro
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">
            Fluxo de caixa, despesas e lucratividade.
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} className="border-stone-200">
                <FileDown className="w-4 h-4 mr-2" /> Exportar
            </Button>
            <Button onClick={() => setEditingExpense({})} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white shadow-md">
                <Plus className="w-4 h-4 mr-2" /> Nova Despesa
            </Button>
        </div>
      </div>

      {/* FILTROS DE DATA */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
        <Popover>
          <PopoverTrigger asChild>
            <Button id="date" variant={"ghost"} className="w-[260px] justify-start text-left font-normal bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800" >
              <CalendarIcon className="mr-2 h-4 w-4 text-[#C6A87C]" />
              {dateRange?.from ? ( dateRange.to ? ( <> {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")} </> ) : ( format(dateRange.from, "dd/MM/yyyy") ) ) : ( <span>Selecione o período</span> )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} />
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={setDateToToday} className="text-stone-500 hover:text-[#C6A87C]">Hoje</Button>
            <Button variant="ghost" size="sm" onClick={setDateToThisMonth} className="text-stone-500 hover:text-[#C6A87C]">Este Mês</Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="space-y-6 mt-6">
            <Skeleton className="h-[320px] w-full" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6"><Skeleton className="h-32"/><Skeleton className="h-32"/><Skeleton className="h-32"/><Skeleton className="h-32"/></div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-1 rounded-xl h-auto w-full md:w-auto grid grid-cols-3 md:flex">
              <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white"><BarChart3 className="w-4 h-4 mr-2"/> Visão Geral</TabsTrigger>
              <TabsTrigger value="transactions" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white"><Receipt className="w-4 h-4 mr-2"/> Transações</TabsTrigger>
              <TabsTrigger value="expenses" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white"><Landmark className="w-4 h-4 mr-2"/> Despesas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
              {/* CARDS DE KPI */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-stone-100 shadow-sm bg-white">
                      <CardHeader className="pb-2"><p className="text-xs text-stone-400 uppercase font-bold tracking-wider">Faturamento Bruto</p></CardHeader>
                      <CardContent>
                          <div className="flex justify-between items-center">
                             <p className="text-2xl font-bold text-stone-800">R$ {(currentFinancials.totalFaturamento / 100).toFixed(2)}</p>
                             <PercentageChange current={currentFinancials.totalFaturamento} previous={previousFinancials.totalFaturamento} />
                          </div>
                      </CardContent>
                  </Card>
                  <Card className="border-stone-100 shadow-sm bg-white">
                      <CardHeader className="pb-2"><p className="text-xs text-stone-400 uppercase font-bold tracking-wider">Custos Totais</p></CardHeader>
                      <CardContent>
                          <div className="flex justify-between items-center">
                             <p className="text-2xl font-bold text-red-500">- R$ {(currentFinancials.totalCustos / 100).toFixed(2)}</p>
                             <PercentageChange current={currentFinancials.totalCustos} previous={previousFinancials.totalCustos} />
                          </div>
                          <p className="text-[10px] text-stone-400 mt-1">Inclui Comissões + Despesas</p>
                      </CardContent>
                  </Card>
                  <Card className="border-stone-100 shadow-sm bg-white">
                      <CardHeader className="pb-2"><p className="text-xs text-stone-400 uppercase font-bold tracking-wider">Lucro Líquido</p></CardHeader>
                      <CardContent>
                          <div className="flex justify-between items-center">
                             <p className="text-2xl font-bold text-emerald-600">R$ {(currentFinancials.lucro / 100).toFixed(2)}</p>
                             <PercentageChange current={currentFinancials.lucro} previous={previousFinancials.lucro} />
                          </div>
                          <p className="text-[10px] text-stone-400 mt-1">Margem: {currentFinancials.totalFaturamento > 0 ? ((currentFinancials.lucro / currentFinancials.totalFaturamento) * 100).toFixed(1) : 0}%</p>
                      </CardContent>
                  </Card>
                  {/* CARD DE DETALHE DE CUSTOS */}
                  <Card className="border-stone-100 shadow-sm bg-stone-50/50">
                      <CardContent className="pt-6 space-y-2">
                          <div className="flex justify-between text-xs"><span className="text-stone-500">Fixas (Aluguel, etc)</span><span className="font-bold text-stone-700">R$ {(currentFinancials.totalDespesasFixas/100).toFixed(2)}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-stone-500">Variáveis</span><span className="font-bold text-[#C6A87C]">R$ {(currentFinancials.totalDespesasVariaveis/100).toFixed(2)}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-stone-500">Comissões Pagas</span><span className="font-bold text-amber-500">R$ {(currentFinancials.totalComissoesPagas/100).toFixed(2)}</span></div>
                      </CardContent>
                  </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* GRÁFICO DE BARRAS (FATURAMENTO) */}
                 <Card className="col-span-2 border-stone-100 shadow-sm">
                    <CardHeader><CardTitle className="text-lg">Fluxo de Receita Diária</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={revenueChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                                <Tooltip cursor={{ fill: '#f5f5f4' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="Faturamento" fill="#C6A87C" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                 </Card>

                 {/* GRÁFICO DE ROSCA (CUSTOS) */}
                 <Card className="border-stone-100 shadow-sm">
                    <CardHeader><CardTitle className="text-lg">Composição de Custos</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={expensesByTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {expensesByTypeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                        {expensesByTypeData.length === 0 && <p className="text-center text-stone-400 text-sm mt-[-150px]">Sem custos no período.</p>}
                    </CardContent>
                 </Card>
              </div>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-6">
              <Card className="border-stone-100 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Histórico de Despesas</CardTitle>
                      <Button size="sm" onClick={() => setEditingExpense({})} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white">
                          <Plus className="w-4 h-4 mr-2"/> Nova Despesa
                      </Button>
                  </CardHeader>
                  <CardContent>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Descrição</TableHead>
                                  <TableHead>Categoria</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Data</TableHead>
                                  <TableHead className="text-right">Valor</TableHead>
                                  <TableHead></TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredData.expenses.length > 0 ? (
                                  filteredData.expenses.map(exp => (
                                      <TableRow key={exp.id}>
                                          <TableCell className="font-medium">{exp.description}</TableCell>
                                          <TableCell className="capitalize text-stone-500">{exp.category}</TableCell>
                                          <TableCell>
                                              <Badge variant="outline" className={exp.type === 'fixed' ? 'bg-stone-100 text-stone-600 border-stone-200' : 'bg-[#C6A87C]/10 text-[#C6A87C] border-[#C6A87C]/20'}>
                                                  {exp.type === 'fixed' ? 'Fixa' : 'Variável'}
                                              </Badge>
                                          </TableCell>
                                          <TableCell>{format(new Date(exp.payment_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                                          <TableCell className="text-right font-bold text-stone-700">R$ {(exp.amount_centavos / 100).toFixed(2)}</TableCell>
                                          <TableCell className="text-right">
                                              <Button variant="ghost" size="icon" onClick={() => setEditingExpense(exp)}><Pencil className="w-4 h-4 text-stone-400"/></Button>
                                              <Button variant="ghost" size="icon" onClick={() => deleteExpenseMutation.mutate(exp.id)}><Trash2 className="w-4 h-4 text-red-400"/></Button>
                                          </TableCell>
                                      </TableRow>
                                  ))
                              ) : (
                                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-stone-400">Nenhuma despesa neste período.</TableCell></TableRow>
                              )}
                          </TableBody>
                      </Table>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="transactions">
              <Card className="border-stone-100 shadow-sm">
                  <CardHeader><CardTitle>Transações de Entrada</CardTitle></CardHeader>
                  <CardContent>
                      <Table>
                          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                          <TableBody>
                              {filteredData.payments.map(payment => (
                                  <TableRow key={payment.id}>
                                      <TableCell>{format(payment.paymentDate, 'dd/MM/yyyy HH:mm')}</TableCell>
                                      <TableCell>{payment.customerName}</TableCell>
                                      <TableCell>{payment.serviceName}</TableCell>
                                      <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                                      <TableCell className="text-right font-bold text-emerald-600">R$ {(payment.amount / 100).toFixed(2)}</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}