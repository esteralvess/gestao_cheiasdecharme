import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Package, Pencil, Trash2, Percent, X, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { promotionsAPI, servicesAPI } from "@/services/api";
import { toast } from "sonner";

// Tipagem
interface Service { id: string; name: string; price_centavos: number; }
interface PromotionItem { service_id: string; quantity: number; service?: string; }
interface Promotion {
  id: string; title: string; description?: string; type: 'combo' | 'package';
  price_centavos: number; discount_percentage?: number; active: boolean; image_url?: string;
  items: PromotionItem[];
}

export default function Promotions() {
  const queryClient = useQueryClient();
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
  
  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({ queryKey: ['promotions'], queryFn: promotionsAPI.getAll });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });

  const saveMutation = useMutation({
    mutationFn: (data: any) => data.id ? promotionsAPI.update(data.id, data) : promotionsAPI.create(data),
    onSuccess: () => { toast.success("Salvo!"); setEditingPromo(null); queryClient.invalidateQueries({ queryKey: ['promotions'] }); },
    onError: () => toast.error("Erro ao salvar.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotionsAPI.delete(id),
    onSuccess: () => { toast.success("Excluído!"); queryClient.invalidateQueries({ queryKey: ['promotions'] }); }
  });

  // 💡 CORREÇÃO: Prepara os dados para edição, mapeando 'service' para 'service_id'
  const handleEdit = (promo: Promotion) => {
      const itemsMapped = promo.items?.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          // O backend manda 'service' (o ID), mas o form usa 'service_id'.
          // Aqui fazemos o fallback para garantir que o valor exista.
          service_id: item.service_id || item.service || '' 
      })) || [];

      setEditingPromo({ ...promo, items: itemsMapped });
  };

  // Cálculo Automático
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
        
        // Só atualiza se o valor mudar e se houver itens (para não zerar preços manuais de pacotes vazios)
        if (itemsSubtotal > 0 && Math.round(finalPrice) !== editingPromo.price_centavos) {
            setEditingPromo(prev => prev ? ({ ...prev, price_centavos: Math.round(finalPrice) }) : null);
        }
    }
  }, [itemsSubtotal, editingPromo?.discount_percentage]);

  // Handlers Seguros
  const handleAddItem = () => {
      setEditingPromo(prev => {
          if (!prev) return null;
          return { ...prev, items: [...(prev.items || []), { service_id: '', quantity: 1 }] };
      });
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

  const grouped = { combo: promotions.filter(p => p.type === 'combo'), package: promotions.filter(p => p.type === 'package') };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <div><h1 className="text-3xl font-semibold">Gestão de Promoções</h1><p className="text-muted-foreground">Crie combos e pacotes inteligentes.</p></div>
        <Button onClick={() => setEditingPromo({ type: 'combo', active: true, price_centavos: 0, items: [], discount_percentage: 0 })}><Plus className="mr-2 h-4 w-4"/> Nova Promoção</Button>
      </div>

      {isLoading ? <p>Carregando...</p> : (
        <div className="grid md:grid-cols-2 gap-8">
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Tag className="w-5 h-5 text-primary"/> Combos</h2>
            {/* 💡 Usa handleEdit no clique */}
            <div className="space-y-4">{grouped.combo.map(p => <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} onDelete={() => deleteMutation.mutate(p.id)} />)}</div>
          </section>
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-primary"/> Pacotes (Mensais)</h2>
            <div className="space-y-4">{grouped.package.map(p => <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} onDelete={() => deleteMutation.mutate(p.id)} />)}</div>
          </section>
        </div>
      )}

      <Dialog open={!!editingPromo} onOpenChange={() => setEditingPromo(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromo?.id ? 'Editar' : 'Criar'} Promoção</DialogTitle>
            <DialogDescription>Configure os itens e o valor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5">
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select 
                        value={editingPromo?.type || 'combo'} 
                        onValueChange={(v: any) => setEditingPromo(p => p ? ({...p, type: v}) : null)}
                    >
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent><SelectItem value="combo">Combo (Dia único)</SelectItem><SelectItem value="package">Pacote (Recorrente)</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Ativo</Label>
                    <div className="flex items-center h-10">
                        <Switch 
                            checked={editingPromo?.active ?? true} 
                            onCheckedChange={c => setEditingPromo(p => p ? ({...p, active: c}) : null)}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Título</Label>
                <Input 
                    value={editingPromo?.title || ''} 
                    onChange={e => setEditingPromo(p => p ? ({...p, title: e.target.value}) : null)} 
                    required
                />
            </div>
            <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea 
                    value={editingPromo?.description || ''} 
                    onChange={e => setEditingPromo(p => p ? ({...p, description: e.target.value}) : null)}
                />
            </div>
            
            <div className="border p-4 rounded-md bg-muted/10 space-y-4">
                <div className="flex justify-between items-center"><Label className="text-base font-semibold">Composição do Pacote</Label><Button type="button" size="sm" variant="secondary" onClick={handleAddItem}><Plus className="h-3 w-3 mr-1"/> Adicionar Item</Button></div>
                <div className="space-y-2">
                    {editingPromo?.items?.map((item, idx) => {
                        const srv = services.find(s => s.id === item.service_id);
                        const unitPrice = srv ? srv.price_centavos / 100 : 0;
                        const totalItem = unitPrice * (item.quantity || 1);
                        return (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-background p-2 rounded border">
                                <div className="col-span-6">
                                    <Label className="text-xs text-muted-foreground">Serviço</Label>
                                    <Select value={item.service_id || ''} onValueChange={v => handleUpdateItem(idx, 'service_id', v)}>
                                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione..."/></SelectTrigger>
                                        <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Qtd</Label><Input type="number" className="h-8" value={item.quantity || 1} onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value))} min={1}/></div>
                                <div className="col-span-3 text-right text-xs"><div className="text-muted-foreground">Un: R$ {unitPrice.toFixed(2)}</div><div className="font-bold">Total: R$ {totalItem.toFixed(2)}</div></div>
                                <div className="col-span-1 text-right"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveItem(idx)}><X className="h-4 w-4"/></Button></div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between items-center pt-2 border-t"><span className="text-sm text-muted-foreground">Soma dos itens (Sem desconto):</span><span className="font-semibold">R$ {(itemsSubtotal / 100).toFixed(2)}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Percent className="w-4 h-4"/> Desconto a aplicar</Label>
                    <div className="relative">
                        <Input type="number" className="pr-8 font-bold text-lg" value={editingPromo?.discount_percentage || 0} onChange={e => setEditingPromo(p => p ? ({...p, discount_percentage: parseInt(e.target.value) || 0}) : null)}/>
                        <span className="absolute right-3 top-2 text-muted-foreground">%</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Calculator className="w-4 h-4"/> Preço Final (Automático)</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-muted-foreground font-bold">R$</span>
                        <Input 
                            type="number" step="0.01" className="pl-10 font-bold text-lg bg-background"
                            value={editingPromo?.price_centavos !== undefined ? (editingPromo.price_centavos / 100) : ''} 
                            onChange={e => setEditingPromo(p => p ? ({...p, price_centavos: Math.round(parseFloat(e.target.value)*100)}) : null)} 
                            required
                        />
                    </div>
                </div>
            </div>
             <div className="space-y-2"><Label>Nome da Imagem (Assets)</Label><Input placeholder="ex: MaoGel" value={editingPromo?.image_url || ''} onChange={e => setEditingPromo(p => p ? ({...p, image_url: e.target.value}) : null)}/></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEditingPromo(null)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>Salvar Promoção</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromoCard({ p, onEdit, onDelete }: any) {
  return (
    <Card className="hover:shadow-md transition-all flex flex-col group">
        <CardHeader className="pb-2 flex flex-row justify-between items-start">
            <div><CardTitle className="text-lg">{p.title}</CardTitle><p className="text-sm text-muted-foreground mt-1">{p.items?.length || 0} itens inclusos</p></div>
            {p.discount_percentage > 0 && <Badge className="bg-green-100 text-green-800 hover:bg-green-200">{p.discount_percentage}% OFF</Badge>}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-end">
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{p.description}</p>
            <div className="flex justify-between items-end">
                <span className="text-xl font-bold text-primary">R$ {(p.price_centavos/100).toFixed(2).replace('.',',')}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="w-4 h-4"/></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 className="w-4 h-4"/></Button></div>
            </div>
        </CardContent>
    </Card>
  )
}

function Badge({children, className}: {children: React.ReactNode, className?: string}) {
    return <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit ${className}`}>{children}</span>
}