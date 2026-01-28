import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  ShoppingBag, 
  Pencil, 
  Trash2, 
  Clock,
  Calendar,
  Sparkles,
  Package,
  ArrowDown,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { promotionsAPI, servicesAPI } from "@/services/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Service { id: string; name: string; price_centavos: number; }

interface PromotionItem { 
    id?: string;
    service_id: string; 
    quantity: number; 
    custom_interval: number;
    is_linked_to_previous: boolean; 
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
  const [activeTab, setActiveTab] = useState("package");
  
  const { data: promotions = [] } = useQuery<Promotion[]>({ queryKey: ['promotions'], queryFn: promotionsAPI.getAll });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });

  // --- LÓGICA DE AGRUPAMENTO VISUAL ---
  const groupedSessions = useMemo(() => {
      if (!editingPromo?.items) return [];
      const sessions: { intervalBefore: number, items: { item: PromotionItem, originalIndex: number }[] }[] = [];
      
      editingPromo.items.forEach((item, index) => {
          if (index === 0 || !item.is_linked_to_previous) {
              sessions.push({
                  intervalBefore: item.custom_interval || 0,
                  items: [{ item, originalIndex: index }]
              });
          } else {
              sessions[sessions.length - 1].items.push({ item, originalIndex: index });
          }
      });
      return sessions;
  }, [editingPromo?.items]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
        const payload = {
            ...data,
            items: data.items.map((item: any) => ({
                service_id: item.service_id,
                quantity: Number(item.quantity),
                custom_interval: Number(item.custom_interval || 0),
                is_linked_to_previous: Boolean(item.is_linked_to_previous)
            }))
        };
        return data.id ? promotionsAPI.update(data.id, payload) : promotionsAPI.create(payload);
    },
    onSuccess: () => { 
        toast.success("Oferta salva com sucesso!"); 
        setEditingPromo(null); 
        queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: () => toast.error("Erro ao salvar oferta.")
  });

  const handleEdit = (promo: Promotion) => {
      const itemsMapped = promo.items?.map((item: any) => ({
          id: item.id, 
          quantity: item.quantity, 
          service_id: item.service_id || item.service || '',
          custom_interval: item.custom_interval || 0,
          is_linked_to_previous: item.is_linked_to_previous || false
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

  // --- MANIPULAÇÃO DA LISTA ---
  const addItemToSession = (sessionIndex: number) => {
      if (!editingPromo) return;
      const newItems = [...(editingPromo.items || [])];
      
      // Se for combo, sempre adiciona linkado (mesma sessão)
      // Se for pacote, mantém lógica de sessão
      const isFirstItemEver = newItems.length === 0;
      
      newItems.push({
          service_id: '',
          quantity: 1,
          custom_interval: 0,
          is_linked_to_previous: !isFirstItemEver 
      });
      setEditingPromo({ ...editingPromo, items: newItems });
  };

  const addNewSession = () => {
      if (!editingPromo) return;
      const newItems = [...(editingPromo.items || [])];
      newItems.push({
          service_id: '',
          quantity: 1,
          custom_interval: 7, 
          is_linked_to_previous: false 
      });
      setEditingPromo({ ...editingPromo, items: newItems });
  };

  const removeItem = (originalIndex: number) => {
      if (!editingPromo?.items) return;
      const newItems = editingPromo.items.filter((_, i) => i !== originalIndex);
      if (originalIndex < newItems.length) {
          const wasHeadOfSession = !editingPromo.items[originalIndex].is_linked_to_previous;
          if (wasHeadOfSession && newItems[originalIndex]) {
             newItems[originalIndex].is_linked_to_previous = false;
             newItems[originalIndex].custom_interval = editingPromo.items[originalIndex].custom_interval;
          }
      }
      setEditingPromo({ ...editingPromo, items: newItems });
  };

  const updateItem = (index: number, field: keyof PromotionItem, value: any) => {
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans pb-24">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <ShoppingBag className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Ofertas e Pacotes
        </h1>
        <Button onClick={() => setEditingPromo({ type: activeTab as any, active: true, price_centavos: 0, items: [], discount_percentage: 0 })} className="bg-[#C6A87C] text-white hover:bg-[#B08D55] w-full md:w-auto shadow-sm">
          <Plus className="w-4 h-4 mr-2" /> Nova Oferta
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white dark:bg-stone-900 border p-1 rounded-xl w-full md:w-auto grid grid-cols-2 md:inline-flex">
            <TabsTrigger value="package" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">Pacotes (Recorrentes)</TabsTrigger>
            <TabsTrigger value="combo" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">Combos (Dia Único)</TabsTrigger>
        </TabsList>

        <TabsContent value="package" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pt-6">
            {grouped.package.map(p => <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} />)}
            {grouped.package.length === 0 && <p className="col-span-full text-center text-stone-400 py-10">Nenhum pacote cadastrado.</p>}
        </TabsContent>
        
        <TabsContent value="combo" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pt-6">
            {grouped.combo.map(p => <PromoCard key={p.id} p={p} onEdit={() => handleEdit(p)} />)}
            {grouped.combo.length === 0 && <p className="col-span-full text-center text-stone-400 py-10">Nenhum combo cadastrado.</p>}
        </TabsContent>
      </Tabs>

      {/* DIALOG RESPONSIVO */}
      <Dialog open={!!editingPromo} onOpenChange={() => setEditingPromo(null)}>
        <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-stone-950 rounded-2xl">
          <DialogHeader className="px-6 py-4 border-b border-stone-100 bg-stone-50/50">
            <DialogTitle className="flex items-center gap-2 text-stone-800">
                {editingPromo?.id ? <Pencil className="w-4 h-4"/> : <Plus className="w-4 h-4"/>} 
                {editingPromo?.id ? 'Editar' : 'Criar'} {editingPromo?.type === 'package' ? 'Pacote' : 'Combo'}
            </DialogTitle>
            <DialogDescription>
                Configure os serviços inclusos nesta oferta.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* CABEÇALHO DA OFERTA */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1">
                    <Label className="text-xs uppercase font-bold text-stone-500">Título da Oferta</Label>
                    <Input value={editingPromo?.title || ''} onChange={e => setEditingPromo({...editingPromo, title: e.target.value})} required className="font-bold text-lg h-11" placeholder="Ex: Cronograma Capilar Completo" />
                </div>
                <div className="md:col-span-4 flex items-end">
                    <div className="flex items-center justify-between border p-3 rounded-lg bg-stone-50 w-full h-11">
                        <Label className="text-xs font-bold text-stone-600">Ativo no Site</Label>
                        <Switch checked={editingPromo?.active} onCheckedChange={c => setEditingPromo({...editingPromo, active: c})}/>
                    </div>
                </div>
            </div>

            {/* ÁREA DE CONFIGURAÇÃO DE SESSÕES (LINHA DO TEMPO) */}
            <div className="bg-stone-50/50 border border-stone-200 rounded-xl p-4 space-y-6">
                <div className="flex justify-between items-center mb-2">
                    <Label className="text-sm font-black text-stone-700 uppercase tracking-wide flex items-center gap-2">
                        {editingPromo?.type === 'combo' ? <Sparkles className="w-4 h-4 text-purple-500"/> : <Calendar className="w-4 h-4"/>}
                        {editingPromo?.type === 'combo' ? "Composição do Combo" : "Cronograma de Execução"}
                    </Label>
                </div>

                {groupedSessions.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-stone-200 rounded-xl bg-white">
                        <Package className="w-10 h-10 text-stone-300 mx-auto mb-2"/>
                        <p className="text-stone-500 font-medium">Nenhum serviço adicionado.</p>
                        <p className="text-xs text-stone-400 mb-4">Adicione os serviços que compõem este {editingPromo?.type === 'combo' ? 'combo' : 'pacote'}.</p>
                        <Button type="button" onClick={() => addItemToSession(0)} className="bg-[#C6A87C] text-white">Adicionar 1º Serviço</Button>
                    </div>
                )}

                {groupedSessions.map((session, sIdx) => (
                    <div key={sIdx} className="relative animate-in fade-in slide-in-from-bottom-2">
                        {/* CONECTOR DE TEMPO (Apenas para PACOTES e se não for a primeira sessão) */}
                        {editingPromo?.type === 'package' && sIdx > 0 && (
                            <div className="flex justify-center items-center py-4 relative">
                                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-stone-200 -z-10"></div>
                                <div className="bg-white border border-stone-300 text-stone-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm z-10">
                                    <Clock className="w-3 h-3 text-stone-400"/>
                                    <span>Após</span>
                                    <Input 
                                        type="number" 
                                        className="w-12 h-7 text-center bg-stone-50 border-stone-200 p-0 text-xs font-bold" 
                                        value={editingPromo?.items?.[session.items[0].originalIndex].custom_interval}
                                        onChange={(e) => updateItem(session.items[0].originalIndex, 'custom_interval', Number(e.target.value))}
                                    />
                                    <span>dias</span>
                                </div>
                            </div>
                        )}

                        {/* CARD DA SESSÃO */}
                        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="bg-stone-50/80 px-4 py-2 border-b border-stone-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-stone-600 uppercase flex items-center gap-2">
                                    {/* Se for Pacote, mostra número da sessão. Se for Combo, não mostra. */}
                                    {editingPromo?.type === 'package' && (
                                        <div className="w-5 h-5 rounded-full bg-[#C6A87C] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">{sIdx + 1}</div>
                                    )}
                                    {editingPromo?.type === 'package' 
                                        ? (sIdx === 0 ? "1ª Sessão (Início)" : `${sIdx + 1}ª Sessão (Retorno)`)
                                        : "Serviços Inclusos (Dia Único)"
                                    }
                                </span>
                                {editingPromo?.type === 'package' && (
                                    <Badge variant="outline" className="text-[10px] bg-white text-stone-400 font-normal border-stone-200">
                                        {session.items.length} serviço(s)
                                    </Badge>
                                )}
                            </div>
                            
                            <div className="p-3 space-y-3">
                                {session.items.map(({ item, originalIndex }) => (
                                    <div key={originalIndex} className="flex gap-2 items-end">
                                        <div className="flex-1 grid grid-cols-12 gap-2">
                                            <div className="col-span-9 sm:col-span-9">
                                                <Label className="text-[10px] text-stone-400 font-bold uppercase ml-1">Serviço</Label>
                                                <Select value={item.service_id} onValueChange={v => updateItem(originalIndex, 'service_id', v)}>
                                                    <SelectTrigger className="h-9 text-xs bg-stone-50 border-stone-200"><SelectValue placeholder="Selecione..."/></SelectTrigger>
                                                    <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-3 sm:col-span-3">
                                                <Label className="text-[10px] text-stone-400 font-bold uppercase ml-1 text-center block">Qtd</Label>
                                                <Input type="number" min="1" className="h-9 text-center text-xs bg-stone-50 border-stone-200" value={item.quantity} onChange={e => updateItem(originalIndex, 'quantity', e.target.value)} />
                                            </div>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-stone-300 hover:text-red-500 hover:bg-red-50" onClick={() => removeItem(originalIndex)}>
                                            <Trash2 className="w-4 h-4"/>
                                        </Button>
                                    </div>
                                ))}
                                
                                <div className="pt-2">
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => addItemToSession(sIdx)} 
                                        className="w-full text-xs text-[#C6A87C] hover:text-[#B08D55] hover:bg-[#C6A87C]/10 border border-dashed border-[#C6A87C]/30 h-9"
                                    >
                                        <Plus className="w-3 h-3 mr-1"/> Adicionar outro serviço {editingPromo?.type === 'package' ? 'nesta sessão' : ''}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* BOTÃO NOVA SESSÃO (Apenas para Pacotes) */}
                {editingPromo?.type === 'package' && groupedSessions.length > 0 && (
                    <div className="flex justify-center pt-2">
                        <Button type="button" variant="outline" onClick={addNewSession} className="rounded-full shadow-sm hover:border-[#C6A87C] hover:text-[#C6A87C] transition-all bg-white">
                            <ArrowDown className="w-4 h-4 mr-2"/> Adicionar Próxima Sessão (Retorno)
                        </Button>
                    </div>
                )}
            </div>

            {/* PREÇO E DESCONTO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-stone-900 text-white p-5 rounded-xl shadow-lg">
                <div>
                    <Label className="text-[10px] uppercase font-bold text-stone-400">Desconto Global (%)</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <Input type="number" className="bg-stone-800 border-stone-700 text-white h-10 font-bold w-24 text-center" value={editingPromo?.discount_percentage || 0} onChange={e => {
                            const d = Number(e.target.value);
                            const p = itemsSubtotal - (itemsSubtotal * (d/100));
                            setEditingPromo({...editingPromo, discount_percentage: d, price_centavos: Math.round(p)});
                        }}/>
                        <div className="flex flex-col">
                            <span className="text-xs text-stone-400">Valor Original</span>
                            <span className="text-sm font-bold text-stone-300 line-through">R$ {(itemsSubtotal/100).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div className="text-left md:text-right mt-4 md:mt-0">
                    <Label className="text-[10px] uppercase font-bold text-[#C6A87C]">Preço Final</Label>
                    <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-900 font-bold">R$</span>
                        <Input type="number" step="0.01" className="bg-white text-stone-900 h-12 font-black text-2xl border-none pl-10 text-left md:text-right" value={editingPromo?.price_centavos ? editingPromo.price_centavos / 100 : ''} onChange={e => setEditingPromo({...editingPromo, price_centavos: Math.round(Number(e.target.value)*100)})}/>
                    </div>
                </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t border-stone-100 bg-stone-50/50">
                <Button type="button" variant="outline" onClick={() => setEditingPromo(null)} className="w-full md:w-auto h-12">Cancelar</Button>
                <Button type="button" onClick={() => saveMutation.mutate(editingPromo)} className="w-full md:w-auto bg-[#C6A87C] hover:bg-[#B08D55] text-white h-12 font-bold shadow-md min-w-[150px]" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Salvando..." : "Salvar Configuração"}
                </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromoCard({ p, onEdit }: any) {
  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-stone-100 dark:border-stone-800 group cursor-pointer bg-white" onClick={onEdit}>
        <CardContent className="p-6 flex flex-col h-full relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${p.type === 'combo' ? 'from-purple-100 to-transparent' : 'from-emerald-100 to-transparent'} rounded-bl-full opacity-50`}></div>
            
            <div className="flex justify-between items-start mb-4 z-10">
                <Badge className={`${p.type === 'combo' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'} border-none px-3 py-1`}>
                    {p.type === 'combo' ? <Sparkles className="w-3 h-3 mr-1"/> : <Package className="w-3 h-3 mr-1"/>}
                    {p.type === 'combo' ? 'Combo' : 'Pacote'}
                </Badge>
                {p.active ? <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-200"></div> : <div className="w-2 h-2 rounded-full bg-stone-300"></div>}
            </div>
            
            <h3 className="font-bold text-xl mb-2 text-stone-800 group-hover:text-[#C6A87C] transition-colors leading-tight">{p.title}</h3>
            
            <div className="mt-auto space-y-4">
                <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-50 p-2 rounded-lg border border-stone-100">
                    <Info className="w-3 h-3 text-[#C6A87C]"/>
                    <span>{p.items?.length || 0} itens configurados</span>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-400 uppercase">Valor Total</span>
                    <span className="font-black text-xl text-[#C6A87C]">R$ {(p.price_centavos/100).toFixed(2).replace('.',',')}</span>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}