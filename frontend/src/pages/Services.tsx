import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Trash2, 
  XCircle, 
  Scissors, 
  Clock, 
  Sparkles, 
  Edit,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { servicesAPI } from "@/services/api";
import { toast } from "sonner";

// --- Tipagem de Dados ---
interface Service {
  id: string;
  name: string;
  category: string;
  description?: string;
  default_duration_min?: number;
  price_centavos?: number;
  active: boolean;
  popular: boolean;
  image_url?: string;
}

// ===============================================
// COMPONENTE: MODAL DE EDIÇÃO DE SERVIÇO
// ===============================================

interface ServiceEditModalProps {
    service: Partial<Service> | null;
    categories: string[];
    onClose: () => void;
    onSave: (serviceData: Partial<Service>) => void;
    onDelete: (serviceId: string) => void;
    isSaving: boolean;
    isDeleting: boolean;
}

function ServiceEditModal({ service, categories, onClose, onSave, onDelete, isSaving, isDeleting }: ServiceEditModalProps) {
    const isNew = !service?.id;
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        description: '',
        default_duration_min: 60,
        price_reais: '0',
        active: true,
        popular: false,
    });

    const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);

    useEffect(() => {
        if (service) {
            setFormData({
                name: service.name || '',
                category: service.category || '',
                description: service.description || '',
                default_duration_min: service.default_duration_min || 60,
                price_reais: service.price_centavos ? (service.price_centavos / 100).toFixed(2) : '0',
                active: service.active ?? true,
                popular: service.popular ?? false,
            });
            setIsCreatingNewCategory(false);
        }
    }, [service]);

    if (!service) return null;

    const handleSave = () => {
        const price_centavos = Math.round(parseFloat(formData.price_reais.replace(',', '.')) * 100);
        const dataToSend: Partial<Service> = {
            ...formData,
            id: service.id,
            price_centavos,
        };
        // @ts-ignore
        delete dataToSend.price_reais;
        onSave(dataToSend);
    };

    const handleDelete = () => {
        if (service.id && window.confirm(`Tem certeza que deseja excluir o serviço "${service.name}"?`)) {
            onDelete(service.id);
        }
    }

    const handleCategoryChange = (value: string) => {
        if (value === '--create-new--') {
            setIsCreatingNewCategory(true);
            setFormData(f => ({ ...f, category: '' }));
        } else {
            setFormData(f => ({ ...f, category: value }));
        }
    };

    return (
        <Dialog open={!!service} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
                <DialogHeader className="border-b border-stone-100 dark:border-stone-800 pb-4">
                    <DialogTitle className="text-stone-800 dark:text-stone-100 flex items-center gap-2">
                        {isNew ? <Plus className="w-5 h-5 text-[#C6A87C]" /> : <Edit className="w-5 h-5 text-[#C6A87C]" />}
                        {isNew ? 'Novo Serviço' : `Editar: ${service.name}`}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="grid gap-5 py-4">
                    {/* Linha 1: Nome e Categoria */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs font-semibold text-stone-500 uppercase">Nome do Serviço</Label>
                            <Input id="name" value={formData.name} onChange={(e) => setFormData(f => ({...f, name: e.target.value}))} className="bg-stone-50 dark:bg-stone-900 border-stone-200" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category" className="text-xs font-semibold text-stone-500 uppercase">Categoria</Label>
                            {isCreatingNewCategory ? (
                                <div className="flex items-center gap-2">
                                    <Input 
                                        placeholder="Nome da nova categoria"
                                        value={formData.category}
                                        onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                                        autoFocus
                                        className="bg-stone-50 dark:bg-stone-900 border-stone-200"
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => setIsCreatingNewCategory(false)} className="text-stone-400 hover:text-red-500">
                                        <XCircle className="w-5 h-5" />
                                    </Button>
                                </div>
                            ) : (
                                <Select value={formData.category} onValueChange={handleCategoryChange}>
                                    <SelectTrigger className="bg-stone-50 dark:bg-stone-900 border-stone-200">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                        <SelectItem value="--create-new--" className="text-[#C6A87C] font-semibold border-t mt-1">
                                            + Criar nova categoria...
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    {/* Linha 2: Descrição */}
                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-xs font-semibold text-stone-500 uppercase">Descrição</Label>
                        <Textarea 
                            id="description" 
                            value={formData.description} 
                            onChange={(e) => setFormData(f => ({...f, description: e.target.value}))} 
                            className="bg-stone-50 dark:bg-stone-900 border-stone-200 resize-none h-20"
                            placeholder="Detalhes do procedimento..."
                        />
                    </div>

                    {/* Linha 3: Preço e Duração */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price_reais" className="text-xs font-semibold text-stone-500 uppercase">Preço (R$)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">R$</span>
                                <Input 
                                    id="price_reais" 
                                    type="number" 
                                    step="0.01" 
                                    value={formData.price_reais} 
                                    onChange={(e) => setFormData(f => ({...f, price_reais: e.target.value}))} 
                                    className="pl-9 bg-stone-50 dark:bg-stone-900 border-stone-200 font-medium"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="duration" className="text-xs font-semibold text-stone-500 uppercase">Duração (min)</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <Input 
                                    id="duration" 
                                    type="number" 
                                    value={formData.default_duration_min} 
                                    onChange={(e) => setFormData(f => ({...f, default_duration_min: parseInt(e.target.value, 10)}))} 
                                    className="pl-9 bg-stone-50 dark:bg-stone-900 border-stone-200"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Linha 4: Switches */}
                    <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800">
                        <div className="flex items-center space-x-2">
                            <Switch id="active" checked={formData.active} onCheckedChange={(checked) => setFormData(f => ({...f, active: checked}))} className="data-[state=checked]:bg-emerald-500" />
                            <Label htmlFor="active" className="cursor-pointer">Ativo no sistema</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="popular" checked={formData.popular} onCheckedChange={(checked) => setFormData(f => ({...f, popular: checked}))} className="data-[state=checked]:bg-[#C6A87C]" />
                            <Label htmlFor="popular" className="cursor-pointer flex items-center gap-1">Popular <Sparkles className="w-3 h-3 text-[#C6A87C]" /></Label>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 justify-between items-center border-t border-stone-100 dark:border-stone-800 pt-4">
                    <div>
                        {!isNew && (
                            <Button variant="ghost" onClick={handleDelete} disabled={isDeleting} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                {isDeleting ? "Excluindo..." : <><Trash2 className="w-4 h-4 mr-2" /> Excluir Serviço</>}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1 sm:flex-none">Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-none bg-[#C6A87C] hover:bg-[#B08D55] text-white">
                            {isSaving ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ===============================================
// COMPONENTE PRINCIPAL DA PÁGINA
// ===============================================
export default function Services() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
  
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<boolean | 'all'>('all');

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: servicesAPI.getAll,
  });

  const saveServiceMutation = useMutation({
    mutationFn: (serviceData: Partial<Service>) => {
        const { id, ...data } = serviceData;
        return id ? servicesAPI.update(id, data) : servicesAPI.create(data);
    },
    onSuccess: (_, variables) => {
        const isNew = !variables.id;
        toast.success(`Serviço ${isNew ? 'criado' : 'atualizado'} com sucesso!`);
        setEditingService(null);
        queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error: any) => toast.error(error.message || "Ocorreu um erro ao salvar o serviço."),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: string) => servicesAPI.delete(serviceId),
    onSuccess: () => {
        toast.success("Serviço excluído com sucesso!");
        setEditingService(null);
        queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error: any) => toast.error(error.message || `Falha ao excluir o serviço.`),
  });

  const uniqueCategories = useMemo(() => {
    const categories = new Set(services.map(s => s.category));
    return Array.from(categories).sort();
  }, [services]);

  const servicesByCategory = useMemo(() => {
    let filtered = services;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(service => service.active === statusFilter);
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }

    if (search) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    return filtered.reduce((acc, service) => {
      const category = service.category || 'Outros';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(service);
      return acc;
    }, {} as Record<string, Service[]>);
  }, [services, search, categoryFilter, statusFilter]);

  const handleOpenNewModal = () => {
    setEditingService({});
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans">
      
      <ServiceEditModal
        service={editingService}
        categories={uniqueCategories}
        onClose={() => setEditingService(null)}
        onSave={saveServiceMutation.mutate}
        onDelete={deleteServiceMutation.mutate}
        isSaving={saveServiceMutation.isPending}
        isDeleting={deleteServiceMutation.isPending}
      />

      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <Scissors className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Catálogo de Serviços
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">
            Gerencie preços, duração e categorias.
          </p>
        </div>
        <Button onClick={handleOpenNewModal} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white shadow-md font-medium px-6 w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Novo Serviço
        </Button>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white dark:bg-stone-900 p-2 md:p-3 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            type="search"
            placeholder="Buscar serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-stone-50 dark:bg-stone-950 border-stone-200 dark:border-stone-800 rounded-lg"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px] bg-stone-50 dark:bg-stone-950 border-stone-200 dark:border-stone-800 rounded-lg">
                    <Filter className="w-3 h-3 mr-2 text-stone-400" />
                    <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select
                value={String(statusFilter)}
                onValueChange={(value) => {
                    if (value === 'all') setStatusFilter('all');
                    else setStatusFilter(value === 'true');
                }}
            >
                <SelectTrigger className="w-[140px] bg-stone-50 dark:bg-stone-950 border-stone-200 dark:border-stone-800 rounded-lg">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Ativos</SelectItem>
                    <SelectItem value="false">Inativos</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-[#C6A87C]/30 border-t-[#C6A87C] rounded-full animate-spin"></div>
            <p className="text-stone-400 text-sm">Carregando catálogo...</p>
        </div>
      ) : Object.keys(servicesByCategory).length === 0 ? (
        <div className="text-center py-16 text-stone-400 bg-white dark:bg-stone-900 rounded-xl border border-dashed border-stone-200 dark:border-stone-800">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Nenhum serviço encontrado</p>
          <p className="text-sm mt-1">Tente ajustar seus filtros ou cadastre um novo serviço.</p>
          {/* ✅ CORREÇÃO AQUI: variant="ghost" em vez de "link" */}
          <Button variant="ghost" onClick={() => { setSearch(""); setCategoryFilter("all"); }} className="text-[#C6A87C] mt-2 hover:bg-stone-50">
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.keys(servicesByCategory).sort().map(category => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3">
                 <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200 uppercase tracking-wider">{category}</h2>
                 <div className="h-px bg-stone-200 dark:bg-stone-800 flex-1"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {servicesByCategory[category].map((service) => (
                  <Card 
                     key={service.id} 
                     className="group border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 bg-white dark:bg-stone-900 overflow-hidden"
                  >
                     <CardContent className="p-0">
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <Badge variant="outline" className="bg-stone-50 dark:bg-stone-800 text-stone-500 border-stone-100 font-normal text-[10px]">
                                   {category}
                                </Badge>
                                {service.popular && (
                                    <Badge className="bg-[#C6A87C]/10 text-[#C6A87C] hover:bg-[#C6A87C]/20 border-0 text-[10px] gap-1 px-2">
                                       <Sparkles className="w-3 h-3" /> Popular
                                    </Badge>
                                )}
                            </div>

                            <h3 className="font-bold text-stone-800 dark:text-stone-100 text-lg mb-1 line-clamp-1">{service.name}</h3>
                            <p className="text-sm text-stone-400 line-clamp-2 min-h-[40px] leading-relaxed">
                               {service.description || "Sem descrição definida."}
                            </p>
                            
                            <div className="mt-4 flex items-center justify-between">
                                <div className="flex flex-col">
                                   <span className="text-[10px] text-stone-400 uppercase font-semibold">Valor</span>
                                   <span className="text-lg font-bold text-stone-700 dark:text-stone-200">
                                      R$ {((service.price_centavos || 0) / 100).toFixed(2).replace('.', ',')}
                                   </span>
                                </div>
                                <div className="flex flex-col items-end">
                                   <span className="text-[10px] text-stone-400 uppercase font-semibold">Tempo</span>
                                   <div className="flex items-center gap-1 text-sm font-medium text-stone-600 dark:text-stone-300">
                                      <Clock className="w-3 h-3" /> {service.default_duration_min} min
                                   </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-stone-50 dark:bg-stone-950 border-t border-stone-100 dark:border-stone-800 p-3 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                               {!service.active && (
                                   <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Inativo</span>
                               )}
                            </div>
                            <Button 
                               variant="ghost" 
                               size="sm" 
                               onClick={() => setEditingService(service)}
                               className="text-stone-500 hover:text-[#C6A87C] hover:bg-white dark:hover:bg-stone-900"
                            >
                               <Edit className="w-4 h-4 mr-1" /> Editar
                            </Button>
                        </div>
                     </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}