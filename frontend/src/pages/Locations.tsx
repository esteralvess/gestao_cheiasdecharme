import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { locationsAPI } from "@/services/api";
import { toast } from "sonner";

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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isNew ? 'Nova Unidade' : `Editar Unidade: ${location.name}`}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome da Unidade</Label>
                        <Input id="name" value={formData.name} onChange={(e) => setFormData(f => ({...f, name: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="slug">Slug (URL)</Label>
                        <Input id="slug" value={formData.slug} onChange={(e) => setFormData(f => ({...f, slug: slugify(e.target.value)}))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Endereço</Label>
                        <Input id="address" value={formData.address} onChange={(e) => setFormData(f => ({...f, address: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="reference_point">Ponto de Referência</Label>
                        <Input id="reference_point" value={formData.reference_point} onChange={(e) => setFormData(f => ({...f, reference_point: e.target.value}))} />
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
// COMPONENTE: CARD DA UNIDADE
// ===============================================
interface LocationCardProps extends Location {
    onClick: () => void;
}

function LocationCard({ name, address, onClick }: LocationCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{name}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                    <span>{address || 'Endereço não informado'}</span>
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="outline" size="sm" onClick={onClick}>
                    <Pencil className="w-3 h-3 mr-2" />
                    Editar
                </Button>
            </CardFooter>
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
    <div className="p-6 space-y-6">
      <LocationEditModal
        location={editingLocation}
        onClose={() => setEditingLocation(null)}
        onSave={saveLocationMutation.mutate}
        onDelete={deleteLocationMutation.mutate}
        isSaving={saveLocationMutation.isPending}
        isDeleting={deleteLocationMutation.isPending}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Unidades</h1>
          <p className="text-muted-foreground">Gerencie as unidades do seu negócio</p>
        </div>
        <Button data-testid="button-add-location" onClick={() => setEditingLocation({})}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Unidade
        </Button>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground">Carregando unidades...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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