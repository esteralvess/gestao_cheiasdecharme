import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Package, Pencil, Trash2, Percent, X, Calculator, AlertCircle, Loader2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { promotionsAPI, servicesAPI } from "@/services/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge"; // 💡 Usando o componente oficial

// Tipagem
interface Service { id: string; name: string; price_centavos: number; }
interface PromotionItem { service_id: string; quantity: number; }
interface Promotion {
  id: string; title: string; description?: string; type: 'combo' | 'package';
  price_centavos: number; discount_percentage?: number; active: boolean; image_url?: string;
  items: PromotionItem[];
  // Novos campos de regras
  days_to_expire?: number;
  min_interval_days?: number;
  suggested_interval_days?: number;
}

export default function Promotions() {
  const queryClient = useQueryClient();
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
  const [deletingPromoId, setDeletingPromoId] = useState<string | null>(null);
  
  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({ queryKey: ['promotions'], queryFn: promotionsAPI.getAll });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });

  const saveMutation = useMutation({
    mutationFn: (data: any) => data.id ? promotionsAPI.update(data.id, data) : promotionsAPI.create(data),
    onSuccess: () => { 
        toast.success("Salvo com sucesso!"); 
        setEditingPromo(null); 
        queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: () => toast.error("Erro ao salvar.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotionsAPI.delete(id),
    onSuccess: () => { 
        toast.success("Removido!"); 
        setDeletingPromoId(null); 
        queryClient.invalidateQueries({ queryKey: ['promotions'] }); 
    },
    onError: () => toast.error("Erro ao excluir.")
  });

  const handleEdit = (promo: Promotion) => {
      const itemsMapped = promo.items?.map((item: any) => ({
          id: item.id, quantity: item.quantity, service_id: item.service_id || item.service || '' 
      })) || [];
      setEditingPromo({ ...promo, items: itemsMapped });
  };

  const itemsSubtotal = useMemo(() => {
    if (!editingPromo?.items) return 0;
    return editingPromo.items.reduce((acc, item) => {
        const srv = services.find(s => s.id === item.service_id);
        return acc + ((srv?.price_centavos || 0) * (item.quantity || 1));
    }, 0);
  }, [editingPromo?.items, services]);

  useEffect(() => {
    if (editingPromo) {
        const discount = editingPromo.discount_percentage || 0;
        const finalPrice = itemsSubtotal - (itemsSubtotal * (discount / 100));
        if (itemsSubtotal > 0 && Math.round(finalPrice) !== editingPromo.price_centavos) {
            setEditingPromo(prev => prev ? ({ ...prev, price_centavos: Math.round(finalPrice) }) : null);
        }
    }
  }, [itemsSubtotal, editingPromo?.discount_percentage]);

  const handleAddItem = () => {
      setEditingPromo(prev => prev ? { ...prev, items: [...(prev.items || []), { service_id: '', quantity: 1 }] } : null);
  };

  const handleUpdateItem = (index: number, field: keyof PromotionItem, value: any) => {
     setEditingPromo(prev => {
        if (!prev?.items) return prev;
        const newItems = [...prev.items];
        newItems[index] = { ...newItems[index], [field]: value };
        return { ...prev, items: newItems };
     });
  };

  const handleRemoveItem = (index: number) => {
     setEditingPromo(prev => {
        if (!prev?.items) return prev;
        const newItems = prev.items.filter((_, i) => i !== index);
        return { ...prev, items: newItems };
     });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPromo) saveMutation.mutate(editingPromo);
  };

  const confirmDelete = () => {
      if (deletingPromoId) deleteMutation.mutate(deletingPromoId);
  };

  const grouped = useMemo(() => ({
    combo: promotions.filter(p => p.type === 'combo'),
    package: promotions.filter(p => p.type === 'package')
  }), [promotions]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight text-foreground">Catálogo de Ofertas</h1><p className="text-muted-foreground mt-1">Gerencie seus combos e pacotes promocionais.</p></div>
        <Button size="lg" onClick={() => setEditingPromo({ type: 'combo', active: true, price_centavos: 0, items: [], discount_percentage: 0 })} className="shadow-md"><Plus className="mr-2 h-5 w-5"/> Criar Nova Oferta</Button>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div> : (
        <Tabs defaultValue="combo" className="w-full">
            <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-8"><TabsTrigger value="combo">Combos</TabsTrigger><TabsTrigger value="package">Pacotes</TabsTrigger></TabsList>
            <TabsContent value="combo" className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{grouped.combo.length > 0 ? grouped.combo.map(p => <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} onDelete={() => setDeletingPromoId(p.id)} />) : <EmptyState type="Combos" />}</div></TabsContent>
            <TabsContent value="package" className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{grouped.package.length > 0 ? grouped.package.map(p => <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} onDelete={() => setDeletingPromoId(p.id)} />) : <EmptyState type="Pacotes" />}</div></TabsContent>
        </Tabs>
      )}

      {/* MODAL EDIÇÃO */}
      <Dialog open={!!editingPromo} onOpenChange={() => !saveMutation.isPending && setEditingPromo(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromo?.id ? 'Editar Oferta' : 'Nova Oferta'}</DialogTitle>
            <DialogDescription>Configure os detalhes e itens inclusos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-6 pt-4">
            
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Tipo de Oferta</Label><Select value={editingPromo?.type || 'combo'} onValueChange={(v: any) => setEditingPromo(p => p ? ({...p, type: v}) : null)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="combo">Combo (Dia único)</SelectItem><SelectItem value="package">Pacote (Recorrente)</SelectItem></SelectContent></Select></div>
                <div className="space-y-2 flex flex-col justify-end"><div className="flex items-center space-x-2 border p-2.5 rounded-md"><Switch checked={editingPromo?.active ?? true} onCheckedChange={c => setEditingPromo(p => p ? ({...p, active: c}) : null)}/><Label>Ativo no Site</Label></div></div>
            </div>

            <div className="space-y-3"><div className="space-y-1"><Label>Título</Label><Input value={editingPromo?.title || ''} onChange={e => setEditingPromo(p => p ? ({...p, title: e.target.value}) : null)} required placeholder="Ex: Combo Pé e Mão"/></div><div className="space-y-1"><Label>Descrição</Label><Textarea className="resize-none" rows={2} value={editingPromo?.description || ''} onChange={e => setEditingPromo(p => p ? ({...p, description: e.target.value}) : null)} placeholder="Ex: Inclui esmaltação simples..."/></div></div>
            
            <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <div className="flex justify-between items-center mb-2"><Label className="font-semibold">Itens Inclusos</Label><Button type="button" size="sm" variant="secondary" onClick={handleAddItem} className="h-8"><Plus className="h-3 w-3 mr-1"/> Adicionar Item</Button></div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {editingPromo?.items?.map((item, idx) => {
                        const srv = services.find(s => s.id === item.service_id);
                        const unitPrice = srv ? srv.price_centavos / 100 : 0;
                        return (
                            <div key={idx} className="flex gap-2 items-center">
                                <div className="flex-1"><Select value={item.service_id || ''} onValueChange={v => handleUpdateItem(idx, 'service_id', v)}><SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Selecione..."/></SelectTrigger><SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R$ {(s.price_centavos/100).toFixed(2)})</SelectItem>)}</SelectContent></Select></div>
                                <div className="w-20"><Input type="number" className="h-9 bg-background text-center" value={item.quantity || 1} onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value))} min={1} placeholder="Qtd"/></div>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(idx)}><X className="h-4 w-4"/></Button>
                            </div>
                        );
                    })}
                    {(!editingPromo?.items || editingPromo.items.length === 0) && <p className="text-sm text-muted-foreground text-center py-4 italic">Nenhum serviço adicionado.</p>}
                </div>
                <div className="flex justify-between items-center pt-2 border-t"><span className="text-sm text-muted-foreground">Soma dos itens (Sem desconto):</span><span className="font-semibold">R$ {(itemsSubtotal / 100).toFixed(2)}</span></div>
            </div>

            {/* 💡 SESSÃO DE REGRAS DE PACOTE (APARECE SÓ SE FOR PACOTE) */}
            {editingPromo?.type === 'package' && (
                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-4">
                    <div className="flex items-center gap-2 text-blue-800 font-medium pb-2 border-b border-blue-100 mb-2">
                        <CalendarClock className="w-5 h-5" /> Regras de Agendamento (Pacote)
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs">Validade (Dias)</Label>
                            <Input type="number" className="bg-white" value={editingPromo?.days_to_expire ?? 30} onChange={e => setEditingPromo(p => p ? ({...p, days_to_expire: parseInt(e.target.value)}) : null)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Intervalo Mín. (Dias)</Label>
                            <Input type="number" className="bg-white" value={editingPromo?.min_interval_days ?? 0} onChange={e => setEditingPromo(p => p ? ({...p, min_interval_days: parseInt(e.target.value)}) : null)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Intervalo Sugerido</Label>
                            <Input type="number" className="bg-white" value={editingPromo?.suggested_interval_days ?? 15} onChange={e => setEditingPromo(p => p ? ({...p, suggested_interval_days: parseInt(e.target.value)}) : null)} />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 bg-primary/5 p-4 rounded-lg border border-primary/10">
                <div className="space-y-1"><Label>Desconto</Label><div className="relative"><Input type="number" className="pr-8 bg-background" value={editingPromo?.discount_percentage || 0} onChange={e => setEditingPromo(p => p ? ({...p, discount_percentage: parseInt(e.target.value) || 0}) : null)}/><Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground"/></div></div>
                <div className="space-y-1"><Label>Valor Final</Label><div className="relative"><span className="absolute left-3 top-2.5 font-semibold text-primary">R$</span><Input type="number" step="0.01" className="pl-9 font-bold text-lg bg-background" value={editingPromo?.price_centavos !== undefined ? (editingPromo.price_centavos / 100) : ''} onChange={e => setEditingPromo(p => p ? ({...p, price_centavos: Math.round(parseFloat(e.target.value)*100)}) : null)} required/></div></div>
            </div>

            <div className="space-y-1"><Label>Imagem (Assets)</Label><Input className="bg-muted/30" placeholder="ex: MaoGel (Opcional)" value={editingPromo?.image_url || ''} onChange={e => setEditingPromo(p => p ? ({...p, image_url: e.target.value}) : null)}/></div>
            
            <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditingPromo(null)} disabled={saveMutation.isPending}>Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="min-w-[120px]">
                    {saveMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Salvando...</> : "Salvar"}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingPromoId} onOpenChange={() => !deleteMutation.isPending && setDeletingPromoId(null)}>
          <DialogContent>
              <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle><DialogDescription>Tem certeza que deseja excluir esta oferta?</DialogDescription></DialogHeader>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setDeletingPromoId(null)} disabled={deleteMutation.isPending}>Cancelar</Button>
                  <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Excluindo...</> : "Excluir"}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

function PromoCard({ p, onEdit, onDelete }: any) {
  const hasItems = p.items && p.items.length > 0;
  return (
    <Card className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg border bg-card ${!hasItems ? 'border-dashed border-amber-300 bg-amber-50/30' : 'hover:border-primary/50'}`}>
        {!hasItems && <div className="absolute top-0 left-0 right-0 bg-amber-100 text-amber-700 text-[10px] font-bold text-center py-1 uppercase tracking-wider">Configuração Pendente</div>}
        <CardContent className="p-5 flex flex-col h-full pt-8">
            <div className="mb-2">
                <h3 className="font-semibold text-lg leading-tight">{p.title}</h3>
                <div className="flex items-center gap-2 mt-1.5"><Badge variant={p.type === 'combo' ? 'default' : 'secondary'} className="text-[10px] uppercase">{p.type === 'combo' ? 'Combo' : 'Pacote'}</Badge>{p.discount_percentage > 0 && hasItems && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px] font-bold">-{p.discount_percentage}%</Badge>}</div>
            </div>
            <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[2.5rem]">{p.description}</p>
            
            {/* 💡 Exibe a Validade no Card se for Pacote */}
            {p.days_to_expire && p.type === 'package' && <div className="mb-4 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit flex items-center gap-1"><CalendarClock className="w-3 h-3"/> Validade: {p.days_to_expire} dias</div>}

            <div className="mt-auto pt-4 border-t flex items-end justify-between">
                <div><p className="text-[10px] text-muted-foreground uppercase font-medium">Valor Final</p>{hasItems ? <p className="text-2xl font-bold text-primary">R$ {(p.price_centavos/100).toFixed(2).replace('.',',')}</p> : <p className="text-lg font-medium text-amber-600 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> --,--</p>}</div>
                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8 hover:text-primary"><Pencil className="w-4 h-4"/></Button><Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4"/></Button></div>
            </div>
        </CardContent>
    </Card>
  )
}
function EmptyState({ type }: { type: string }) { return <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/10 text-muted-foreground"><div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-4">{type === 'Combos' ? <Tag className="w-6 h-6 opacity-50"/> : <Package className="w-6 h-6 opacity-50"/>}</div><p className="font-medium">Nenhum {type.toLowerCase()} encontrado</p><p className="text-sm">Clique em "Criar Nova Oferta" para começar.</p></div> }