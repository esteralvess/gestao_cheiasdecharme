import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { financialAPI, expensesAPI, creditCardsAPI, categoriesAPI } from "@/services/api";
import { format, startOfMonth, endOfMonth, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";

// Componentes Visuais
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Ícones
import { 
  Calendar as CalendarIcon, Download, Plus, Filter, Search, 
  MoreHorizontal, ArrowUpCircle, ArrowDownCircle, 
  Wallet, PieChart, CreditCard, CheckCircle2, AlertTriangle, 
  Clock
} from "lucide-react";

// Nossos Componentes Isolados (Reutilizando o que já funciona)
import { ExpenseDialog } from "@/components/finance/ExpenseDialog";
import { CreditCardManager } from "@/components/finance/CreditCardManager";

// --- SUB-COMPONENTES INTERNOS (Para deixar o código limpo) ---

function DatePickerWithPresets({ date, setDate }: { date: DateRange | undefined, setDate: (d: DateRange | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal border-stone-200 bg-white h-10 shadow-sm", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4 text-[#C6A87C]" />
          {date?.from ? ( date.to ? <>{format(date.from, "dd/MM/yyyy")} - {format(date.to, "dd/MM/yyyy")}</> : format(date.from, "dd/MM/yyyy") ) : <span>Selecione o período</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar mode="range" selected={date} onSelect={setDate} numberOfMonths={2} locale={ptBR} />
      </PopoverContent>
    </Popover>
  );
}

// --- PÁGINA PRINCIPAL ---

export default function FinancialPage() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  
  // Controle de Abas
  const [activeTab, setActiveTab] = useState("overview");

  // Filtros de Tabela
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // Estados de Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  // --- QUERIES (Busca de Dados) ---
  const { data: dashboard, isLoading: loadDash } = useQuery({ 
    queryKey: ['financial-dashboard', dateRange], 
    queryFn: () => financialAPI.getDashboard(dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined, dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined),
    enabled: !!dateRange?.from
  });

  const { data: transactions = [], isLoading: loadTrans } = useQuery({ 
    queryKey: ['cash-flow', dateRange], 
    queryFn: () => financialAPI.getCashFlow(dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined, dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined),
    enabled: !!dateRange?.from
  });

  const { data: creditCards = [] } = useQuery({ queryKey: ['creditCards'], queryFn: creditCardsAPI.getAll });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesAPI.getAll });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: expensesAPI.getAll }); // Necessário para o CreditCardManager

  // --- MUTATIONS (Ações) ---
  const saveExpenseMutation = useMutation({ 
      mutationFn: (data: any) => { const { id, ...payload } = data; return id ? expensesAPI.update(id, payload) : expensesAPI.create(payload) }, 
      onSuccess: () => { toast.success("Salvo com sucesso!"); setIsExpenseModalOpen(false); setEditingExpense(null); queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['cash-flow'] }); queryClient.invalidateQueries({ queryKey: ['financial-dashboard'] }); }, 
      onError: () => toast.error("Erro ao salvar.") 
  });

  const deleteExpenseMutation = useMutation({ 
      mutationFn: (id: string) => expensesAPI.delete(id), 
      onSuccess: () => { toast.success("Removido!"); queryClient.invalidateQueries({ queryKey: ['cash-flow'] }); queryClient.invalidateQueries({ queryKey: ['financial-dashboard'] }); } 
  });

  const saveCardMutation = useMutation({ 
      mutationFn: (data: any) => { const { id, ...payload } = data; return id ? creditCardsAPI.update(id, payload) : creditCardsAPI.create(payload) }, 
      onSuccess: () => { toast.success("Cartão salvo!"); queryClient.invalidateQueries({ queryKey: ['creditCards'] }); } 
  });

  const payExpenseMutation = useMutation({
      mutationFn: (id: string) => expensesAPI.update(id, { status: 'paid', payment_date: format(new Date(), 'yyyy-MM-dd') }),
      onSuccess: () => { toast.success("Pagamento registrado!"); queryClient.invalidateQueries({ queryKey: ['cash-flow'] }); }
  });

  // Filtro Local da Tabela
  const filteredTransactions = transactions.filter((t: any) => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === (statusFilter === 'paid' ? 'realizado' : 'previsto');
      return matchesSearch && matchesStatus;
  });

  if (loadDash && activeTab === 'overview') return <div className="p-8"><Skeleton className="h-64 w-full rounded-2xl"/></div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in bg-[#FAFAF9] min-h-screen pb-20">
      
      {/* HEADER FIXO - Sempre visível */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 flex items-center gap-2">
            Financeiro
          </h1>
          <p className="text-stone-500 text-sm">Controle total do fluxo de caixa.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <DatePickerWithPresets date={dateRange} setDate={setDateRange} />
            <Button onClick={() => { setEditingExpense({}); setIsExpenseModalOpen(true); }} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold px-6 shadow-md transition-all hover:scale-105 active:scale-95">
                <Plus className="w-4 h-4 mr-2" /> Novo Lançamento
            </Button>
        </div>
      </div>

      {/* ABAS - O coração da navegação */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white p-1 rounded-xl border border-stone-200 inline-flex h-auto w-full md:w-auto shadow-sm">
            <TabsTrigger value="overview" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-stone-100 data-[state=active]:text-stone-900 data-[state=active]:font-bold text-stone-500 transition-all">
                <PieChart className="w-4 h-4 mr-2"/> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="transactions" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-stone-100 data-[state=active]:text-stone-900 data-[state=active]:font-bold text-stone-500 transition-all">
                <Wallet className="w-4 h-4 mr-2"/> Movimentações
            </TabsTrigger>
            <TabsTrigger value="cards" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-stone-100 data-[state=active]:text-stone-900 data-[state=active]:font-bold text-stone-500 transition-all">
                <CreditCard className="w-4 h-4 mr-2"/> Cartões
            </TabsTrigger>
        </TabsList>

        {/* 1. ABA VISÃO GERAL (Dashboard Simplificado) */}
        <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-emerald-100 bg-emerald-50/30 shadow-sm">
                    <CardHeader className="pb-2"><p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Entradas</p></CardHeader>
                    <CardContent className="flex justify-between items-center">
                        <div className="text-2xl font-black text-emerald-700">R$ {(dashboard?.summary.revenue / 100 || 0).toFixed(2)}</div>
                        <ArrowUpCircle className="w-8 h-8 text-emerald-300"/>
                    </CardContent>
                </Card>
                <Card className="border-red-100 bg-red-50/30 shadow-sm">
                    <CardHeader className="pb-2"><p className="text-xs font-bold text-red-600 uppercase tracking-widest">Saídas</p></CardHeader>
                    <CardContent className="flex justify-between items-center">
                        <div className="text-2xl font-black text-red-700">R$ {(dashboard?.summary.costs / 100 || 0).toFixed(2)}</div>
                        <ArrowDownCircle className="w-8 h-8 text-red-300"/>
                    </CardContent>
                </Card>
                <Card className="border-stone-200 bg-white shadow-sm">
                    <CardHeader className="pb-2"><p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Saldo Líquido</p></CardHeader>
                    <CardContent className="flex justify-between items-center">
                        <div className={`text-2xl font-black ${(dashboard?.summary.profit || 0) >= 0 ? 'text-stone-800' : 'text-red-600'}`}>R$ {(dashboard?.summary.profit / 100 || 0).toFixed(2)}</div>
                        <Wallet className="w-8 h-8 text-stone-300"/>
                    </CardContent>
                </Card>
            </div>
            
            {/* Detalhamento Rápido */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-stone-100 shadow-sm bg-white">
                    <CardHeader><CardTitle className="text-base font-bold text-stone-700">Composição de Custos</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center border-b border-stone-50 pb-2">
                            <span className="text-sm text-stone-500 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div>Fixos</span>
                            <span className="font-bold text-stone-700">R$ {(dashboard?.details.expenses_fixed / 100 || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-stone-50 pb-2">
                            <span className="text-sm text-stone-500 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div>Variáveis</span>
                            <span className="font-bold text-stone-700">R$ {(dashboard?.details.expenses_variable / 100 || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-stone-500 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div>Comissões</span>
                            <span className="font-bold text-stone-700">R$ {(dashboard?.details.commissions / 100 || 0).toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        {/* 2. ABA MOVIMENTAÇÕES (Tabela completa) */}
        <TabsContent value="transactions">
            <Card className="border-stone-100 shadow-md bg-white">
                <div className="p-4 border-b border-stone-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Search className="w-4 h-4 text-stone-400" />
                        <Input 
                            placeholder="Buscar lançamento..." 
                            className="border-none bg-transparent h-8 focus-visible:ring-0 px-0 w-full sm:w-64"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant={statusFilter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setStatusFilter('all')} className="text-xs">Tudo</Button>
                        <Button variant={statusFilter === 'pending' ? 'secondary' : 'ghost'} size="sm" onClick={() => setStatusFilter('pending')} className="text-xs text-amber-600">A Pagar/Receber</Button>
                        <Button variant={statusFilter === 'paid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setStatusFilter('paid')} className="text-xs text-emerald-600">Realizado</Button>
                    </div>
                </div>
                <div className="rounded-md">
                    <Table>
                        <TableHeader className="bg-stone-50/50">
                            <TableRow>
                                <TableHead className="w-[100px]">Data</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="w-[100px] text-center">Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-10 text-stone-400">Nenhum lançamento neste período.</TableCell></TableRow>
                            ) : (
                                filteredTransactions.map((t: any) => (
                                    <TableRow key={t.id} className="group hover:bg-stone-50/50">
                                        <TableCell className="text-xs font-medium text-stone-500">
                                            {format(new Date(t.date), 'dd/MM/yyyy')}
                                            {isPast(new Date(t.date)) && t.status === 'previsto' && <span className="ml-2 text-[10px] text-red-500 font-bold uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3"/></span>}
                                        </TableCell>
                                        <TableCell className="font-bold text-stone-700 text-sm">{t.description}</TableCell>
                                        <TableCell><Badge variant="outline" className="font-normal text-stone-500 border-stone-200 text-[10px]">{t.category}</Badge></TableCell>
                                        <TableCell className={`text-right font-bold text-sm ${t.type === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {t.type === 'receita' ? '+' : ''} R$ {(t.amount / 100).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {t.status === 'realizado' ? 
                                                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-none shadow-none text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1"/>Pago</Badge> : 
                                                <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none shadow-none text-[10px]"><Clock className="w-3 h-3 mr-1"/>Pendente</Badge>
                                            }
                                        </TableCell>
                                        <TableCell>
                                            {t.type === 'despesa' && (
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {t.status === 'previsto' && (
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 bg-emerald-50 hover:bg-emerald-100" onClick={() => payExpenseMutation.mutate(t.id)}>
                                                            <CheckCircle2 className="w-4 h-4"/>
                                                        </Button>
                                                    )}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400"><MoreHorizontal className="w-4 h-4"/></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => { setEditingExpense(t.originalData); setIsExpenseModalOpen(true); }}>Editar</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-red-600" onClick={() => deleteExpenseMutation.mutate(t.id)}>Excluir</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </TabsContent>

        {/* 3. ABA CARTÕES */}
        <TabsContent value="cards">
            <CreditCardManager cards={creditCards} expenses={expenses} onSaveCard={saveCardMutation.mutate} />
        </TabsContent>

      </Tabs>

      {/* MODAL DE LANÇAMENTO (SEMPRE AQUI) */}
      <ExpenseDialog open={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} expense={editingExpense} cards={creditCards} categories={categories} onSave={saveExpenseMutation.mutate} isSaving={saveExpenseMutation.isPending} />
    </div>
  );
}