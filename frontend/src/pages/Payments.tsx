import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Card, CardContent, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Calendar as CalendarIcon, ArrowUpCircle, ArrowDownCircle, Wallet, CreditCard,
  Target, BarChart3, Landmark, MoreHorizontal, Tags, CheckCircle2,
  Clock, Lightbulb, Briefcase, ShoppingBag, Megaphone, AlertTriangle,
  Settings2, Search, Info, TrendingUp, TrendingDown, Users, Download, 
  Pencil, Trash2, Filter, ArrowRightLeft, LayoutDashboard, List, CreditCard as CardIcon,
  ExternalLink, CalendarDays, Rocket
} from "lucide-react";
import { 
    appointmentsAPI, servicesAPI, expensesAPI, staffCommissionsAPI, 
    creditCardsAPI, categoriesAPI, accountsAPI 
} from "@/services/api";
import { addDays, format, startOfMonth, endOfMonth, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip as RechartsTooltip, CartesianGrid, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, formatCurrency } from "@/lib/utils";

// Componentes
import { ExpenseDialog } from "@/components/finance/ExpenseDialog";
import { CreditCardManager } from "@/components/finance/CreditCardManager";
import { CategoryManager } from "@/components/finance/CategoryManager";
import { TransferDialog } from "@/components/finance/TransferDialog";

const getCategoryIcon = (categoryName: string) => {
    const normalized = (categoryName || '').toLowerCase();
    if (normalized.includes('aluguel')) return Landmark;
    if (normalized.includes('cartao')) return CreditCard;
    if (normalized.includes('receita')) return ArrowUpCircle;
    if (normalized.includes('transfer')) return ArrowRightLeft;
    if (normalized.includes('comis')) return Users;
    return Tags;
};

// --- MODAL DE BAIXA UNIVERSAL (Comissões e Despesas) ---
function UniversalPayModal({ open, onClose, onConfirm, accounts, item }: any) {
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [accountId, setAccountId] = useState("");

    // Tenta pré-selecionar conta 'Caixa' ou a primeira
    useState(() => {
        if (accounts && accounts.length > 0 && !accountId) {
            const caixa = accounts.find((a:any) => a.name.toLowerCase().includes('caixa'));
            setAccountId(caixa ? caixa.id : accounts[0].id);
        }
    });

    const handleConfirm = () => {
        if (!accountId) return toast.error("Selecione a conta de origem/destino.");
        onConfirm(item, date, accountId);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[90%] sm:max-w-[400px] bg-white rounded-3xl">
                <DialogHeader>
                    <div className="mx-auto w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mb-3"><CheckCircle2 className="w-7 h-7 text-emerald-600"/></div>
                    <DialogTitle className="text-center font-black text-xl">Confirmar Baixa</DialogTitle>
                    <DialogDescription className="text-center">
                        {item?.description} <br/>
                        <span className="text-stone-900 font-bold text-lg mt-2 block">{item ? formatCurrency(Math.abs(item.amount) / 100) : 'R$ 0,00'}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-stone-400 uppercase">Data da Baixa</Label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl h-11 border-stone-200" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-stone-400 uppercase">Conta (Origem/Destino)</Label>
                        <Select value={accountId} onValueChange={setAccountId}>
                            <SelectTrigger className="h-11 rounded-xl border-stone-200"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{(accounts || []).map((acc: any) => (<SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance_centavos/100)})</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter className="flex gap-2">
                    <Button variant="ghost" onClick={onClose} className="flex-1 rounded-xl">Cancelar</Button>
                    <Button onClick={handleConfirm} className="bg-stone-900 text-white flex-1 rounded-xl font-bold">Confirmar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DatePickerWithPresets({ date, setDate }: { date: DateRange | undefined, setDate: (d: DateRange | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={"outline"} className={cn("w-full md:w-[220px] justify-start text-left font-normal border-none bg-stone-100/50 hover:bg-stone-100 text-stone-600 h-10 shadow-none rounded-xl", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4 text-stone-400" />
          {date?.from ? ( date.to ? <>{format(date.from, "dd MMM")} - {format(date.to, "dd MMM")}</> : format(date.from, "dd MMM yyyy") ) : <span>Selecione</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-stone-100" align="end">
        <Calendar mode="range" selected={date} onSelect={setDate} numberOfMonths={1} locale={ptBR} />
      </PopoverContent>
    </Popover>
  );
}

export default function Payments() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [itemToPay, setItemToPay] = useState<any>(null);
  
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [tableFilter, setTableFilter] = useState<'all' | 'realized' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [cardFilter, setCardFilter] = useState<string>("all");

  const queryOptions = { staleTime: 1000 * 60 * 5 };
  const { data: appointments = [], isLoading: loadAppts } = useQuery({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll, ...queryOptions });
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: servicesAPI.getAll, ...queryOptions });
  const { data: expenses = [], isLoading: loadExp } = useQuery({ queryKey: ['expenses'], queryFn: expensesAPI.getAll, ...queryOptions });
  const { data: commissions = [], isLoading: loadComm } = useQuery({ queryKey: ['staffCommissions'], queryFn: staffCommissionsAPI.getAll, ...queryOptions });
  const { data: creditCards = [] } = useQuery({ queryKey: ['creditCards'], queryFn: creditCardsAPI.getAll, ...queryOptions });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesAPI.getAll, ...queryOptions });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsAPI.getAll, ...queryOptions });

  const isLoading = loadAppts || loadExp;

  // --- MUTAÇÕES ---
  const saveExpenseMutation = useMutation({ mutationFn: (data: any) => { const { id, ...payload } = data; return id ? expensesAPI.update(id, payload) : expensesAPI.create(payload) }, onSuccess: () => { toast.success("Salvo!"); setIsExpenseModalOpen(false); setEditingExpense(null); queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['cash-flow'] }); queryClient.invalidateQueries({ queryKey: ['accounts'] }); }, onError: (err: any) => toast.error(`Erro: ${err?.response?.data?.detail || 'Falha ao salvar.'}`) });
  
  const deleteExpenseMutation = useMutation({ mutationFn: (id: string) => expensesAPI.delete(id), onSuccess: () => { toast.success("Removido!"); queryClient.invalidateQueries({ queryKey: ['expenses'] }); } });
  
  // 🔥 MUTAÇÃO UNIFICADA DE BAIXA (Despesas e Comissões)
  const payItemMutation = useMutation({ 
      mutationFn: async ({ id, date, accountId, source, item }: { id: string, date: string, accountId: string, source: string, item: any }) => {
          if (source === 'commission') {
              // 1. Marca comissão como paga
              await staffCommissionsAPI.update(id, { status: 'pago' });
              
              // 2. Cria a despesa de saída (para abater do caixa)
              await expensesAPI.create({
                  description: item.description,
                  amount_centavos: Math.abs(item.amount), // Garante positivo
                  payment_date: date,
                  type: 'variable',
                  category_legacy: 'Comissões',
                  status: 'paid',
                  account_id: accountId,
                  payment_method: 'transfer' // ou 'cash'
              });
              // O create acima já atualiza o saldo via ExpenseViewSet
          } else {
              // Despesa normal: só atualiza status e conta
              await expensesAPI.update(id, { status: 'paid', payment_date: date, account_id: accountId });
          }
      }, 
      onSuccess: () => { 
          toast.success("Baixa realizada!"); 
          setItemToPay(null); 
          queryClient.invalidateQueries({ queryKey: ['expenses'] }); 
          queryClient.invalidateQueries({ queryKey: ['staffCommissions'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] }); 
      },
      onError: () => toast.error("Erro ao realizar baixa.")
  });

  const saveCardMutation = useMutation({ mutationFn: (data: any) => { const { id, ...payload } = data; return id ? creditCardsAPI.update(id, payload) : creditCardsAPI.create(payload) }, onSuccess: () => { toast.success("Cartão salvo!"); queryClient.invalidateQueries({ queryKey: ['creditCards'] }); } });
  const deleteCardMutation = useMutation({ mutationFn: (id: string) => creditCardsAPI.delete(id), onSuccess: () => { toast.success("Cartão removido!"); queryClient.invalidateQueries({ queryKey: ['creditCards'] }); } });
  const saveAccountMutation = useMutation({ mutationFn: (data: any) => accountsAPI.create(data), onSuccess: () => { toast.success("Conta criada!"); queryClient.invalidateQueries({ queryKey: ['accounts'] }); } });
  const deleteAccountMutation = useMutation({ mutationFn: (id: string) => accountsAPI.delete(id), onSuccess: () => { toast.success("Conta removida!"); queryClient.invalidateQueries({ queryKey: ['accounts'] }); } });
  const payInvoiceMutation = useMutation({ mutationFn: async ({ items, accountId }: { items: any[], accountId: string }) => { for (const item of items) { await expensesAPI.update(item.id, { status: 'paid', account_id: accountId }); } }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['accounts'] }); toast.success("Fatura paga!"); } });
  const saveCategoryMutation = useMutation({ mutationFn: categoriesAPI.create, onSuccess: () => { toast.success("Categoria criada!"); queryClient.invalidateQueries({ queryKey: ['categories'] }); } });
  const deleteCategoryMutation = useMutation({ mutationFn: categoriesAPI.delete, onSuccess: () => { toast.success("Categoria removida!"); queryClient.invalidateQueries({ queryKey: ['categories'] }); } });

  const openNewEntry = (type: 'income' | 'expense') => { setEditingExpense({}); setEntryType(type); setIsExpenseModalOpen(true); };
  const handleSaveTransfer = (data: any) => { saveExpenseMutation.mutate(data); setIsTransferModalOpen(false); };

  const financials = useMemo(() => {
    const serviceMap = new Map(services.map((s:any) => [s.id, s.price_centavos || 0]));
    const inDateRange = (dateStr: string) => { if (!dateStr) return false; if (!dateRange?.from) return true; const d = new Date(dateStr); const from = dateRange.from; const to = dateRange.to ? addDays(dateRange.to, 1) : addDays(from, 1); return d >= from && d < to; };
    
    // 🔥 PREVISÃO REAL: Futuro (Agendamentos)
    const now = new Date();
    const futureRevenue = appointments
        .filter((a:any) => a.status === 'confirmed' && new Date(a.start_time) >= now)
        .reduce((acc:number, a:any) => acc + (a.final_amount_centavos ?? serviceMap.get(a.service) ?? 0), 0);

    const revenueItems = appointments.filter((a:any) => (a.status === 'completed' || a.status === 'confirmed') && inDateRange(a.start_time)).map((a:any) => ({ id: a.id, date: new Date(a.start_time), amount: a.final_amount_centavos ?? serviceMap.get(a.service) ?? 0, type: 'receita', description: `${a.service_name} - ${a.customer_name}`, category: 'Serviços', status: a.status === 'completed' ? 'realizado' : 'previsto', source: 'appointment', originalData: a }));
    const extraIncomes = expenses.filter((e:any) => e.type === 'income' && inDateRange(e.payment_date + 'T12:00:00')).map((e:any) => ({ id: e.id, date: new Date(e.payment_date + 'T12:00:00'), amount: e.amount_centavos, type: 'receita', description: e.description, category: e.category_name || 'Receita Extra', status: e.status === 'paid' ? 'realizado' : 'previsto', source: 'expense', originalData: e }));
    const expenseItems = expenses.filter((e:any) => e.type !== 'income' && e.type !== 'transfer' && inDateRange(e.payment_date + 'T12:00:00')).map((e:any) => { const cardName = e.card ? creditCards.find((c:any) => c.id === e.card)?.name : null; return { id: e.id, date: new Date(e.payment_date + 'T12:00:00'), amount: e.amount_centavos, type: 'despesa', description: e.description, category: e.category_name || 'Despesa', card_id: e.card, card_name: cardName, status: e.status === 'paid' ? 'realizado' : 'previsto', originalData: e, source: 'expense' }; });
    const commissionItems = (commissions || []).filter((c:any) => inDateRange(c.date + 'T12:00:00')).map((c:any) => ({ id: c.id, date: new Date(c.date + 'T12:00:00'), amount: c.commission_amount_centavos, type: 'despesa', description: `Comissão - ${c.staff_name}`, category: 'Comissões', status: c.status === 'pago' ? 'realizado' : 'previsto', source: 'commission', originalData: c }));
    
    const allTransactions = [...revenueItems, ...extraIncomes, ...expenseItems, ...commissionItems].sort((a,b) => b.date.getTime() - a.date.getTime());
    
    const filteredTransactions = allTransactions.filter(t => { 
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()); 
        const matchesCard = cardFilter === 'all' || (t.source === 'expense' && t.card_name === cardFilter); 
        if (tableFilter === 'realized') return matchesSearch && matchesCard && t.status === 'realizado';
        if (tableFilter === 'pending') return matchesSearch && matchesCard && t.status === 'previsto';
        return matchesSearch && matchesCard; 
    });

    const totalRevenueRealized = revenueItems.filter((i:any) => i.status === 'realizado').reduce((acc: number, i: any) => acc + i.amount, 0) + extraIncomes.filter((i:any) => i.status === 'realizado').reduce((acc: number, i: any) => acc + i.amount, 0);
    const totalRevenueProjected = totalRevenueRealized + futureRevenue + extraIncomes.filter((i:any) => i.status === 'previsto').reduce((acc: number, i: any) => acc + i.amount, 0);
    const totalCostsRealized = expenseItems.filter((i:any) => i.status === 'realizado').reduce((acc: number, i: any) => acc + i.amount, 0) + commissionItems.filter((i:any) => i.status === 'realizado').reduce((acc: number, i: any) => acc + i.amount, 0);
    const totalCostsProjected = expenseItems.reduce((acc: number, i: any) => acc + i.amount, 0) + commissionItems.reduce((acc: number, i: any) => acc + i.amount, 0);
    const profitRealized = totalRevenueRealized - totalCostsRealized;
    const profitProjected = totalRevenueProjected - totalCostsProjected;
    const breakEvenProgress = totalCostsProjected > 0 ? Math.min(100, (totalRevenueRealized / totalCostsProjected) * 100) : 0;
    
    const chartDataMap = new Map(); allTransactions.forEach(item => { const d = format(item.date, 'dd/MM'); if(!chartDataMap.has(d)) chartDataMap.set(d, { revenue: 0, expense: 0 }); if (item.type === 'receita') chartDataMap.get(d).revenue += (item.amount/100); else chartDataMap.get(d).expense += (item.amount/100); });
    const chartData = Array.from(chartDataMap).map(([name, val]:any) => ({ name, ...val })).sort((a:any,b:any) => a.name.localeCompare(b.name));
    const totalCommissionsValue = commissionItems.reduce((acc:number, c:any) => acc + c.amount, 0);

    return { totalRevenueRealized, totalRevenueProjected, totalCostsRealized, totalCostsProjected, profitRealized, profitProjected, breakEvenProgress, filteredTransactions, chartData, totalCommissionsValue };
  }, [appointments, expenses, commissions, dateRange, services, searchTerm, cardFilter, creditCards, tableFilter]);

  const flowSummary = useMemo(() => ({ 
      income: financials.filteredTransactions.filter(t => t.type === 'receita').reduce((sum: number, t: any) => sum + t.amount, 0), 
      expense: financials.filteredTransactions.filter(t => t.type === 'despesa').reduce((sum: number, t: any) => sum + t.amount, 0), 
      balance: financials.filteredTransactions.reduce((acc: number, t: any) => acc + (t.type === 'receita' ? t.amount : -t.amount), 0) 
  }), [financials.filteredTransactions]);

  const handleExport = () => { let csv = "Data,Descrição,Categoria,Tipo,Status,Valor\n"; financials.filteredTransactions.forEach(t => csv += `${format(t.date, 'dd/MM/yyyy')},${t.description},${t.category},${t.type},${t.status},${(t.amount/100).toFixed(2)}\n`); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = "fluxo_caixa.csv"; link.click(); };

  return (
    <div className="p-4 md:p-10 max-w-[1400px] mx-auto space-y-8 bg-[#FDFDFD] min-h-screen pb-32 font-sans text-stone-700">
      <ExpenseDialog open={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} expense={editingExpense} cards={creditCards || []} categories={categories || []} onSave={saveExpenseMutation.mutate} isSaving={saveExpenseMutation.isPending} defaultType={entryType} accounts={accounts || []} />
      <CategoryManager open={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} categories={categories || []} onSave={saveCategoryMutation.mutate} onDelete={deleteCategoryMutation.mutate} />
      <TransferDialog open={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} onSave={handleSaveTransfer} accounts={accounts || []} />
      
      {/* 🔥 MODAL UNIVERSAL PARA BAIXAS */}
      <UniversalPayModal 
        open={!!itemToPay} 
        onClose={() => setItemToPay(null)} 
        item={itemToPay} 
        accounts={accounts || []} 
        onConfirm={(item:any, date:string, accountId:string) => payItemMutation.mutate({ id: item.id, date, accountId, source: item.source, item })} 
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-in slide-in-from-top-4 duration-500">
        <div><h1 className="text-3xl md:text-4xl font-black text-stone-800 tracking-tight">Fluxo de Caixa</h1><p className="text-stone-400 font-medium">Gestão inteligente e previsível.</p></div>
        <div className="flex flex-wrap gap-3">
            <Button onClick={() => setIsTransferModalOpen(true)} variant="outline" className="h-12 border-stone-200 text-stone-600 rounded-xl hover:bg-stone-50"><ArrowRightLeft className="w-4 h-4 mr-2"/> Transferir</Button>
            <Button onClick={() => openNewEntry('income')} className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-100 rounded-xl px-6"><ArrowUpCircle className="w-5 h-5 mr-2"/> Nova Receita</Button>
            <Button onClick={() => openNewEntry('expense')} className="h-12 bg-stone-900 hover:bg-black text-white font-bold shadow-lg shadow-stone-200 rounded-xl px-6"><ArrowDownCircle className="w-5 h-5 mr-2"/> Nova Despesa</Button>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-96 w-full rounded-3xl"/> : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl border border-stone-100 shadow-sm">
                <TabsList className="bg-stone-100/50 p-1 rounded-xl h-auto gap-1">
                    <TabsTrigger value="dashboard" className="rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm font-bold text-stone-500 transition-all"><LayoutDashboard className="w-4 h-4 mr-2"/> Dashboard</TabsTrigger>
                    <TabsTrigger value="cashflow" className="rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm font-bold text-stone-500 transition-all"><List className="w-4 h-4 mr-2"/> Lançamentos</TabsTrigger>
                    <TabsTrigger value="cards" className="rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm font-bold text-stone-500 transition-all"><CardIcon className="w-4 h-4 mr-2"/> Carteira</TabsTrigger>
                </TabsList>
                <div className="flex gap-2 w-full md:w-auto"><DatePickerWithPresets date={dateRange} setDate={setDateRange} /><Button variant="ghost" size="icon" className="text-stone-400 hover:text-stone-600 rounded-xl" onClick={() => setIsCategoryModalOpen(true)}><Settings2 className="w-5 h-5"/></Button></div>
            </div>

            <TabsContent value="dashboard" className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="bg-stone-900 text-white border-none shadow-xl col-span-1 md:col-span-2 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-stone-400 uppercase tracking-widest flex justify-between"><span>Realizado do Mês</span><Target className="w-4 h-4 text-[#C6A87C]"/></CardTitle></CardHeader>
                        <CardContent><div className="flex justify-between items-end mb-4"><div><span className="text-4xl font-black tracking-tighter">{formatCurrency(financials.totalRevenueRealized / 100)}</span><p className="text-stone-400 text-sm mt-1">Faturamento Confirmado</p></div><div className="text-right"><span className="text-xs text-stone-400 uppercase font-bold">Meta de Custos</span><p className="text-xl font-bold text-[#C6A87C]">{formatCurrency(financials.totalCostsProjected / 100)}</p></div></div>
                        <Progress value={financials.breakEvenProgress} className="h-2 bg-stone-800" /><p className="text-xs text-stone-500 mt-2 text-right">{financials.breakEvenProgress.toFixed(0)}% da meta de custos paga</p></CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all"><CardHeader><CardTitle className="text-xs font-bold text-stone-400 uppercase flex items-center gap-2"><Rocket className="w-4 h-4 text-blue-500"/> Previsão do Mês</CardTitle></CardHeader><CardContent><p className={`text-3xl font-black text-stone-800`}>{formatCurrency(financials.profitProjected / 100)}</p><p className="text-xs text-stone-400 mt-2">Lucro se receber/pagar tudo.</p></CardContent></Card>
                    <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all"><CardHeader><CardTitle className="text-xs font-bold text-stone-400 uppercase flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500"/> Comissões</CardTitle></CardHeader><CardContent><p className="text-3xl font-black text-stone-800">{formatCurrency(financials.totalCommissionsValue / 100)}</p><p className="text-xs text-stone-400 mt-2">Reservado para equipe.</p></CardContent></Card>
                </div>
                {/* GRÁFICO MELHORADO */}
                <Card className="border-none shadow-sm bg-white p-6"><h3 className="font-bold text-stone-700 mb-6">Fluxo Diário (Realizado + Previsto)</h3><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={financials.chartData}><defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#C6A87C" stopOpacity={0.3}/><stop offset="95%" stopColor="#C6A87C" stopOpacity={0}/></linearGradient><linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" /><XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tickMargin={10} /><YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `R$ ${val}`} /><RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} formatter={(val: number) => formatCurrency(val)} /><Area type="monotone" dataKey="revenue" name="Entradas" stroke="#C6A87C" fill="url(#colorRev)" strokeWidth={3} activeDot={{r: 6}} /><Area type="monotone" dataKey="expense" name="Saídas" stroke="#ef4444" fill="url(#colorExp)" strokeWidth={3} activeDot={{r: 6}} /></AreaChart></ResponsiveContainer></div></Card>
            </TabsContent>

            <TabsContent value="cashflow" className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 text-center md:text-left"><span className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase block mb-1">Entradas</span><span className="text-sm md:text-xl font-bold text-emerald-700">{formatCurrency(flowSummary.income / 100)}</span></div>
                    <div className="bg-red-50 rounded-lg p-3 border border-red-100 text-center md:text-left"><span className="text-[10px] md:text-xs font-bold text-red-600 uppercase block mb-1">Saídas</span><span className="text-sm md:text-xl font-bold text-red-700">{formatCurrency(Math.abs(flowSummary.expense) / 100)}</span></div>
                    <div className="bg-white rounded-lg p-3 border border-stone-200 text-center md:text-left shadow-sm"><span className="text-[10px] md:text-xs font-bold text-stone-500 uppercase block mb-1">Saldo (Filtro)</span><span className={`text-sm md:text-xl font-bold ${flowSummary.balance >= 0 ? 'text-stone-800' : 'text-red-600'}`}>{formatCurrency(flowSummary.balance / 100)}</span></div>
                </div>
                
                <div className="bg-white p-2 rounded-2xl border border-stone-100 shadow-sm flex flex-col md:flex-row gap-3 items-center">
                    <div className="flex bg-stone-100/50 p-1 rounded-xl">
                        <button onClick={() => setTableFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${tableFilter === 'all' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>Todos</button>
                        <button onClick={() => setTableFilter('realized')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${tableFilter === 'realized' ? 'bg-white shadow text-emerald-600' : 'text-stone-500 hover:text-stone-700'}`}>Realizados</button>
                        <button onClick={() => setTableFilter('pending')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${tableFilter === 'pending' ? 'bg-white shadow text-amber-600' : 'text-stone-500 hover:text-stone-700'}`}>Previstos</button>
                    </div>
                    <div className="relative flex-1 w-full"><Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2"/><Input placeholder="Buscar..." className="pl-10 h-10 bg-stone-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-stone-200" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                    <Select value={cardFilter} onValueChange={setCardFilter}><SelectTrigger className="w-[140px] h-10 bg-stone-50 border-none rounded-xl"><SelectValue placeholder="Cartão" /></SelectTrigger><SelectContent>{creditCards.map((c: any) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}<SelectItem value="all">Todos Cartões</SelectItem></SelectContent></Select>
                </div>

                <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader className="bg-stone-50/50">
                                <TableRow className="border-stone-100 hover:bg-transparent">
                                    <TableHead className="w-[120px] text-[11px] font-bold text-stone-400 uppercase tracking-wider pl-6">Data</TableHead>
                                    <TableHead className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Descrição</TableHead>
                                    <TableHead className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Categoria</TableHead>
                                    <TableHead className="text-right text-[11px] font-bold text-stone-400 uppercase tracking-wider">Valor</TableHead>
                                    <TableHead className="text-center text-[11px] font-bold text-stone-400 uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {financials.filteredTransactions.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-stone-400">Nenhum lançamento encontrado.</TableCell></TableRow> : 
                                financials.filteredTransactions.map((t: any) => (
                                    <TableRow key={t.id} className="group border-stone-50 hover:bg-stone-50/50 transition-colors">
                                        <TableCell className="pl-6 text-xs font-medium text-stone-500">{format(t.date, 'dd MMM yyyy', {locale: ptBR})}</TableCell>
                                        <TableCell><span className="text-sm font-bold text-stone-700">{t.description}</span></TableCell>
                                        <TableCell><div className="flex flex-col items-start gap-1"><Badge variant="secondary" className="bg-stone-100 text-stone-500 hover:bg-stone-200 font-normal">{t.category}</Badge>{t.card_name && <span className="text-[10px] text-stone-400 flex items-center gap-1"><CreditCard className="w-3 h-3"/> {t.card_name}</span>}</div></TableCell>
                                        <TableCell className={`text-right font-bold text-sm ${t.type === 'receita' ? 'text-emerald-600' : 'text-stone-700'}`}>{t.type === 'receita' ? '+' : ''} {formatCurrency(Math.abs(t.amount) / 100)}</TableCell>
                                        <TableCell className="text-center">{t.status === 'realizado' ? <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="w-4 h-4"/></div> : <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600"><Clock className="w-4 h-4"/></div>}</TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* 🔥 Link Corrigido para /appointments */}
                                                {t.source === 'appointment' ? (
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 hover:bg-blue-50 rounded-lg" onClick={() => setLocation(`/appointments`)} title="Ver Agendamento"><ExternalLink className="w-4 h-4"/></Button>
                                                ) : (
                                                    <>
                                                        {t.status === 'previsto' && (<Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-lg" onClick={() => setItemToPay(t.originalData)} title="Baixar"><CheckCircle2 className="w-4 h-4"/></Button>)}
                                                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-600 rounded-lg"><MoreHorizontal className="w-4 h-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-xl"><DropdownMenuItem onClick={() => { setEditingExpense(t.originalData); setIsExpenseModalOpen(true); }}><Pencil className="w-3 h-3 mr-2"/> Editar</DropdownMenuItem><DropdownMenuItem className="text-red-600" onClick={() => deleteExpenseMutation.mutate(t.id)}><Trash2 className="w-3 h-3 mr-2"/> Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {/* MOBILE LIST (Kanban Style) */}
                    <div className="md:hidden space-y-3 p-4">
                        {financials.filteredTransactions.map((t: any) => { const Icon = getCategoryIcon(t.category); return (
                            <div key={t.id} className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'receita' ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-500'}`}><Icon className="w-5 h-5"/></div>
                                        <div><p className="font-bold text-stone-800 text-sm">{t.description}</p><span className="text-xs text-stone-400">{format(t.date, 'dd MMM')}</span></div>
                                    </div>
                                    <Badge variant="secondary" className={t.status === 'realizado' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>{t.status === 'realizado' ? "Pago" : "Pendente"}</Badge>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-stone-50">
                                    <span className={`font-black text-lg ${t.type === 'receita' ? 'text-emerald-600' : 'text-stone-800'}`}>{formatCurrency(t.amount / 100)}</span>
                                    <div className="flex gap-2">
                                        {t.source === 'appointment' ? (<Button size="sm" variant="ghost" className="h-8 text-xs text-blue-500" onClick={() => setLocation(`/appointments`)}>Ver <ExternalLink className="w-3 h-3 ml-1"/></Button>) : (<>{t.status === 'previsto' && <Button size="sm" className="h-8 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => setItemToPay(t.originalData)}>Baixar</Button>}<DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-stone-300"><MoreHorizontal className="w-4 h-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setEditingExpense(t.originalData); setIsExpenseModalOpen(true); }}>Editar</DropdownMenuItem><DropdownMenuItem className="text-red-600" onClick={() => deleteExpenseMutation.mutate(t.id)}>Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></>)}
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="cards" className="animate-in fade-in zoom-in-95 duration-300">
                <CreditCardManager cards={creditCards} accounts={accounts || []} expenses={expenses} onSaveCard={saveCardMutation.mutate} onDeleteCard={deleteCardMutation.mutate} onSaveAccount={saveAccountMutation.mutate} onDeleteAccount={deleteAccountMutation.mutate} onPayInvoice={(items: any, accountId: string) => payInvoiceMutation.mutate({ items, accountId })} />
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}