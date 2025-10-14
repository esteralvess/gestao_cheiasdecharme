import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Users, TrendingUp, Award, X, Gem, Phone, Bot, User, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { customersAPI, referralsAPI } from "@/services/api";
import { format } from 'date-fns';

// --- Tipagem de Dados ---

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
    points?: number; 
    referrals?: number; 
    chat_status?: string; 
}
interface Referral { id: string; referrer_customer: string; referrer_customer_name: string; referred_customer: string; referred_customer_name: string; status: 'pending' | 'completed' | 'reward_used'; created_at: string; }

const ALL_FILTER = "all";

// --- Componente: Modal de Edição de Cliente ---

interface CustomerEditModalProps {
    customer: Partial<Customer> | null;
    onClose: () => void;
    onSave: (customerData: Partial<Customer>) => void;
    isSaving: boolean;
}

function CustomerEditModal({ customer, onClose, onSave, isSaving }: CustomerEditModalProps) {
    const isNew = !customer?.id;
    const [formData, setFormData] = useState({
        full_name: '',
        whatsapp: '',
        email: '',
        birth_date: '',
        notes: '',
        chat_status: 'Atendimento Robo',
    });

    useEffect(() => {
        if (customer) {
            setFormData({
                full_name: customer.full_name || '',
                whatsapp: customer.whatsapp || '',
                email: customer.email || '',
                birth_date: customer.birth_date || '',
                notes: customer.notes || '',
                chat_status: customer.chat_status || 'Atendimento Robo',
            });
        }
    }, [customer]);

    if (!customer) return null;

    const handleSave = () => {
        const dataToSend = {
            ...formData,
            birth_date: formData.birth_date === '' ? null : formData.birth_date,
        };
        onSave({ ...customer, ...dataToSend });
    };

    return (
        <Dialog open={!!customer} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isNew ? 'Novo Cliente' : 'Editar Cliente'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="full_name">Nome Completo</Label>
                        <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData(f => ({...f, full_name: e.target.value}))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp">WhatsApp</Label>
                            <Input id="whatsapp" value={formData.whatsapp} onChange={(e) => setFormData(f => ({...f, whatsapp: e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(f => ({...f, email: e.target.value}))} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <Label htmlFor="birth_date">Data de Nascimento</Label>
                             <Input id="birth_date" type="date" value={formData.birth_date || ''} onChange={(e) => setFormData(f => ({...f, birth_date: e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Status do WhatsApp</Label>
                             <Select value={formData.chat_status} onValueChange={(value) => setFormData(f => ({...f, chat_status: value}))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Atendimento Robo">Atendimento Robo</SelectItem>
                                    <SelectItem value="Atendimento Humano">Atendimento Humano</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData(f => ({...f, notes: e.target.value}))}/>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Salvando..." : "Salvar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Componente: Modal de Ajuste de Pontos ---

interface PointsAdjustModalProps {
    customer: Customer | null;
    onClose: () => void;
    onSave: (payload: { customerId: string, points: number }) => void;
    isSaving: boolean;
}

function PointsAdjustModal({ customer, onClose, onSave, isSaving }: PointsAdjustModalProps) {
    const [points, setPoints] = useState(0);

    useEffect(() => {
        setPoints(0);
    }, [customer]);

    if (!customer) return null;

    const handleAdjust = (action: 'add' | 'remove') => {
        if (points === 0) {
            toast.info("Por favor, insira uma quantidade de pontos.");
            return;
        }

        const pointsToAdjust = action === 'add' ? points : -points;
        onSave({ customerId: customer.id, points: pointsToAdjust });
    };

    return (
        <Dialog open={!!customer} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ajustar Pontos de {customer.full_name}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p>Saldo Atual: <strong className="text-primary">{customer.points ?? 0} pontos</strong></p>
                    <div className="space-y-2">
                        <Label htmlFor="points-adjust">Quantidade</Label>
                        <Input 
                            id="points-adjust"
                            type="number"
                            placeholder="Ex: 50"
                            value={points}
                            onChange={(e) => setPoints(Math.abs(parseInt(e.target.value, 10) || 0))}
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button variant="destructive" onClick={() => handleAdjust('remove')} disabled={isSaving}>
                        Remover Pontos
                    </Button>
                    <Button onClick={() => handleAdjust('add')} disabled={isSaving}>
                        Adicionar Pontos
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Componente Principal da Página ---

export default function Customers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [adjustingPointsCustomer, setAdjustingPointsCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState("customers");
  const [funnelFilter, setFunnelFilter] = useState<string | null>(null);
  const [categoryListFilter, setCategoryListFilter] = useState<string>(ALL_FILTER);
  const [chatStatusFilter, setChatStatusFilter] = useState<string>(ALL_FILTER);
  const [referrerId, setReferrerId] = useState<string>('');

  const { data: rawCustomers, isLoading: isLoadingCustomers } = useQuery<any[]>({
    queryKey: ['customers'],
    queryFn: customersAPI.getAll,
  });
  
  const { data: referrals = [], isLoading: isLoadingReferrals } = useQuery<Referral[]>({
    queryKey: ['referrals'],
    queryFn: referralsAPI.getAll,
  });

  const customers = useMemo<Customer[]>(() => {
    if (!Array.isArray(rawCustomers)) return [];
    return rawCustomers.map(c => ({
      ...c,
      visits: c.visits || 0,
      category: c.category || 'novo',
      last_appointment_status: c.last_appointment_status || 'pending',
      chat_status: c.chat_status || 'Atendimento Robo',
    }));
  }, [rawCustomers]);

  const saveCustomerMutation = useMutation({
      mutationFn: (customerData: Partial<Customer>) => {
          const { id, ...data } = customerData;
          delete (data as any).visits;
          delete (data as any).category;
          delete (data as any).last_appointment_status;
          return id ? customersAPI.update(id, data) : customersAPI.create(data);
      },
      onSuccess: (newCustomerData, variables) => {
          const isNew = !variables.id;
          if (isNew && referrerId && (newCustomerData as Customer).id) {
              createReferralMutation.mutate({
                  referrer_customer: referrerId,
                  referred_customer: (newCustomerData as Customer).id,
              });
          } else {
              toast.success(`Cliente salvo com sucesso!`);
          }
          setEditingCustomer(null);
          queryClient.invalidateQueries({ queryKey: ['customers'] });
      },
      onError: (error: any) => toast.error(error.message || "Ocorreu um erro ao salvar."),
  });

  const createReferralMutation = useMutation({
    mutationFn: (referralData: { referrer_customer: string, referred_customer: string }) => referralsAPI.create(referralData),
    onSuccess: () => {
      toast.success("Nova indicação registrada com sucesso!");
      setReferrerId(''); 
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    },
    onError: (error: any) => toast.error(error.message || "Falha ao registrar indicação."),
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (customerId: string) => customersAPI.delete(customerId),
    onSuccess: () => {
        toast.success("Cliente excluído com sucesso!");
        queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => toast.error(error.message || `Falha ao excluir.`),
  });

  const adjustPointsMutation = useMutation({
    mutationFn: ({ customerId, points }: { customerId: string, points: number }) => 
        customersAPI.adjustPoints(customerId, { points_to_adjust: points }),
    onSuccess: () => {
        toast.success("Pontos ajustados com sucesso!");
        setAdjustingPointsCustomer(null);
        queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => toast.error(error.message || "Falha ao ajustar pontos."),
  });

  const loyaltyRanking = useMemo(() => {
    return [...customers].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    let results = customers;
    if (funnelFilter) {
      results = results.filter(c => c.category === funnelFilter);
    }
    if (categoryListFilter !== ALL_FILTER) {
      results = results.filter(c => c.category === categoryListFilter);
    }
    if (chatStatusFilter !== ALL_FILTER) {
      results = results.filter(c => c.chat_status === chatStatusFilter);
    }
    if (search) {
      results = results.filter(c => (c.full_name || "").toLowerCase().includes(search.toLowerCase()) || (c.whatsapp || "").includes(search));
    }
    return results;
  }, [customers, search, funnelFilter, categoryListFilter, chatStatusFilter]);

  const crmData = useMemo(() => {
    const newCustomers = customers.filter(c => c.category === "novo");
    const recurringCustomers = customers.filter(c => c.category === "recorrente");
    const loyalCustomers = customers.filter(c => c.category === "fidelizado");
    return { newCount: newCustomers.length, recurringCount: recurringCustomers.length, loyalCount: loyalCustomers.length };
  }, [customers]);
  
  const handleOpenNewReferredModal = () => {
    if (!referrerId) {
      toast.warning("Por favor, selecione quem está indicando primeiro.");
      return;
    }
    setEditingCustomer({});
  };
  
  const handleDeleteCustomer = (customer: Customer) => {
    if (window.confirm(`Tem certeza que deseja excluir "${customer.full_name}"?`)) {
        deleteCustomerMutation.mutate(customer.id);
    }
  }

  const handleFunnelClick = (category: string) => {
    setFunnelFilter(category);
    setActiveTab("customers");
  };
  
  const clearAllFilters = () => {
    setSearch("");
    setFunnelFilter(null);
    setCategoryListFilter(ALL_FILTER);
    setChatStatusFilter(ALL_FILTER);
  };

  const handleOpenNewModal = () => setEditingCustomer({});

  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  const categoryColors: Record<string, string> = { novo: "bg-chart-2", recorrente: "bg-chart-3", fidelizado: "bg-chart-1" };

  return (
    <div className="p-6 space-y-6">
      <CustomerEditModal customer={editingCustomer} onClose={() => setEditingCustomer(null)} onSave={saveCustomerMutation.mutate} isSaving={saveCustomerMutation.isPending}/>
      <PointsAdjustModal customer={adjustingPointsCustomer} onClose={() => setAdjustingPointsCustomer(null)} onSave={adjustPointsMutation.mutate} isSaving={adjustPointsMutation.isPending}/>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Clientes</h1>
          <p className="text-muted-foreground">CRM e gestão de relacionamento</p>
        </div>
        <Button onClick={handleOpenNewModal}><Plus className="w-4 h-4 mr-2" />Novo Cliente</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="funnel">Funil CRM</TabsTrigger>
            <TabsTrigger value="referrals">Indicações</TabsTrigger>
            <TabsTrigger value="loyalty">Programa de Pontos</TabsTrigger>
            <TabsTrigger value="automation">Automação</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-6">
          {funnelFilter && (
            <Card className="p-3 bg-muted">
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground">
                  Mostrando apenas clientes da categoria: <strong className="capitalize">{funnelFilter}</strong>
                </p>
                <Button variant="ghost" size="sm" onClick={() => setFunnelFilter(null)}>
                  <X className="w-4 h-4 mr-2" />
                  Limpar Filtro do Funil
                </Button>
              </div>
            </Card>
          )}
          
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="search" placeholder="Buscar por nome ou WhatsApp..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10"/>
            </div>
            <Select value={categoryListFilter} onValueChange={setCategoryListFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>Categorias</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="recorrente">Recorrente</SelectItem>
                <SelectItem value="fidelizado">Fidelizado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={chatStatusFilter} onValueChange={setChatStatusFilter}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Filtrar por Status do Chat" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>Status de Chat</SelectItem>
                <SelectItem value="Atendimento Robo">Atendimento Robo</SelectItem>
                <SelectItem value="Atendimento Humano">Atendimento Humano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={clearAllFilters}>Limpar Filtros</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoadingCustomers ? <p className="col-span-full text-center p-6 text-muted-foreground">Carregando...</p> : filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <Card key={customer.id} className="flex flex-col">
                  <CardHeader className="flex flex-row items-start justify-between pb-4">
                    <div>
                      <CardTitle className="text-lg">{customer.full_name}</CardTitle>
                      {customer.category && <Badge className={`${categoryColors[customer.category]} text-white text-xs`}>{capitalize(customer.category)}</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditingCustomer(customer)}>Editar</Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteCustomer(customer)} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground flex-1">
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> <span>{customer.whatsapp}</span></div>
                    {customer.chat_status === 'Atendimento Robo' ? (
                        <div className="flex items-center gap-2"><Bot className="w-4 h-4" /> <span>{customer.chat_status}</span></div>
                    ) : (
                        <div className="flex items-center gap-2"><User className="w-4 h-4" /> <span>{customer.chat_status}</span></div>
                    )}
                    <div className="flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> <span>{customer.visits ?? 0} visitas</span></div>
                    <div className="flex items-center gap-2"><Gem className="w-4 h-4" /> <span>{customer.points ?? 0} pontos</span></div>
                  </CardContent>
                </Card>
              ))
            ) : <p className="col-span-full text-center p-6 text-muted-foreground">Nenhum cliente encontrado com os filtros aplicados.</p>}
          </div>
        </TabsContent>
        
        <TabsContent value="funnel" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card onClick={() => handleFunnelClick('novo')} className="cursor-pointer hover:border-primary transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clientes Novos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{crmData.newCount}</div>
                        <p className="text-xs text-muted-foreground">Clientes na 1ª visita</p>
                    </CardContent>
                </Card>
                <Card onClick={() => handleFunnelClick('recorrente')} className="cursor-pointer hover:border-primary transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clientes Recorrentes</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{crmData.recurringCount}</div>
                        <p className="text-xs text-muted-foreground">Clientes com 2 a 4 visitas</p>
                    </CardContent>
                </Card>
                <Card onClick={() => handleFunnelClick('fidelizado')} className="cursor-pointer hover:border-primary transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clientes Fidelizados</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{crmData.loyalCount}</div>
                        <p className="text-xs text-muted-foreground">Clientes com 5+ visitas</p>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registrar Nova Indicação</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label>Quem está indicando? (Indicadora)</Label>
                <Select value={referrerId} onValueChange={setReferrerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma cliente existente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleOpenNewReferredModal}>
                <Plus className="w-4 h-4 mr-2" />
                Indicar Nova Amiga
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Indicações</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingReferrals ? <p className="text-muted-foreground text-center p-4">Carregando...</p> : referrals.length > 0 ? (
                referrals.map(ref => (
                  <div key={ref.id} className="flex justify-between items-center p-3 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{ref.referrer_customer_name} <span className="text-muted-foreground font-normal">indicou</span> {ref.referred_customer_name}</p>
                      <p className="text-sm text-muted-foreground">Em: {format(new Date(ref.created_at), 'dd/MM/yyyy')}</p>
                    </div>
                    <Badge variant={ref.status === 'completed' ? 'default' : 'secondary'}>
                      {ref.status === 'pending' && 'Pendente'}
                      {ref.status === 'completed' && 'Recompensa Liberada'}
                      {ref.status === 'reward_used' && 'Recompensa Utilizada'}
                    </Badge>
                  </div>
                ))
              ) : <p className="text-muted-foreground text-center p-4">Nenhuma indicação registrada ainda.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loyalty" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ranking de Fidelidade</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCustomers ? <p className="text-center text-muted-foreground p-4">Carregando...</p> : loyaltyRanking.length > 0 ? (
                loyaltyRanking.map((customer, index) => (
                  <div key={customer.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-lg text-primary w-8 text-center">{index + 1}º</span>
                      <div>
                        <p className="font-medium">{customer.full_name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Gem className="w-3 h-3 text-amber-500" /> {customer.points ?? 0} pontos
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setAdjustingPointsCustomer(customer)}>Ajustar Pontos</Button>
                  </div>
                ))
              ) : <p className="text-center text-muted-foreground p-4">Nenhum cliente com pontos.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation"><p className="text-muted-foreground">Em desenvolvimento.</p></TabsContent>
      </Tabs>
    </div>
  );
}