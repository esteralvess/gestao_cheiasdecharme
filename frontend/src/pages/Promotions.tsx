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
  CheckCircle2
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
import { promotionsAPI, servicesAPI } from "@/services/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Tipagem
interface Service { id: string; name: string; price_centavos: number; }
interface PromotionItem { service_id: string; quantity: number; }
interface Promotion {
  id: string; title: string; description?: string; type: 'combo' | 'package';
  price_centavos: number; discount_percentage?: number; active: boolean; image_url?: string;
  items: PromotionItem[];
  days_to_expire?: number;
  min_interval_days?: number;
  suggested_interval_days?: number;
}

export default function Promotions() {
  const queryClient = useQueryClient();
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
  const [deletingPromoId, setDeletingPromoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("combo");
  
  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({ queryKey: ['promotions'], queryFn: promotionsAPI.getAll });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });

  const saveMutation = useMutation({
    mutationFn: (data: any) => data.id ? promotionsAPI.update(data.id, data) : promotionsAPI.create(data),
    onSuccess: () => { 
        toast.success("Oferta salva com sucesso!"); 
        setEditingPromo(null); 
        queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: () => toast.error("Erro ao salvar oferta.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotionsAPI.delete(id),
    onSuccess: () => { 
        toast.success("Oferta removida!"); 
        setDeletingPromoId(null); 
        queryClient.invalidateQueries({ queryKey: ['promotions'] }); 
    },
    onError: () => toast.error("Erro ao excluir oferta.")
  });

  const handleEdit = (promo: Promotion) => {
      // Garante que o objeto items tenha o formato correto ao abrir edição
      const itemsMapped = promo.items?.map((item: any) => ({
          id: item.id, 
          quantity: item.quantity, 
          // Correção aqui também para garantir leitura de dados antigos
          service_id: item.service_id || item.service || '' 
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <ShoppingBag className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Ofertas e Pacotes
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">
            Crie combos promocionais e pacotes de serviços.
          </p>
        </div>
        <Button onClick={() => setEditingPromo({ type: 'combo', active: true, price_centavos: 0, items: [], discount_percentage: 0 })} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white shadow-md font-medium px-6 w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Criar Oferta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
           <div className="w-8 h-8 border-4 border-[#C6A87C]/30 border-t-[#C6A87C] rounded-full animate-spin"></div>
           <p className="text-stone-400 text-sm">Carregando ofertas...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            
            {/* Menu de Abas Clean */}
            <TabsList className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-1 rounded-xl h-auto w-full md:w-auto grid grid-cols-2 md:flex">
                <TabsTrigger value="combo" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">
                   <Sparkles className="w-4 h-4 mr-2" /> Combos
                </TabsTrigger>
                <TabsTrigger value="package" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">
                   <Package className="w-4 h-4 mr-2" /> Pacotes
                </TabsTrigger>
            </TabsList>

            <TabsContent value="combo" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {grouped.combo.length > 0 ? grouped.combo.map(p => (
                        <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} onDelete={() => setDeletingPromoId(p.id)} />
                    )) : <EmptyState type="Combos" />}
                </div>
            </TabsContent>
            
            <TabsContent value="package" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {grouped.package.length > 0 ? grouped.package.map(p => (
                        <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} onDelete={() => setDeletingPromoId(p.id)} />
                    )) : <EmptyState type="Pacotes" />}
                </div>
            </TabsContent>
        </Tabs>
      )}

      {/* MODAL EDIÇÃO */}
      <Dialog open={!!editingPromo} onOpenChange={() => !saveMutation.isPending && setEditingPromo(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
          <DialogHeader className="border-b border-stone-100 dark:border-stone-800 pb-4">
            <DialogTitle className="text-lg font-bold text-stone-800 dark:text-stone-100">
                {editingPromo?.id ? 'Editar Oferta' : 'Nova Oferta'}
            </DialogTitle>
            <DialogDescription className="text-stone-400">Configure os serviços, preço e regras.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSave} className="space-y-6 py-4">
            
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-stone-600 text-xs uppercase tracking-wider font-semibold">Tipo de Oferta</Label>
                    <Select value={editingPromo?.type || 'combo'} onValueChange={(v: any) => setEditingPromo(p => p ? ({...p, type: v}) : null)}>
                        <SelectTrigger className="bg-stone-50 border-stone-200"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="combo">Combo (Dia único)</SelectItem>
                            <SelectItem value="package">Pacote (Recorrente)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                    <div className="flex items-center justify-between space-x-2 border border-stone-200 bg-stone-50 p-2.5 rounded-lg">
                        <Label className="cursor-pointer">Ativo no Site</Label>
                        <Switch checked={editingPromo?.active ?? true} onCheckedChange={c => setEditingPromo(p => p ? ({...p, active: c}) : null)} className="data-[state=checked]:bg-emerald-500"/>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="space-y-1">
                    <Label className="text-stone-600 text-xs uppercase tracking-wider font-semibold">Título</Label>
                    <Input value={editingPromo?.title || ''} onChange={e => setEditingPromo(p => p ? ({...p, title: e.target.value}) : null)} required placeholder="Ex: Combo Pé e Mão" className="bg-stone-50 border-stone-200" />
                </div>
                <div className="space-y-1">
                    <Label className="text-stone-600 text-xs uppercase tracking-wider font-semibold">Descrição</Label>
                    <Textarea className="resize-none bg-stone-50 border-stone-200" rows={2} value={editingPromo?.description || ''} onChange={e => setEditingPromo(p => p ? ({...p, description: e.target.value}) : null)} placeholder="Ex: Inclui esmaltação simples..."/>
                </div>
            </div>
            
            <div className="bg-stone-50/50 p-4 rounded-xl border border-stone-100 space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <Label className="font-bold text-stone-700">Itens Inclusos</Label>
                    <Button type="button" size="sm" variant="outline" onClick={handleAddItem} className="h-8 border-stone-200 text-[#C6A87C] hover:bg-[#C6A87C]/10">
                        <Plus className="h-3 w-3 mr-1"/> Adicionar
                    </Button>
                </div>
                
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {editingPromo?.items?.map((item, idx) => {
                        return (
                            <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-stone-100 shadow-sm">
                                <div className="flex-1">
                                    <Select value={item.service_id || ''} onValueChange={v => handleUpdateItem(idx, 'service_id', v)}>
                                        <SelectTrigger className="h-8 border-0 bg-transparent focus:ring-0 text-xs"><SelectValue placeholder="Selecione o serviço..."/></SelectTrigger>
                                        <SelectContent>
                                            {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (R$ {(s.price_centavos/100).toFixed(2)})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-16 border-l border-stone-100 pl-2">
                                    <Input type="number" className="h-8 border-0 bg-transparent text-center text-xs p-0" value={item.quantity || 1} onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value))} min={1} placeholder="Qtd"/>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-red-500" onClick={() => handleRemoveItem(idx)}>
                                    <X className="h-3 w-3"/>
                                </Button>
                            </div>
                        );
                    })}
                    {(!editingPromo?.items || editingPromo.items.length === 0) && (
                        <div className="text-center py-6 border-2 border-dashed border-stone-200 rounded-lg text-stone-400 text-sm">
                           Nenhum serviço adicionado.
                        </div>
                    )}
                </div>
                
                {itemsSubtotal > 0 && (
                    <div className="flex justify-between items-center pt-3 border-t border-stone-200">
                        <span className="text-xs text-stone-500 uppercase tracking-wide">Soma dos itens (Sem desconto)</span>
                        <span className="font-bold text-stone-700">R$ {(itemsSubtotal / 100).toFixed(2)}</span>
                    </div>
                )}
            </div>

            {/* REGRAS DE PACOTE */}
            {editingPromo?.type === 'package' && (
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-sm pb-2 border-b border-blue-100 mb-2">
                        <CalendarClock className="w-4 h-4" /> Regras de Agendamento
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-blue-600 font-semibold">Validade (Dias)</Label>
                            <Input type="number" className="bg-white border-blue-100 h-9" value={editingPromo?.days_to_expire ?? 30} onChange={e => setEditingPromo(p => p ? ({...p, days_to_expire: parseInt(e.target.value)}) : null)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-blue-600 font-semibold">Intervalo Mín.</Label>
                            <Input type="number" className="bg-white border-blue-100 h-9" value={editingPromo?.min_interval_days ?? 0} onChange={e => setEditingPromo(p => p ? ({...p, min_interval_days: parseInt(e.target.value)}) : null)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-blue-600 font-semibold">Sugerido</Label>
                            <Input type="number" className="bg-white border-blue-100 h-9" value={editingPromo?.suggested_interval_days ?? 15} onChange={e => setEditingPromo(p => p ? ({...p, suggested_interval_days: parseInt(e.target.value)}) : null)} />
                        </div>
                    </div>
                </div>
            )}

            {/* PRECIFICAÇÃO FINAL */}
            <div className="grid grid-cols-2 gap-4 bg-[#C6A87C]/5 p-4 rounded-xl border border-[#C6A87C]/20">
                <div className="space-y-1">
                    <Label className="text-[#C6A87C] font-bold text-xs uppercase">Desconto (%)</Label>
                    <div className="relative">
                        <Input type="number" className="pr-8 bg-white border-[#C6A87C]/30 text-[#C6A87C] font-bold" value={editingPromo?.discount_percentage || 0} onChange={e => setEditingPromo(p => p ? ({...p, discount_percentage: parseInt(e.target.value) || 0}) : null)}/>
                        <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-[#C6A87C]/50"/>
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-[#C6A87C] font-bold text-xs uppercase">Preço Final</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 font-bold text-[#C6A87C]">R$</span>
                        <Input type="number" step="0.01" className="pl-9 font-bold text-lg bg-white border-[#C6A87C]/30 text-[#C6A87C]" value={editingPromo?.price_centavos !== undefined ? (editingPromo.price_centavos / 100) : ''} onChange={e => setEditingPromo(p => p ? ({...p, price_centavos: Math.round(parseFloat(e.target.value)*100)}) : null)} required/>
                    </div>
                </div>
            </div>

            <DialogFooter className="pt-2 border-t border-stone-100 dark:border-stone-800">
                <Button type="button" variant="outline" onClick={() => setEditingPromo(null)} disabled={saveMutation.isPending} className="dark:text-stone-300">Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="min-w-[120px] bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold">
                    {saveMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Salvando...</> : "Salvar Oferta"}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog open={!!deletingPromoId} onOpenChange={() => !deleteMutation.isPending && setDeletingPromoId(null)}>
          <DialogContent className="bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
              <DialogHeader>
                  <DialogTitle className="text-stone-800 dark:text-stone-100">Confirmar Exclusão</DialogTitle>
                  <DialogDescription className="text-stone-500">Tem certeza que deseja excluir esta oferta? Esta ação não pode ser desfeita.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setDeletingPromoId(null)} disabled={deleteMutation.isPending}>Cancelar</Button>
                  <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Excluindo...</> : "Excluir Definitivamente"}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

// --- CARD DE PROMOÇÃO (CORRIGIDO) ---
function PromoCard({ p, onEdit, onDelete }: any) {
  const hasItems = p.items && p.items.length > 0;
  
  return (
    <Card className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 ${!hasItems ? 'border-dashed border-amber-300 bg-amber-50/30' : ''}`}>
        {!hasItems && <div className="absolute top-0 left-0 right-0 bg-amber-100 text-amber-700 text-[10px] font-bold text-center py-1 uppercase tracking-wider">Configuração Pendente</div>}
        
        <CardContent className="p-0 flex flex-col h-full">
            <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                    <Badge variant={p.type === 'combo' ? 'default' : 'secondary'} className={`text-[10px] uppercase font-bold px-2 py-0.5 h-5 ${p.type === 'combo' ? 'bg-stone-800 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                        {p.type === 'combo' ? 'Combo' : 'Pacote'}
                    </Badge>
                    
                    {p.discount_percentage > 0 && hasItems && (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px] font-bold px-2 py-0.5 h-5">
                           -{p.discount_percentage}% OFF
                        </Badge>
                    )}
                </div>

                <h3 className="font-bold text-lg leading-tight text-stone-800 dark:text-stone-100 mb-2 line-clamp-2">{p.title}</h3>
                <p className="text-xs text-stone-500 line-clamp-3 leading-relaxed mb-4 min-h-[3rem]">{p.description || "Sem descrição definida."}</p>
                
                {/* Detalhes do Pacote */}
                {p.days_to_expire && p.type === 'package' && (
                    <div className="mb-4 text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1.5 rounded-lg w-full flex items-center justify-center gap-1 font-medium">
                        <CalendarClock className="w-3 h-3"/> Validade: {p.days_to_expire} dias
                    </div>
                )}

                {/* Lista de Itens (Preview) */}
                <div className="space-y-1 mb-4">
                    {p.items?.slice(0, 2).map((item: any, i: number) => {
                        // 🛠️ Correção Crítica: Verificação segura do ID antes de chamar .slice
                        const serviceId = item.service_id || item.service || ''; 
                        return (
                            <div key={i} className="flex items-center gap-2 text-xs text-stone-500">
                               <CheckCircle2 className="w-3 h-3 text-[#C6A87C]" />
                               <span>{item.quantity}x Serviço (ID: {serviceId.length > 4 ? serviceId.slice(0, 4) + '...' : '?'})</span>
                            </div>
                        );
                    })}
                    {p.items?.length > 2 && <div className="text-[10px] text-stone-400 pl-5">+{p.items.length - 2} outros serviços</div>}
                </div>
            </div>

            <div className="bg-stone-50 dark:bg-stone-950 border-t border-stone-100 dark:border-stone-800 p-4 flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-stone-400 uppercase font-semibold tracking-wide">Valor Final</p>
                    {hasItems ? (
                        <p className="text-xl font-bold text-[#C6A87C]">R$ {(p.price_centavos/100).toFixed(2).replace('.',',')}</p>
                    ) : (
                        <p className="text-base font-medium text-amber-500 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Definir</p>
                    )}
                </div>
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-[#C6A87C] hover:bg-white dark:hover:bg-stone-900 shadow-sm border border-stone-200 dark:border-stone-700">
                            <MoreHorizontal className="w-4 h-4"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onEdit}>
                            <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onDelete} className="text-red-500 focus:text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </CardContent>
    </Card>
  )
}

function EmptyState({ type }: { type: string }) { 
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-2xl bg-white dark:bg-stone-900 text-stone-400">
            <div className="h-16 w-16 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mb-4">
                {type === 'Combos' ? <Tag className="w-8 h-8 opacity-50"/> : <Package className="w-8 h-8 opacity-50"/>}
            </div>
            <h3 className="font-bold text-lg text-stone-600 dark:text-stone-300">Nenhum {type.toLowerCase()} encontrado</h3>
            <p className="text-sm mt-1">Clique em "Criar Oferta" para começar a vender mais.</p>
        </div> 
    ) 
}