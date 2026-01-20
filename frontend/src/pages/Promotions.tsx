import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Tag, 
  Package, 
  Pencil, 
  Trash2, 
  Percent, 
  X, 
  AlertCircle, 
  Loader2, 
  CalendarClock,
  Sparkles,
  ShoppingBag,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  Link,
  Unlink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { promotionsAPI, servicesAPI } from "@/services/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Service { id: string; name: string; price_centavos: number; }
interface PromotionItem { 
    id?: string;
    service_id: string; 
    quantity: number; 
    custom_interval?: number;
    linked_to_previous?: boolean; // Campo virtual para a UI
}

interface Promotion {
  id: string; title: string; description?: string; type: 'combo' | 'package';
  price_centavos: number; discount_percentage?: number; active: boolean;
  items: PromotionItem[];
  days_to_expire?: number;
}

export default function Promotions() {
  const queryClient = useQueryClient();
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
  const [deletingPromoId, setDeletingPromoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("package");
  
  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({ queryKey: ['promotions'], queryFn: promotionsAPI.getAll });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
        const payload = {
            ...data,
            items: data.items.map((item: any) => ({
                service_id: item.service_id,
                quantity: Number(item.quantity),
                custom_interval: Number(item.custom_interval || 0)
            }))
        };
        return data.id ? promotionsAPI.update(data.id, payload) : promotionsAPI.create(payload);
    },
    onSuccess: () => { 
        toast.success("Salvo com sucesso!"); 
        setEditingPromo(null); 
        queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: () => toast.error("Erro ao salvar oferta.")
  });

  const handleEdit = (promo: Promotion) => {
      const itemsMapped = promo.items?.map((item: any, idx: number, arr: any[]) => {
          // Lógica visual: se o intervalo for igual ao anterior e > 0, consideramos vinculado
          const isLinked = idx > 0 && item.custom_interval > 0 && item.custom_interval === arr[idx-1].custom_interval;
          return {
              id: item.id, 
              quantity: item.quantity, 
              service_id: item.service_id || item.service || '',
              custom_interval: item.custom_interval || 0,
              linked_to_previous: isLinked
          };
      }) || [];
      setEditingPromo({ ...promo, items: itemsMapped });
  };

  const itemsSubtotal = useMemo(() => {
    if (!editingPromo?.items) return 0;
    return editingPromo.items.reduce((acc, item) => {
        const srv = services.find(s => s.id === item.service_id);
        return acc + ((srv?.price_centavos || 0) * (item.quantity || 1));
    }, 0);
  }, [editingPromo?.items, services]);

  const handleAddItem = () => {
      setEditingPromo(prev => prev ? { 
          ...prev, 
          items: [...(prev.items || []), { service_id: '', quantity: 1, custom_interval: 0, linked_to_previous: false }] 
      } : null);
  };

  const handleUpdateItem = (index: number, field: keyof PromotionItem, value: any) => {
     setEditingPromo(prev => {
        if (!prev?.items) return prev;
        const newItems = [...prev.items];
        newItems[index] = { ...newItems[index], [field]: value };
        return { ...prev, items: newItems };
     });
  };

  const grouped = useMemo(() => ({
    combo: promotions.filter(p => p.type === 'combo'),
    package: promotions.filter(p => p.type === 'package')
  }), [promotions]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-stone-50/50 dark:bg-stone-950 min-h-screen">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-[#C6A87C]" /> Ofertas e Pacotes
        </h1>
        <Button onClick={() => setEditingPromo({ type: activeTab as any, active: true, price_centavos: 0, items: [], discount_percentage: 0 })} className="bg-[#C6A87C] text-white">
          <Plus className="w-4 h-4 mr-2" /> Nova Oferta
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white dark:bg-stone-900 border p-1 rounded-xl grid grid-cols-2 w-full md:w-64">
            <TabsTrigger value="package">Pacotes</TabsTrigger>
            <TabsTrigger value="combo">Combos</TabsTrigger>
        </TabsList>

        <TabsContent value="package" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
            {grouped.package.map(p => <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} />)}
        </TabsContent>
        
        <TabsContent value="combo" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
            {grouped.combo.map(p => <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} />)}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingPromo} onOpenChange={() => setEditingPromo(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromo?.id ? 'Editar' : 'Nova'} Oferta</DialogTitle>
            <DialogDescription>Configure os serviços e as regras de repetição.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(editingPromo); }} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Título</Label>
                    <Input value={editingPromo?.title || ''} onChange={e => setEditingPromo({...editingPromo, title: e.target.value})} required />
                </div>
                <div className="flex items-center justify-between border p-2 rounded-lg mt-6">
                    <Label>Ativo no Site</Label>
                    <Switch checked={editingPromo?.active} onCheckedChange={c => setEditingPromo({...editingPromo, active: c})}/>
                </div>
            </div>

            <div className="bg-stone-50 p-4 rounded-xl space-y-4 border">
                <div className="flex justify-between items-center">
                    <Label className="font-bold">Serviços Inclusos</Label>
                    <Button type="button" size="sm" variant="outline" onClick={handleAddItem}><Plus className="w-3 h-3 mr-1"/> Adicionar</Button>
                </div>
                
                <div className="space-y-4">
                    {editingPromo?.items?.map((item, idx) => (
                        <div key={idx} className={`p-4 rounded-lg border bg-white ${item.linked_to_previous ? 'border-l-4 border-l-purple-400 ml-6' : 'border-stone-200'}`}>
                            <div className="flex gap-3 items-center">
                                <div className="flex-1">
                                    <Select value={item.service_id} onValueChange={v => handleUpdateItem(idx, 'service_id', v)}>
                                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o serviço..."/></SelectTrigger>
                                        <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <Input type="number" className="w-16 h-9 text-center" value={item.quantity} onChange={e => handleUpdateItem(idx, 'quantity', e.target.value)} />
                                <Button type="button" variant="ghost" size="icon" onClick={() => setEditingPromo({...editingPromo, items: editingPromo?.items?.filter((_, i) => i !== idx)})}><X className="w-4 h-4 text-red-400"/></Button>
                            </div>

                            {editingPromo.type === 'package' && (
                                <div className="mt-3 pt-3 border-t border-stone-100 space-y-3">
                                    {idx > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Checkbox 
                                                id={`link-${idx}`} 
                                                checked={item.linked_to_previous} 
                                                onCheckedChange={(c) => {
                                                    handleUpdateItem(idx, 'linked_to_previous', c);
                                                    if (c) handleUpdateItem(idx, 'custom_interval', editingPromo.items![idx-1].custom_interval);
                                                }}
                                            />
                                            <Label htmlFor={`link-${idx}`} className="text-[10px] font-bold text-purple-600 flex items-center gap-1 cursor-pointer uppercase">
                                                <Link className="w-3 h-3"/> Realizar na mesma sessão do item anterior
                                            </Label>
                                        </div>
                                    )}

                                    {!item.linked_to_previous && (
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500">
                                            <Clock className="w-3 h-3" /> REPETIR A CADA:
                                            <div className="flex gap-1">
                                                {[7, 14, 21, 30].map(d => (
                                                    <Badge 
                                                        key={d} 
                                                        variant="outline" 
                                                        onClick={() => handleUpdateItem(idx, 'custom_interval', d)}
                                                        className={`cursor-pointer ${item.custom_interval === d ? 'bg-[#C6A87C] text-white' : ''}`}
                                                    >
                                                        {d} dias
                                                    </Badge>
                                                ))}
                                                <Input 
                                                    type="number" 
                                                    className="h-5 w-10 p-0 text-center text-[10px]" 
                                                    placeholder="Outro" 
                                                    value={item.custom_interval || ''} 
                                                    onChange={e => handleUpdateItem(idx, 'custom_interval', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-stone-900 text-white p-4 rounded-xl">
                <div><Label className="text-[10px]">DESCONTO %</Label><Input type="number" className="bg-white text-black h-8" value={editingPromo?.discount_percentage || 0} onChange={e => {
                    const d = Number(e.target.value);
                    const p = itemsSubtotal - (itemsSubtotal * (d/100));
                    setEditingPromo({...editingPromo, discount_percentage: d, price_centavos: Math.round(p)});
                }}/></div>
                <div><Label className="text-[10px]">PREÇO FINAL (R$)</Label><Input type="number" step="0.01" className="bg-white text-black h-8 font-bold" value={editingPromo?.price_centavos ? editingPromo.price_centavos / 100 : ''} onChange={e => setEditingPromo({...editingPromo, price_centavos: Math.round(Number(e.target.value)*100)})}/></div>
            </div>

            <DialogFooter>
                <Button type="submit" className="w-full bg-[#C6A87C] text-white h-12 font-bold" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Salvando..." : "Salvar Oferta"}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromoCard({ p, onEdit }: any) {
  return (
    <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-5 flex flex-col h-full">
            <div className="flex justify-between mb-2">
                <Badge className={p.type === 'combo' ? 'bg-stone-800' : 'bg-blue-600'}>{p.type === 'combo' ? 'Combo' : 'Pacote'}</Badge>
                <span className="font-bold text-[#C6A87C]">R$ {(p.price_centavos/100).toFixed(2)}</span>
            </div>
            <h3 className="font-bold text-lg mb-4">{p.title}</h3>
            <div className="flex justify-end mt-auto">
                <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="w-4 h-4 text-stone-400"/></Button>
            </div>
        </CardContent>
    </Card>
  );
}