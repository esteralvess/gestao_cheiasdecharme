import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Search, 
  Plus, 
  Users, 
  Award, 
  Gem, 
  Phone, 
  Calendar as CalendarIcon, 
  MoreHorizontal,
  Edit,
  Filter,
  Trash2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { customersAPI } from "@/services/api";
import { format, parseISO } from 'date-fns';

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
    last_appointment_status: "confirmed" | "completed" | "cancelled" | "pending";
    last_visit?: string; 
    points: number; 
}

export default function Customers() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("list");
  
  // Estados dos Modais
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [adjustingPointsCustomer, setAdjustingPointsCustomer] = useState<Customer | null>(null);
  const [pointsAdjustment, setPointsAdjustment] = useState(0);

  // Formulário Cliente
  const [formData, setFormData] = useState({
    full_name: "", whatsapp: "", email: "", birth_date: "", notes: "", category: "novo"
  });

  // --- QUERIES ---
  const { data: customers = [], isLoading } = useQuery<Customer[]>({ 
    queryKey: ['customers'], 
    queryFn: customersAPI.getAll 
  });

  // --- PROCESSAMENTO ---
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.whatsapp.includes(searchTerm);
      const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [customers, searchTerm, categoryFilter]);

  const loyaltyRanking = useMemo(() => {
    return [...customers].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10);
  }, [customers]);

  // --- MUTATIONS ---
  const createMutation = useMutation({
    mutationFn: customersAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsCustomerModalOpen(false);
      toast.success("Cliente cadastrado com sucesso!");
    },
    onError: () => toast.error("Erro ao cadastrar cliente.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => customersAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
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
    setFormData({ full_name: "", whatsapp: "", email: "", birth_date: "", notes: "", category: "novo" });
    setIsCustomerModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      full_name: customer.full_name,
      whatsapp: customer.whatsapp,
      email: customer.email || "",
      birth_date: customer.birth_date || "",
      notes: customer.notes || "",
      category: customer.category || "novo"
    });
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = () => {
    if (!formData.full_name || !formData.whatsapp) {
      toast.warning("Nome e WhatsApp são obrigatórios.");
      return;
    }
    
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenPoints = (customer: Customer) => {
    setAdjustingPointsCustomer(customer);
    setPointsAdjustment(customer.points || 0);
    setIsPointsModalOpen(true);
  };

  const handleSavePoints = () => {
    if (adjustingPointsCustomer) {
      updatePointsMutation.mutate({ id: adjustingPointsCustomer.id, points: pointsAdjustment });
    }
  };

  // --- RENDERIZADORES ---
  const renderCategoryBadge = (category: string) => {
    switch (category) {
      case "fidelizado": return <Badge className="bg-[#C6A87C] hover:bg-[#B08D55]">Fidelizado</Badge>;
      case "recorrente": return <Badge className="bg-blue-500 hover:bg-blue-600">Recorrente</Badge>;
      default: return <Badge variant="outline" className="text-stone-500">Novo</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <Users className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Clientes
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">
            Base de contatos e fidelidade.
          </p>
        </div>
        <Button onClick={handleOpenNew} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white shadow-md font-medium px-6 w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      {/* TABS E FILTROS */}
      <Tabs defaultValue="list" className="space-y-6" onValueChange={setActiveTab}>
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <TabsList className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-1 rounded-xl h-auto w-full xl:w-auto grid grid-cols-2 xl:flex">
            <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">
               <Users className="w-4 h-4 mr-2" /> Lista
            </TabsTrigger>
            <TabsTrigger value="ranking" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">
               <Award className="w-4 h-4 mr-2" /> Ranking
            </TabsTrigger>
          </TabsList>

          {/* BARRA DE FILTROS */}
          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            
            {/* Filtro de Categoria */}
            <div className="relative min-w-[140px]">
               <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 rounded-xl pl-9">
                     <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                     <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">Todos</SelectItem>
                     <SelectItem value="novo">Novos</SelectItem>
                     <SelectItem value="recorrente">Recorrentes</SelectItem>
                     <SelectItem value="fidelizado">Fidelizados</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            {/* Busca */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input 
                placeholder="Buscar por nome ou whats..." 
                className="pl-9 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 rounded-xl focus:ring-[#C6A87C]/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* --- LISTA DE CLIENTES --- */}
        <TabsContent value="list" className="mt-0">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-3">
               <div className="w-8 h-8 border-4 border-[#C6A87C]/30 border-t-[#C6A87C] rounded-full animate-spin"></div>
               <p className="text-stone-400 text-sm">Carregando clientes...</p>
             </div>
          ) : filteredCustomers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCustomers.map((customer) => (
                <Card key={customer.id} className="group border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all bg-white dark:bg-stone-900 overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 font-bold text-lg border border-stone-200 dark:border-stone-700">
                          {customer.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-stone-800 dark:text-stone-100 line-clamp-1">{customer.full_name}</h3>
                          <p className="text-xs text-stone-400 flex items-center gap-1">
                             <Phone className="w-3 h-3" /> {customer.whatsapp}
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
                          <DropdownMenuItem onClick={() => { if(confirm("Excluir cliente?")) deleteMutation.mutate(customer.id) }} className="text-red-500 focus:text-red-600">
                             <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mt-4 pt-4 border-t border-stone-50 dark:border-stone-800">
                       <div className="bg-stone-50 dark:bg-stone-950 p-2 rounded-lg flex flex-col items-center justify-center border border-stone-100 dark:border-stone-800">
                          <span className="text-[10px] text-stone-400 uppercase tracking-wide font-semibold">Visitas</span>
                          <span className="font-bold text-stone-700 dark:text-stone-200">{customer.visits}</span>
                       </div>
                       <div className="bg-[#C6A87C]/5 p-2 rounded-lg flex flex-col items-center justify-center border border-[#C6A87C]/20">
                          <span className="text-[10px] text-[#C6A87C] uppercase tracking-wide font-semibold">Pontos</span>
                          <span className="font-bold text-[#C6A87C] flex items-center gap-1">
                             <Gem className="w-3 h-3" /> {customer.points || 0}
                          </span>
                       </div>
                    </div>
                    
                    <div className="mt-3 flex justify-between items-center">
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
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-stone-400 bg-white dark:bg-stone-900 rounded-xl border border-dashed border-stone-200 dark:border-stone-800">
               <Users className="w-12 h-12 mb-4 opacity-20" />
               <p>Nenhum cliente encontrado.</p>
               {searchTerm || categoryFilter !== 'all' ? (
                 // 👇 CORREÇÃO: variant="ghost" em vez de "link"
                 <Button variant="ghost" onClick={() => { setSearchTerm(""); setCategoryFilter("all"); }} className="text-[#C6A87C] hover:text-[#B08D55] hover:bg-stone-50 mt-2">
                   Limpar filtros
                 </Button>
               ) : null}
            </div>
          )}
        </TabsContent>

        {/* --- RANKING DE FIDELIDADE --- */}
        <TabsContent value="ranking">
          <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-stone-800 dark:text-stone-100">
                 <Award className="w-5 h-5 text-[#C6A87C]" />
                 Top 10 Clientes Fiéis
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
                          <p className="text-xs text-stone-400 capitalize">{customer.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="px-3 py-1 bg-[#C6A87C]/10 rounded-full text-[#C6A87C] text-xs font-bold flex items-center gap-1 border border-[#C6A87C]/20">
                            <Gem className="w-3 h-3" /> {customer.points}
                         </div>
                         <Button variant="ghost" size="icon" onClick={() => handleOpenPoints(customer)} className="h-8 w-8">
                            <Edit className="w-4 h-4 text-stone-400 hover:text-[#C6A87C]" />
                         </Button>
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
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
          <DialogHeader>
            <DialogTitle className="text-stone-800 dark:text-stone-100">
               {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-stone-500 uppercase">Nome Completo</Label>
              <Input className="bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-stone-500 uppercase">WhatsApp</Label>
                  <Input className="bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800" placeholder="(11) 9..." value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-stone-500 uppercase">Nascimento</Label>
                  <Input type="date" className="bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} />
                </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-stone-500 uppercase">Email (Opcional)</Label>
              <Input className="bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-stone-500 uppercase">Categoria</Label>
              <Select value={formData.category} onValueChange={(val: any) => setFormData({...formData, category: val})}>
                <SelectTrigger className="bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="fidelizado">Fidelizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-stone-500 uppercase">Observações</Label>
              <Textarea className="bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 resize-none h-20" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomerModalOpen(false)} className="dark:text-stone-300">Cancelar</Button>
            <Button onClick={handleSaveCustomer} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL AJUSTAR PONTOS --- */}
      <Dialog open={isPointsModalOpen} onOpenChange={setIsPointsModalOpen}>
        <DialogContent className="sm:max-w-sm bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-800 dark:text-stone-100">
               <Gem className="w-5 h-5 text-[#C6A87C]" /> Ajustar Pontos
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
             <div className="text-5xl font-bold text-[#C6A87C] mb-2 font-mono tracking-tighter">{pointsAdjustment}</div>
             <p className="text-sm text-stone-400 mb-6 uppercase tracking-wide font-medium">Saldo atual</p>
             
             <div className="flex justify-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setPointsAdjustment(p => p - 10)} className="h-10 w-10 rounded-full border-stone-200 text-stone-500 hover:text-red-500 hover:border-red-200 font-bold">-10</Button>
                <Button variant="outline" size="icon" onClick={() => setPointsAdjustment(p => p - 1)} className="h-10 w-10 rounded-full border-stone-200 text-stone-500 hover:text-red-500 hover:border-red-200 font-bold">-1</Button>
                <Button variant="outline" size="icon" onClick={() => setPointsAdjustment(p => p + 1)} className="h-10 w-10 rounded-full border-stone-200 text-stone-500 hover:text-emerald-500 hover:border-emerald-200 font-bold">+1</Button>
                <Button variant="outline" size="icon" onClick={() => setPointsAdjustment(p => p + 10)} className="h-10 w-10 rounded-full border-stone-200 text-stone-500 hover:text-emerald-500 hover:border-emerald-200 font-bold">+10</Button>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPointsModalOpen(false)} className="dark:text-stone-300">Cancelar</Button>
            <Button onClick={handleSavePoints} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}