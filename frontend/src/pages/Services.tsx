import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, XCircle } from "lucide-react"; // Adicionado XCircle
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ServiceCard from "@/components/ServiceCard";
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
// COMPONENTE: MODAL DE EDIÇÃO DE SERVIÇO (ATUALIZADO)
// ===============================================

interface ServiceEditModalProps {
    service: Partial<Service> | null;
    categories: string[]; // ✅ Recebe a lista de categorias existentes
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

    // ✅ Estado para controlar a UI de criação de categoria
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
            // Reseta o estado de criação de categoria ao abrir o modal
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

    // ✅ Função para lidar com a mudança no <Select> de categoria
    const handleCategoryChange = (value: string) => {
        if (value === '--create-new--') {
            setIsCreatingNewCategory(true);
            setFormData(f => ({ ...f, category: '' })); // Limpa a categoria para o novo input
        } else {
            setFormData(f => ({ ...f, category: value }));
        }
    };

    return (
        <Dialog open={!!service} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{isNew ? 'Novo Serviço' : `Editar Serviço: ${service.name}`}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="name">Nome do Serviço</Label>
                            <Input id="name" value={formData.name} onChange={(e) => setFormData(f => ({...f, name: e.target.value}))} />
                        </div>
                        <div>
                            <Label htmlFor="category">Categoria</Label>
                            {isCreatingNewCategory ? (
                                <div className="flex items-center gap-2">
                                    <Input 
                                        placeholder="Nome da nova categoria"
                                        value={formData.category}
                                        onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                                        autoFocus
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => setIsCreatingNewCategory(false)}>
                                        <XCircle className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Select value={formData.category} onValueChange={handleCategoryChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                        <SelectItem value="--create-new--" className="text-primary font-bold">
                                            + Criar nova categoria...
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea id="description" value={formData.description} onChange={(e) => setFormData(f => ({...f, description: e.target.value}))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="price_reais">Preço (R$)</Label>
                            <Input id="price_reais" type="number" step="0.01" value={formData.price_reais} onChange={(e) => setFormData(f => ({...f, price_reais: e.target.value}))} />
                        </div>
                        <div>
                            <Label htmlFor="duration">Duração (minutos)</Label>
                            <Input id="duration" type="number" value={formData.default_duration_min} onChange={(e) => setFormData(f => ({...f, default_duration_min: parseInt(e.target.value, 10)}))} />
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="active" checked={formData.active} onCheckedChange={(checked) => setFormData(f => ({...f, active: checked}))} />
                            <Label htmlFor="active">Ativo</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="popular" checked={formData.popular} onCheckedChange={(checked) => setFormData(f => ({...f, popular: checked}))} />
                            <Label htmlFor="popular">Popular</Label>
                        </div>
                    </div>
                </div>
                <DialogFooter className="flex justify-between">
                    <div>
                        {!isNew && (
                            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? "Excluindo..." : <Trash2 className="w-4 h-4" />}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Salvando..." : "Salvar"}
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
    <div className="p-6 space-y-6">
      <ServiceEditModal
        service={editingService}
        categories={uniqueCategories} // ✅ Passando as categorias para o modal
        onClose={() => setEditingService(null)}
        onSave={saveServiceMutation.mutate}
        onDelete={deleteServiceMutation.mutate}
        isSaving={saveServiceMutation.isPending}
        isDeleting={deleteServiceMutation.isPending}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Serviços</h1>
          <p className="text-muted-foreground">Catálogo de serviços oferecidos</p>
        </div>
        <Button data-testid="button-add-service" onClick={handleOpenNewModal}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nome de serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
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
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="true">Ativos</SelectItem>
                <SelectItem value="false">Inativos</SelectItem>
            </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground pt-10">Carregando serviços...</p>
      ) : Object.keys(servicesByCategory).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-semibold">Nenhum serviço encontrado</p>
          <p className="text-sm">Tente ajustar seus filtros ou cadastre um novo serviço.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(servicesByCategory).sort().map(category => (
            <div key={category}>
              <h2 className="text-2xl font-semibold text-foreground border-b pb-2 mb-4">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {servicesByCategory[category].map((service) => (
                  <ServiceCard
                    key={service.id}
                    name={service.name}
                    category={service.category}
                    description={service.description}
                    duration={service.default_duration_min ?? 0}
                    price={service.price_centavos ?? 0}
                    popular={service.popular}
                    onClick={() => setEditingService(service)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}