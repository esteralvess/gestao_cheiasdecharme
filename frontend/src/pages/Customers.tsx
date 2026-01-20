import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Search, 
  Plus, 
  Users, 
  Award, 
  Gem, 
  Calendar as CalendarIcon, 
  MoreHorizontal,
  Edit,
  Trash2,
  Gift,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  UserPlus,
  Info,
  CheckCircle2,
  User,
  ExternalLink, 
  History,
  Clock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { customersAPI, appointmentsAPI } from "@/services/api";
import { format, parseISO } from 'date-fns';
import { ptBR } from "date-fns/locale";

// --- INTERFACES ---
interface Customer { 
    id: string; 
    full_name: string; 
    whatsapp: string; 
    email: string; 
    birth_date?: string | null; 
    notes?: string; 
    visits: number; 
    category: "novo" | "recorrente" | "fidelizado"; 
    last_visit?: string; 
    points: number;
    referrer_name?: string; 
    referral_count?: number; 
    created_at: string;
}

export default function Customers() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("list");
  
  // PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  // Estados dos Modais
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [adjustingPointsCustomer, setAdjustingPointsCustomer] = useState<Customer | null>(null);
  const [pointsAdjustment, setPointsAdjustment] = useState(0);

  // Modais de Visualização
  const [viewingReferralsCustomer, setViewingReferralsCustomer] = useState<Customer | null>(null);
  const [viewingHistoryCustomer, setViewingHistoryCustomer] = useState<Customer | null>(null);

  // Formulário Cliente
  const [formData, setFormData] = useState({
    full_name: "", whatsapp: "", email: "", birth_date: "", notes: "", category: "novo", referrer_info: ""
  });

  // --- QUERIES ---
  const { data: customers = [], isLoading } = useQuery<Customer[]>({ 
    queryKey: ['customers'], 
    queryFn: customersAPI.getAll 
  });

  const { data: allAppointments = [] } = useQuery<any[]>({ 
    queryKey: ['appointments'], 
    queryFn: appointmentsAPI.getAll,
    enabled: !!viewingHistoryCustomer
  });

  // --- ESTATÍSTICAS RÁPIDAS ---
  const quickStats = useMemo(() => {
      const novos = customers.filter(c => c.category === 'novo').length;
      const recorrentes = customers.filter(c => c.category === 'recorrente').length;
      const fidelizados = customers.filter(c => c.category === 'fidelizado').length;
      return { novos, recorrentes, fidelizados };
  }, [customers]);

  // --- LISTAS FILTRADAS ---
  const referralsList = useMemo(() => {
      if (!viewingReferralsCustomer) return [];
      return customers.filter(c => c.referrer_name === viewingReferralsCustomer.full_name);
  }, [customers, viewingReferralsCustomer]);

  const customerHistory = useMemo(() => {
      if (!viewingHistoryCustomer) return [];
      return allAppointments
        .filter(app => {
            const appId = typeof app.customer === 'object' ? app.customer.id : app.customer;
            return appId === viewingHistoryCustomer.id;
        })
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [allAppointments, viewingHistoryCustomer]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.whatsapp.includes(searchTerm);
      const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [customers, searchTerm, categoryFilter]);

  const paginatedCustomers = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const loyaltyRanking = useMemo(() => {
    return [...customers].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 5);
  }, [customers]);

  // --- MUTATIONS ---
  const createMutation = useMutation({
    mutationFn: customersAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsCustomerModalOpen(false);
      toast.success("Cliente cadastrado!");
    },
    onError: () => toast.error("Erro ao cadastrar.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => customersAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsCustomerModalOpen(false);
      toast.success("Cliente atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar.")
  });

  const deleteMutation = useMutation({
    mutationFn: customersAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success("Cliente removido.");
    },
    onError: () => toast.error("Erro ao remover.")
  });

  const updatePointsMutation = useMutation({
    mutationFn: ({ id, points }: { id: string, points: number }) => customersAPI.update(id, { points }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsPointsModalOpen(false);
      setAdjustingPointsCustomer(null);
      setPointsAdjustment(0);
      toast.success("Pontos atualizados!");
    },
    onError: () => toast.error("Erro ao atualizar pontos.")
  });

  // --- HANDLERS ---
  const handleOpenNew = () => {
    setEditingCustomer(null);
    setFormData({ full_name: "", whatsapp: "", email: "", birth_date: "", notes: "", category: "novo", referrer_info: "" });
    setIsCustomerModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      full_name: customer.full_name, whatsapp: customer.whatsapp,
      email: customer.email || "", 
      birth_date: customer.birth_date || "", 
      notes: customer.notes || "", category: customer.category || "novo",
      referrer_info: customer.referrer_name || "" 
    });
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = () => {
    if (!formData.full_name || !formData.whatsapp) return toast.warning("Nome e WhatsApp obrigatórios.");
    
    const payload = { 
        ...formData,
        birth_date: formData.birth_date ? formData.birth_date : null 
    };

    if (editingCustomer) updateMutation.mutate({ id: editingCustomer.id, data: payload });
    else createMutation.mutate(payload);
  };

  const handleOpenPoints = (customer: Customer) => {
    setAdjustingPointsCustomer(customer);
    setPointsAdjustment(customer.points || 0);
    setIsPointsModalOpen(true);
  };

  const openWhatsApp = (phone: string) => {
      const cleanPhone = phone.replace(/\D/g, "");
      window.open(`https://wa.me/55${cleanPhone}`, '_blank');
  }

  const renderCategoryBadge = (category: string) => {
    const styles = {
      fidelizado: "bg-[#C6A87C] hover:bg-[#B08D55]",
      recorrente: "bg-blue-500 hover:bg-blue-600",
      novo: "bg-stone-400 hover:bg-stone-500"
    };
    return <Badge className={`${styles[category as keyof typeof styles] || styles.novo} capitalize`}>{category}</Badge>;
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'completed': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">Concluído</Badge>;
          case 'confirmed': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">Agendado</Badge>;
          case 'cancelled': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none">Cancelado</Badge>;
          default: return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none">Pendente</Badge>;
      }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans pb-20">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <Users className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Clientes
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">
            Gestão da base de clientes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <Button onClick={handleOpenNew} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white shadow-md font-medium px-6 w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" /> Novo Cliente
            </Button>
        </div>
      </div>

      {/* 🟢 BARRA DE INDICADORES MINIMALISTA (SEM FUNDO) */}
      <div className="flex flex-wrap items-center gap-6 mb-6 px-1">
          {/* Novos */}
          <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-stone-400" />
              <span className="text-sm font-medium text-stone-500">Novos:</span>
              <span className="text-sm font-bold text-stone-800 dark:text-stone-100">{quickStats.novos}</span>
          </div>

          {/* Separador */}
          <div className="h-4 w-px bg-stone-200 dark:bg-stone-800 hidden sm:block"></div>

          {/* Recorrentes */}
          <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm font-medium text-stone-500">Recorrentes:</span>
              <span className="text-sm font-bold text-stone-800 dark:text-stone-100">{quickStats.recorrentes}</span>
          </div>

          {/* Separador */}
          <div className="h-4 w-px bg-stone-200 dark:bg-stone-800 hidden sm:block"></div>

          {/* Fidelizados */}
          <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#C6A87C]" />
              <span className="text-sm font-medium text-stone-500">Fidelizados:</span>
              <span className="text-sm font-bold text-stone-800 dark:text-stone-100">{quickStats.fidelizados}</span>
          </div>
      </div>

      {/* TABS E FILTROS */}
      <Tabs defaultValue="list" className="space-y-6" onValueChange={setActiveTab}>
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <TabsList className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-1 rounded-xl h-auto w-full xl:w-auto grid grid-cols-2 xl:flex">
            <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">
               <Users className="w-4 h-4 mr-2" /> Lista de Clientes
            </TabsTrigger>
            <TabsTrigger value="ranking" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">
               <Award className="w-4 h-4 mr-2" /> Top Fidelidade
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            <div className="relative min-w-[140px]">
               <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 rounded-xl pl-3">
                     <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">Todas Categorias</SelectItem>
                     <SelectItem value="novo">Novos</SelectItem>
                     <SelectItem value="recorrente">Recorrentes</SelectItem>
                     <SelectItem value="fidelizado">Fidelizados</SelectItem>
                  </SelectContent>
               </Select>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input 
                placeholder="Buscar por nome, whats..." 
                className="pl-9 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 rounded-xl focus:ring-[#C6A87C]/20"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>

        {/* --- LISTA DE CARDS --- */}
        <TabsContent value="list" className="mt-0">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-3">
               <div className="w-8 h-8 border-4 border-[#C6A87C]/30 border-t-[#C6A87C] rounded-full animate-spin"></div>
               <p className="text-stone-400 text-sm">Carregando clientes...</p>
             </div>
          ) : filteredCustomers.length > 0 ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {paginatedCustomers.map((customer) => (
                <Card key={customer.id} className="group border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all bg-white dark:bg-stone-900 overflow-hidden">
                  <CardContent className="p-5">
                    
                    {/* Header do Card */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 shrink-0 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 font-bold text-lg border border-stone-200 dark:border-stone-700">
                          {customer.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-stone-800 dark:text-stone-100 truncate pr-2" title={customer.full_name}>{customer.full_name}</h3>
                          <p 
                            className="text-xs text-stone-400 flex items-center gap-1 hover:text-green-600 cursor-pointer transition-colors"
                            onClick={() => openWhatsApp(customer.whatsapp)}
                            title="Conversar no WhatsApp"
                          >
                             <MessageCircle className="w-3 h-3" /> {customer.whatsapp}
                          </p>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-[#C6A87C]">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleOpenEdit(customer)}>
                             <Edit className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenPoints(customer)}>
                             <Gem className="w-4 h-4 mr-2" /> Pontos
                          </DropdownMenuItem>
                          {/* Botão de Histórico */}
                          <DropdownMenuItem onClick={() => setViewingHistoryCustomer(customer)}>
                             <History className="w-4 h-4 mr-2" /> Histórico
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if(confirm("Excluir cliente?")) deleteMutation.mutate(customer.id) }} className="text-red-500 focus:text-red-600">
                             <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Dados Básicos */}
                    <div className="grid grid-cols-2 gap-2 text-sm mt-4 pt-4 border-t border-stone-50 dark:border-stone-800">
                       
                       {/* BOTÃO DE VISITAS -> ABRE POPUP DE HISTÓRICO */}
                       <div 
                          className="bg-stone-50 dark:bg-stone-950 p-2 rounded-lg flex flex-col items-center justify-center border border-stone-100 dark:border-stone-800 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors group/visits relative"
                          onClick={() => setViewingHistoryCustomer(customer)}
                          title="Ver Histórico Completo"
                       >
                          <div className="absolute top-1 right-1 opacity-0 group-hover/visits:opacity-100 transition-opacity">
                              <ExternalLink className="w-3 h-3 text-stone-400" />
                          </div>
                          <span className="text-[10px] text-stone-400 uppercase tracking-wide font-semibold">Visitas</span>
                          <span className="font-bold text-stone-700 dark:text-stone-200">{customer.visits}</span>
                       </div>

                       <div 
                          className="bg-[#C6A87C]/5 p-2 rounded-lg flex flex-col items-center justify-center border border-[#C6A87C]/20 cursor-pointer hover:bg-[#C6A87C]/10 transition-colors"
                          onClick={() => handleOpenPoints(customer)}
                       >
                          <span className="text-[10px] text-[#C6A87C] uppercase tracking-wide font-semibold">Pontos</span>
                          <span className="font-bold text-[#C6A87C] flex items-center gap-1">
                             <Gem className="w-3 h-3" /> {customer.points || 0}
                          </span>
                       </div>
                    </div>

                    {/* SEÇÃO INDICAÇÃO */}
                    <div className="mt-3 pt-3 border-t border-dashed border-stone-100 dark:border-stone-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-stone-400 flex items-center gap-1">
                                <Gift className="w-3 h-3"/> Indicado por:
                            </span>
                            <span className="font-medium text-stone-600 dark:text-stone-300 truncate max-w-[100px]" title={customer.referrer_name}>
                                {customer.referrer_name || "-"}
                            </span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1 text-stone-400">
                                <UserPlus className="w-3 h-3"/> Indicações feitas:
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="w-3 h-3 text-stone-300 hover:text-[#C6A87C] cursor-help"/>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[200px] text-xs bg-stone-800 text-white border-stone-700">
                                        O bônus só é liberado após a pessoa indicada concluir o 1º serviço.
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            
                            {customer.referral_count && customer.referral_count > 0 ? (
                                <Badge 
                                    variant="secondary" 
                                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none text-[10px] px-2 h-5 cursor-pointer transition-transform active:scale-95"
                                    onClick={() => setViewingReferralsCustomer(customer)}
                                >
                                    {customer.referral_count} amigos
                                </Badge>
                            ) : (
                                <span className="text-stone-300">-</span>
                            )}
                        </div>
                    </div>

                    {/* Rodapé: Categoria e Data */}
                    <div className="mt-3 pt-3 flex justify-between items-center border-t border-stone-50 dark:border-stone-800">
                       {renderCategoryBadge(customer.category)}
                       {customer.last_visit && (
                         <span className="text-[10px] text-stone-400 flex items-center gap-1 bg-stone-50 dark:bg-stone-800 px-2 py-1 rounded-full">
                           <CalendarIcon className="w-3 h-3" /> 
                           {format(parseISO(customer.last_visit), "dd/MM/yy")}
                         </span>
                       )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 bg-white p-3 rounded-xl border border-stone-100 shadow-sm">
                    <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-stone-500 hover:text-[#C6A87C]">
                        <ArrowLeft className="w-4 h-4 mr-2"/> Anterior
                    </Button>
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-stone-500 hover:text-[#C6A87C]">
                        Próxima <ArrowRight className="w-4 h-4 ml-2"/>
                    </Button>
                </div>
            )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-stone-400 bg-white dark:bg-stone-900 rounded-xl border border-dashed border-stone-200 dark:border-stone-800">
               <Users className="w-12 h-12 mb-4 opacity-20" />
               <p>Nenhum cliente encontrado.</p>
               {searchTerm || categoryFilter !== 'all' ? (
                 <Button variant="ghost" onClick={() => { setSearchTerm(""); setCategoryFilter("all"); }} className="text-[#C6A87C] hover:text-[#B08D55] hover:bg-stone-50 mt-2">
                   Limpar filtros
                 </Button>
               ) : null}
            </div>
          )}
        </TabsContent>

        {/* --- RANKING (Mantido) --- */}
        <TabsContent value="ranking">
          <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-stone-800 dark:text-stone-100">
                 <Award className="w-5 h-5 text-[#C6A87C]" />
                 Top Clientes (Pontos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loyaltyRanking.length > 0 ? (
                <div className="space-y-2">
                  {loyaltyRanking.map((customer, index) => (
                    <div key={customer.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors border border-transparent hover:border-stone-100 dark:hover:border-stone-800">
                      <div className="flex items-center gap-4">
                        <div className={`
                           w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm
                           ${index === 0 ? "bg-yellow-100 text-yellow-700 border border-yellow-200" : 
                             index === 1 ? "bg-stone-200 text-stone-700 border border-stone-300" : 
                             index === 2 ? "bg-orange-100 text-orange-700 border border-orange-200" : "bg-stone-50 text-stone-400 border border-stone-100"}
                        `}>
                           {index + 1}º
                        </div>
                        <div>
                          <p className="font-bold text-stone-700 dark:text-stone-200 text-sm">{customer.full_name}</p>
                          <div className="flex items-center gap-2">
                             <p className="text-xs text-stone-400 capitalize">{customer.category}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="px-3 py-1 bg-[#C6A87C]/10 rounded-full text-[#C6A87C] text-xs font-bold flex items-center gap-1 border border-[#C6A87C]/20">
                            <Gem className="w-3 h-3" /> {customer.points} pts
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                   <Award className="w-12 h-12 mx-auto text-stone-200 mb-2" />
                   <p className="text-stone-400">Ainda não há pontuações registradas.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- MODAL NOVO/EDITAR CLIENTE --- */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[85vh] overflow-y-auto bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
          <DialogHeader>
            <DialogTitle className="text-stone-800 dark:text-stone-100">
               {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>WhatsApp</Label><Input value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} /></div>
                <div className="space-y-2"><Label>Nascimento</Label><Input type="date" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Gift className="w-3 h-3 text-[#C6A87C]" /> Quem indicou?</Label>
              <Input placeholder="Nome ou WhatsApp..." value={formData.referrer_info} onChange={e => setFormData({...formData, referrer_info: e.target.value})} disabled={!!editingCustomer && !!formData.referrer_info} />
            </div>

            <div className="space-y-2"><Label>Categoria</Label><Select value={formData.category} onValueChange={(val: any) => setFormData({...formData, category: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="novo">Novo</SelectItem><SelectItem value="recorrente">Recorrente</SelectItem><SelectItem value="fidelizado">Fidelizado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsCustomerModalOpen(false)}>Cancelar</Button><Button onClick={handleSaveCustomer} className="bg-[#C6A87C] text-white hover:bg-[#B08D55]">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL AJUSTAR PONTOS --- */}
      <Dialog open={isPointsModalOpen} onOpenChange={setIsPointsModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-sm bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
          <DialogHeader><DialogTitle className="flex gap-2"><Gem className="w-5 h-5 text-[#C6A87C]"/> Ajustar Pontos</DialogTitle></DialogHeader>
          <div className="py-6 text-center">
             <div className="text-5xl font-bold text-[#C6A87C] mb-6">{pointsAdjustment}</div>
             <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setPointsAdjustment(p => p - 10)}>-10</Button>
                <Button variant="outline" onClick={() => setPointsAdjustment(p => p - 1)}>-1</Button>
                <Button variant="outline" onClick={() => setPointsAdjustment(p => p + 1)}>+1</Button>
                <Button variant="outline" onClick={() => setPointsAdjustment(p => p + 10)}>+10</Button>
             </div>
          </div>
          <DialogFooter><Button onClick={() => updatePointsMutation.mutate({ id: adjustingPointsCustomer!.id, points: pointsAdjustment })} className="bg-[#C6A87C] text-white w-full">Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL DE LISTA DE INDICAÇÕES (RESPONSIVO) --- */}
      <Dialog open={!!viewingReferralsCustomer} onOpenChange={() => setViewingReferralsCustomer(null)}>
        <DialogContent className="w-[95vw] max-w-md max-h-[80vh] bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 p-0 overflow-hidden rounded-xl">
            <DialogHeader className="p-4 border-b border-stone-100 dark:border-stone-800">
                <DialogTitle className="flex flex-col gap-1 text-center">
                    <span className="text-xs text-stone-400 font-normal uppercase tracking-wider">Indicações feitas por</span>
                    <span className="text-lg font-bold text-stone-800 dark:text-stone-100">{viewingReferralsCustomer?.full_name}</span>
                </DialogTitle>
                <DialogDescription className="text-center text-xs text-stone-400">
                    Lista de amigos que este cliente indicou.
                </DialogDescription>
            </DialogHeader>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                {referralsList.length > 0 ? (
                    referralsList.map((referral, index) => (
                        <div key={referral.id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-100 dark:border-stone-800">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white dark:bg-stone-800 flex items-center justify-center text-xs font-bold text-stone-500 border border-stone-200 dark:border-stone-700 shadow-sm">
                                    {index + 1}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-stone-700 dark:text-stone-200">{referral.full_name}</p>
                                    <p className="text-[10px] text-stone-400">Desde {format(parseISO(referral.created_at), 'dd/MM/yyyy')}</p>
                                </div>
                            </div>
                            {referral.visits > 0 ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex gap-1 h-6 px-2"><CheckCircle2 className="w-3 h-3"/> Validado</Badge> : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex gap-1 h-6 px-2"><Info className="w-3 h-3"/> Pendente</Badge>}
                        </div>
                    ))
                ) : <div className="text-center py-8 text-stone-400 border-2 border-dashed border-stone-100 rounded-xl"><Users className="w-10 h-10 mx-auto mb-2 opacity-20"/><p className="text-sm">Nenhuma indicação.</p></div>}
            </div>
            <DialogFooter className="p-4 border-t border-stone-100 bg-stone-50/50"><Button variant="outline" onClick={() => setViewingReferralsCustomer(null)} className="w-full">Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- NOVO: MODAL DE HISTÓRICO DE AGENDAMENTOS (POP-UP) --- */}
      <Dialog open={!!viewingHistoryCustomer} onOpenChange={() => setViewingHistoryCustomer(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 p-0 overflow-hidden rounded-xl">
            <DialogHeader className="p-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50">
                <DialogTitle className="flex flex-col gap-1">
                    <span className="text-xs text-stone-400 font-normal uppercase tracking-wider">Histórico de Visitas</span>
                    <span className="text-xl font-bold text-stone-800 dark:text-stone-100">{viewingHistoryCustomer?.full_name}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-stone-400">
                    Total de {customerHistory.length} agendamentos registrados.
                </DialogDescription>
            </DialogHeader>
            
            <div className="p-0 overflow-y-auto max-h-[60vh]">
                {customerHistory.length > 0 ? (
                    <div className="divide-y divide-stone-100 dark:divide-stone-800">
                        {customerHistory.map((app) => (
                            <div key={app.id} className="p-4 hover:bg-stone-50 transition-colors flex items-center justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="flex flex-col items-center justify-center bg-stone-100 rounded-lg p-2 min-w-[50px]">
                                        <span className="text-lg font-bold text-stone-700 leading-none">
                                            {format(parseISO(app.start_time), 'dd')}
                                        </span>
                                        <span className="text-[10px] text-stone-500 uppercase font-medium">
                                            {format(parseISO(app.start_time), 'MMM', { locale: ptBR })}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-stone-800 text-sm mb-0.5">{app.service_name}</p>
                                        <div className="flex items-center gap-2 text-xs text-stone-500">
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {format(parseISO(app.start_time), 'HH:mm')}</span>
                                            <span className="w-1 h-1 rounded-full bg-stone-300"></span>
                                            <span className="flex items-center gap-1"><User className="w-3 h-3"/> {app.staff_name}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1">
                                    {getStatusBadge(app.status)}
                                    {app.final_amount_centavos ? (
                                        <span className="text-[10px] font-bold text-stone-600">R$ {(app.final_amount_centavos/100).toFixed(2)}</span>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-stone-400">
                        <History className="w-10 h-10 mb-2 opacity-20"/>
                        <p className="text-sm">Nenhuma visita registrada.</p>
                    </div>
                )}
            </div>
            
            <DialogFooter className="p-4 border-t border-stone-100 bg-white">
                <Button variant="outline" onClick={() => setViewingHistoryCustomer(null)} className="w-full">Fechar Histórico</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}