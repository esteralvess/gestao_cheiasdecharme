import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Trash2, 
  MapPin, 
  Pencil, 
  Building2, 
  Navigation,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { locationsAPI } from "@/services/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// --- Tipagem de Dados ---
interface Location {
  id: string;
  name: string;
  slug: string;
  address?: string;
  reference_point?: string;
}

// ===============================================
// FUNÇÃO AUXILIAR para gerar slugs
// ===============================================
const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Substitui espaços por -
    .replace(/[^\w\-]+/g, '')       // Remove caracteres inválidos
    .replace(/\-\-+/g, '-');        // Substitui múltiplos - por um único -

// ===============================================
// COMPONENTE: MODAL DE EDIÇÃO DE UNIDADE
// ===============================================
interface LocationEditModalProps {
    location: Partial<Location> | null;
    onClose: () => void;
    onSave: (locationData: Partial<Location>) => void;
    onDelete: (locationId: string) => void;
    isSaving: boolean;
    isDeleting: boolean;
}

function LocationEditModal({ location, onClose, onSave, onDelete, isSaving, isDeleting }: LocationEditModalProps) {
    const isNew = !location?.id;
    const [formData, setFormData] = useState({ name: '', slug: '', address: '', reference_point: '' });

    useEffect(() => {
        if (location) {
            setFormData({
                name: location.name || '',
                slug: location.slug || '',
                address: location.address || '',
                reference_point: location.reference_point || '',
            });
        }
    }, [location]);

    // Auto-gera o slug a partir do nome, apenas se for uma nova unidade
    useEffect(() => {
        if (isNew) {
            setFormData(f => ({ ...f, slug: slugify(f.name) }));
        }
    }, [formData.name, isNew]);

    if (!location) return null;

    const handleSave = () => {
        onSave({ ...location, ...formData });
    };

    const handleDelete = () => {
        if (location.id && window.confirm(`Tem certeza que deseja excluir a unidade "${location.name}"?`)) {
            onDelete(location.id);
        }
    }

    return (
        <Dialog open={!!location} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
                <DialogHeader className="border-b border-stone-100 dark:border-stone-800 pb-4">
                    <DialogTitle className="text-stone-800 dark:text-stone-100 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#C6A87C]" />
                        {isNew ? 'Nova Unidade' : `Editar: ${location.name}`}
                    </DialogTitle>
                    <DialogDescription>
                        Configure os detalhes de endereço e identificação.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs font-semibold text-stone-500 uppercase">Nome da Unidade</Label>
                            <Input id="name" className="bg-stone-50 dark:bg-stone-900 border-stone-200" value={formData.name} onChange={(e) => setFormData(f => ({...f, name: e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="slug" className="text-xs font-semibold text-stone-500 uppercase">Slug (URL)</Label>
                            <Input id="slug" className="bg-stone-50 dark:bg-stone-900 border-stone-200 text-stone-400" value={formData.slug} onChange={(e) => setFormData(f => ({...f, slug: slugify(e.target.value)}))} />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="address" className="text-xs font-semibold text-stone-500 uppercase">Endereço Completo</Label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <Input id="address" className="pl-9 bg-stone-50 dark:bg-stone-900 border-stone-200" placeholder="Rua, Número, Bairro..." value={formData.address} onChange={(e) => setFormData(f => ({...f, address: e.target.value}))} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reference_point" className="text-xs font-semibold text-stone-500 uppercase">Ponto de Referência</Label>
                        <div className="relative">
                            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <Input id="reference_point" className="pl-9 bg-stone-50 dark:bg-stone-900 border-stone-200" placeholder="Próximo ao..." value={formData.reference_point} onChange={(e) => setFormData(f => ({...f, reference_point: e.target.value}))} />
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 justify-between items-center border-t border-stone-100 dark:border-stone-800 pt-4">
                    <div>
                        {!isNew && (
                            <Button variant="ghost" onClick={handleDelete} disabled={isDeleting} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                {isDeleting ? "Excluindo..." : <><Trash2 className="w-4 h-4 mr-2" /> Excluir</>}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1 sm:flex-none dark:text-stone-300">Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-none bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold">
                            {isSaving ? "Salvando..." : "Salvar"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ===============================================
// COMPONENTE: CARD DA UNIDADE
// ===============================================
interface LocationCardProps extends Location {
    onClick: () => void;
}

function LocationCard({ name, address, reference_point, onClick }: LocationCardProps) {
    return (
        <Card className="group border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 bg-white dark:bg-stone-900 cursor-pointer" onClick={onClick}>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-full bg-[#C6A87C]/10 flex items-center justify-center text-[#C6A87C] group-hover:bg-[#C6A87C] group-hover:text-white transition-colors">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-[#C6A87C]">
                        <Pencil className="w-4 h-4" />
                    </Button>
                </div>
                <CardTitle className="text-lg font-bold text-stone-800 dark:text-stone-100 mt-3">
                    {name}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm text-stone-500 dark:text-stone-400">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#C6A87C]" />
                    <span className="line-clamp-2">{address || 'Endereço não informado'}</span>
                </div>
                {reference_point && (
                    <div className="flex items-center gap-2 text-xs text-stone-400 bg-stone-50 dark:bg-stone-950 p-2 rounded-lg">
                        <Navigation className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{reference_point}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ===============================================
// COMPONENTE PRINCIPAL DA PÁGINA
// ===============================================
export default function Locations() {
  const queryClient = useQueryClient();
  const [editingLocation, setEditingLocation] = useState<Partial<Location> | null>(null);

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: locationsAPI.getAll,
  });

  const saveLocationMutation = useMutation({
    mutationFn: (locationData: Partial<Location>) => {
        const { id, ...data } = locationData;
        return id ? locationsAPI.update(id, data) : locationsAPI.create(data);
    },
    onSuccess: (_, variables) => {
        const isNew = !variables.id;
        toast.success(`Unidade ${isNew ? 'criada' : 'atualizada'} com sucesso!`);
        setEditingLocation(null);
        queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error: any) => toast.error(error.message || "Ocorreu um erro ao salvar."),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (locationId: string) => locationsAPI.delete(locationId),
    onSuccess: () => {
        toast.success("Unidade excluída com sucesso!");
        setEditingLocation(null);
        queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error: any) => toast.error(error.message || `Falha ao excluir.`),
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans">
      
      <LocationEditModal
        location={editingLocation}
        onClose={() => setEditingLocation(null)}
        onSave={saveLocationMutation.mutate}
        onDelete={deleteLocationMutation.mutate}
        isSaving={saveLocationMutation.isPending}
        isDeleting={deleteLocationMutation.isPending}
      />

      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <MapPin className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Unidades
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">
            Gerencie os endereços físicos do seu negócio.
          </p>
        </div>
        <Button onClick={() => setEditingLocation({})} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white shadow-md font-medium px-6 w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Nova Unidade
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
           <div className="w-8 h-8 border-4 border-[#C6A87C]/30 border-t-[#C6A87C] rounded-full animate-spin"></div>
           <p className="text-stone-400 text-sm">Carregando unidades...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-stone-900 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800">
           <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-stone-300" />
           </div>
           <h3 className="text-lg font-semibold text-stone-600 dark:text-stone-300">Nenhuma unidade cadastrada</h3>
           <p className="text-stone-400 text-sm mt-1 max-w-md mx-auto">Cadastre sua primeira unidade para começar a gerenciar escalas e atendimentos.</p>
           {/* ✅ CORREÇÃO AQUI: variant="ghost" em vez de "link" */}
           <Button variant="ghost" onClick={() => setEditingLocation({})} className="text-[#C6A87C] mt-2 hover:bg-stone-50">
              Cadastrar agora
           </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              {...location}
              onClick={() => setEditingLocation(location)}
            />
          ))}
        </div>
      )}
    </div>
  );
}