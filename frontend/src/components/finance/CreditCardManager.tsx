import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    CreditCard, Plus, CalendarDays, Wallet, Landmark, 
    CheckCircle2, Trash2, AlertTriangle, AlertCircle, 
    ArrowRight, MoreVertical, Pencil
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, addMonths, isSameMonth, parseISO, startOfMonth, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

export function CreditCardManager({ cards, accounts, expenses, onSaveCard, onSaveAccount, onDeleteAccount, onDeleteCard, onPayInvoice }: any) {
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isDeleteCardAlertOpen, setIsDeleteCardAlertOpen] = useState(false);
    
    const [paymentModalData, setPaymentModalData] = useState<any>(null);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    
    const [cardForm, setCardForm] = useState({ name: '', limit_centavos: '', closing_day: '1', due_day: '10' });
    const [accountForm, setAccountForm] = useState({ name: '', balance_reais: '' });

    if (!selectedCardId && cards && cards.length > 0) setSelectedCardId(cards[0].id);

    // --- MODAIS ---
    const openCardModal = (cardToEdit?: any) => { 
        if (cardToEdit) {
            setEditingCardId(cardToEdit.id);
            setCardForm({
                name: cardToEdit.name,
                limit_centavos: (cardToEdit.limit_centavos / 100).toFixed(2),
                closing_day: String(cardToEdit.closing_day),
                due_day: String(cardToEdit.due_day)
            });
        } else {
            setEditingCardId(null);
            setCardForm({ name: '', limit_centavos: '', closing_day: '1', due_day: '10' }); 
        }
        setIsCardModalOpen(true); 
    };

    const handleSaveCard = () => {
        onSaveCard({ 
            id: editingCardId, 
            name: cardForm.name, 
            limit_centavos: Math.round(parseFloat(cardForm.limit_centavos.replace(',', '.')) * 100), 
            closing_day: parseInt(cardForm.closing_day), 
            due_day: parseInt(cardForm.due_day) 
        }); 
        setIsCardModalOpen(false); 
    };

    const handleDeleteCardRequest = (cardId: string) => {
        const hasPending = expenses.some((e: any) => (e.card === cardId || e.card_id === cardId) && e.status === 'pending');
        if (hasPending) return toast.error("Resolva as pendências antes de excluir o cartão.");
        setEditingCardId(cardId); 
        setIsDeleteCardAlertOpen(true);
    };

    const confirmDeleteCard = () => {
        if (onDeleteCard && editingCardId) {
            onDeleteCard(editingCardId);
            setIsDeleteCardAlertOpen(false);
            setEditingCardId(null);
            if(selectedCardId === editingCardId) setSelectedCardId(null);
        }
    };

    const openAccountModal = () => { setAccountForm({ name: '', balance_reais: '' }); setIsAccountModalOpen(true); };
    const handleSaveAccount = () => { if(!accountForm.name) return toast.warning("Digite o nome."); onSaveAccount({ name: accountForm.name, balance_centavos: Math.round(parseFloat(accountForm.balance_reais.replace(',', '.') || '0') * 100), color: 'blue' }); setIsAccountModalOpen(false); };

    // --- CÁLCULOS ---
    const cardData = useMemo(() => {
        if (!selectedCardId || !expenses) return null;
        const currentCard = cards.find((c: any) => c.id === selectedCardId);
        
        const pendingExpenses = expenses.filter((e: any) => (e.card === selectedCardId || e.card_id === selectedCardId) && e.status === 'pending');
        const usedLimit = pendingExpenses.reduce((acc: number, e: any) => acc + Number(e.amount_centavos), 0);
        const limitTotal = currentCard ? Number(currentCard.limit_centavos) : 0;
        const availableLimit = limitTotal - usedLimit;
        const usedPercentage = limitTotal > 0 ? Math.min(100, (usedLimit / limitTotal) * 100) : 0;

        const cardExpenses = expenses.filter((e: any) => e.card === selectedCardId || e.card_id === selectedCardId);
        const currentMonth = startOfMonth(new Date());
        const months = Array.from({ length: 12 }, (_, i) => addMonths(currentMonth, i));

        const invoices = months.map(monthDate => {
            const monthExpenses = cardExpenses.filter((e: any) => isSameMonth(parseISO(e.payment_date), monthDate));
            const total = monthExpenses.reduce((acc: number, e: any) => acc + Number(e.amount_centavos), 0);
            const hasPending = monthExpenses.some((e: any) => e.status === 'pending');
            const status = total === 0 ? 'empty' : (hasPending ? 'open' : 'paid');
            return { date: monthDate, label: format(monthDate, 'MMM', { locale: ptBR }).toUpperCase(), fullLabel: format(monthDate, 'MMMM yyyy', { locale: ptBR }), total, items: monthExpenses, status };
        });
        return { invoices, usedLimit, availableLimit, usedPercentage, currentCard };
    }, [selectedCardId, expenses, cards]);

    // Pagamento
    const handleOpenPayment = (data: any, type: 'invoice' | 'item') => { setPaymentModalData({ ...data, type }); if (accounts && accounts.length > 0) setSelectedBankAccountId(accounts[0].id); };
    const handleConfirmPayment = () => {
        if (!selectedBankAccountId) return toast.error("Selecione uma conta.");
        const account = accounts.find((a: any) => a.id === selectedBankAccountId);
        const amountToPay = paymentModalData.type === 'invoice' ? paymentModalData.items.filter((i:any) => i.status === 'pending').reduce((acc:number, i:any) => acc + Number(i.amount_centavos), 0) : Number(paymentModalData.amount_centavos);
        
        if (account && account.balance_centavos < amountToPay) { return toast.error("Saldo insuficiente nesta conta!"); }
        
        let itemsToPay = paymentModalData.type === 'invoice' ? paymentModalData.items.filter((i: any) => i.status === 'pending') : [paymentModalData];
        onPayInvoice(itemsToPay, selectedBankAccountId);
        setPaymentModalData(null);
    };

    return (
        <div className="space-y-10 pb-24 font-sans text-stone-700">
            {/* SEÇÃO 1: BANCOS */}
            <div className="space-y-4">
                <div className="flex justify-between items-end px-1"><h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Minhas Contas</h3><Button variant="ghost" size="sm" onClick={openAccountModal} className="text-[#C6A87C] hover:bg-[#C6A87C]/10 text-xs font-bold h-7">+ NOVA CONTA</Button></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {(accounts || []).map((acc: any) => (
                        <div key={acc.id} className="relative group overflow-hidden rounded-2xl bg-white border border-stone-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-6 w-6 text-stone-300 hover:text-red-500" onClick={() => onDeleteAccount(acc.id)}><Trash2 className="w-3 h-3"/></Button></div>
                            <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center border border-stone-100"><Landmark className="w-5 h-5 text-stone-600"/></div><span className="font-semibold text-stone-600 text-sm">{acc.name}</span></div>
                            <div className="space-y-1"><p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Saldo Disponível</p><p className={`text-2xl font-black ${acc.balance_centavos < 0 ? 'text-red-500' : 'text-stone-800'}`}>{formatCurrency(acc.balance_centavos / 100)}</p></div>
                        </div>
                    ))}
                    {(accounts || []).length === 0 && (<div onClick={openAccountModal} className="border-2 border-dashed border-stone-200 rounded-2xl p-6 flex flex-col items-center justify-center text-stone-400 cursor-pointer hover:border-[#C6A87C] hover:text-[#C6A87C] transition-colors min-h-[140px]"><Plus className="w-6 h-6 mb-2"/><span className="text-xs font-bold uppercase">Adicionar Banco</span></div>)}
                </div>
            </div>

            {/* SEÇÃO 2: CARTÕES */}
            <div className="space-y-4">
                <div className="flex justify-between items-end px-1"><h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Cartões de Crédito</h3><Button variant="ghost" size="sm" onClick={() => openCardModal()} className="text-[#C6A87C] hover:bg-[#C6A87C]/10 text-xs font-bold h-7">+ NOVO CARTÃO</Button></div>
                <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x px-1">
                    {(cards || []).map((card: any) => {
                        const isSelected = selectedCardId === card.id;
                        return (
                            <div key={card.id} onClick={() => setSelectedCardId(card.id)} className={`relative min-w-[300px] h-[200px] rounded-3xl p-6 snap-center cursor-pointer transition-all duration-500 flex flex-col justify-between overflow-hidden group ${isSelected ? 'shadow-2xl scale-[1.02] ring-2 ring-[#C6A87C] ring-offset-2' : 'shadow-md scale-100 opacity-80 hover:opacity-100'}`} style={{background: isSelected ? 'linear-gradient(135deg, #0c0a09 0%, #1c1917 100%)' : 'linear-gradient(135deg, #44403c 0%, #57534e 100%)', color: 'white'}}>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <div className="flex justify-between items-start z-10">
                                    <div className="flex items-center gap-2"><div className="w-8 h-6 bg-gradient-to-br from-yellow-200 to-yellow-600 rounded-md border border-yellow-500/50 shadow-sm opacity-90"></div><Wallet className="w-4 h-4 text-white/50"/></div>
                                    <div className="flex items-center gap-2"><span className="text-xs font-mono text-white/60 tracking-widest">**** {card.due_day}</span>
                                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-white/50 hover:text-white -mr-2"><MoreVertical className="w-4 h-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-32 bg-stone-900 border-stone-800 text-white"><DropdownMenuItem onClick={(e) => {e.stopPropagation(); openCardModal(card)}} className="focus:bg-stone-800 focus:text-white cursor-pointer"><Pencil className="w-3 h-3 mr-2"/> Editar</DropdownMenuItem><DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleDeleteCardRequest(card.id)}} className="text-red-400 focus:text-red-400 focus:bg-stone-800 cursor-pointer"><Trash2 className="w-3 h-3 mr-2"/> Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                                    </div>
                                </div>
                                <div className="z-10"><h4 className="text-xl font-bold tracking-wide">{card.name}</h4><p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">Premium Credit</p></div>
                                {isSelected && cardData && (
                                    <div className="space-y-1.5 z-10">
                                        <div className="flex justify-between text-[10px] font-medium text-white/80"><span>Gasto: {formatCurrency(cardData.usedLimit/100)}</span><span className={cardData.availableLimit < 0 ? "text-red-400" : "text-emerald-400"}>Disp: {formatCurrency(cardData.availableLimit/100)}</span></div>
                                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden backdrop-blur-sm"><div className={`h-full shadow-lg transition-all duration-1000 ease-out ${cardData.usedPercentage > 90 ? 'bg-red-500' : 'bg-[#C6A87C]'}`} style={{ width: `${Math.min(cardData.usedPercentage, 100)}%` }}/></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SEÇÃO 3: FATURAS */}
            {cardData && (
                <div className="bg-white rounded-3xl border border-stone-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                    <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between"><div><h3 className="text-lg font-bold text-stone-800">Faturas</h3><p className="text-xs text-stone-500">Gerencie os pagamentos do {cardData.currentCard.name}</p></div><Badge variant="outline" className="bg-white border-stone-200 text-stone-500">12 Meses</Badge></div>
                    <Tabs defaultValue={cardData.invoices[0]?.label} className="w-full">
                        <div className="px-6 pt-4 pb-2 border-b border-stone-100 bg-white sticky top-0 z-20"><ScrollArea className="w-full pb-2"><TabsList className="bg-transparent justify-start gap-3 h-auto p-0">{cardData.invoices.map((inv: any) => (<TabsTrigger key={inv.label} value={inv.label} disabled={inv.status === 'empty'} className={`flex flex-col items-start min-w-[100px] p-3 rounded-2xl border transition-all duration-200 data-[state=active]:bg-stone-900 data-[state=active]:text-white data-[state=active]:border-stone-900 data-[state=active]:shadow-lg ${inv.status === 'paid' ? 'border-emerald-100 bg-emerald-50/30' : 'border-stone-100 bg-white hover:border-stone-300'} ${inv.status === 'empty' ? 'opacity-40 grayscale' : ''}`}><span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">{inv.label}</span><span className="text-sm font-bold">{formatCurrency(inv.total / 100)}</span><div className="flex items-center gap-1 mt-2"><div className={`w-1.5 h-1.5 rounded-full ${inv.status === 'paid' ? 'bg-emerald-500' : (inv.status === 'open' ? 'bg-amber-500' : 'bg-stone-300')}`}></div><span className="text-[9px] font-medium opacity-80">{inv.status === 'paid' ? 'Paga' : 'Aberta'}</span></div></TabsTrigger>))}</TabsList></ScrollArea></div>
                        {cardData.invoices.map((inv: any) => (<TabsContent key={inv.label} value={inv.label} className="p-0 m-0 focus-visible:ring-0"><div className="p-6 bg-stone-50/30"><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4"><div><h4 className="text-xl font-black text-stone-800 capitalize">{inv.fullLabel}</h4><p className="text-xs text-stone-500">Vencimento dia {cardData.currentCard.due_day}</p></div>{inv.status === 'open' ? (<Button onClick={() => handleOpenPayment(inv, 'invoice')} className="w-full sm:w-auto bg-stone-900 hover:bg-black text-white font-bold rounded-xl shadow-lg shadow-stone-200 transition-all hover:scale-105">Pagar Fatura <span className="ml-1 opacity-70">({formatCurrency(inv.total/100)})</span> <ArrowRight className="w-4 h-4 ml-2"/></Button>) : (inv.status === 'paid' && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1 rounded-full"><CheckCircle2 className="w-3 h-3 mr-1"/> Fatura Paga</Badge>)}</div><div className="space-y-3">{inv.items.map((item: any) => { const itemDate = parseISO(item.payment_date); const isOverdue = isPast(itemDate) && !isToday(itemDate) && item.status === 'pending'; const isDueToday = isToday(itemDate) && item.status === 'pending'; return (<div key={item.id} className="group bg-white p-4 rounded-2xl border border-stone-100 hover:border-[#C6A87C]/30 hover:shadow-md transition-all flex items-center justify-between"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${isOverdue ? 'bg-red-50 text-red-500' : 'bg-stone-50 text-stone-400'}`}>{item.description.charAt(0).toUpperCase()}</div><div><p className="text-sm font-bold text-stone-700">{item.description}</p><div className="flex items-center gap-2 mt-0.5"><Badge variant="secondary" className="bg-stone-50 text-stone-500 text-[9px] h-5 rounded-md px-1.5 font-normal">{format(itemDate, "dd 'de' MMM")}</Badge>{item.installments_total > 1 && <span className="text-[10px] text-stone-400 font-medium">Parcela {item.installments_current}/{item.installments_total}</span>}</div></div></div><div className="text-right"><span className="text-sm font-bold text-stone-800 block">{formatCurrency(item.amount_centavos / 100)}</span><div className="flex justify-end items-center gap-1 mt-1">{isOverdue && <span className="text-[9px] font-bold text-red-500 flex items-center bg-red-50 px-1.5 py-0.5 rounded-full"><AlertCircle className="w-2.5 h-2.5 mr-1"/> Vencida</span>}{isDueToday && <span className="text-[9px] font-bold text-amber-600 flex items-center bg-amber-50 px-1.5 py-0.5 rounded-full"><AlertTriangle className="w-2.5 h-2.5 mr-1"/> Vence Hoje</span>}{item.status === 'paid' && <span className="text-[9px] font-bold text-emerald-600 flex items-center bg-emerald-50 px-1.5 py-0.5 rounded-full">Pago</span>}{item.status === 'pending' && !isOverdue && !isDueToday && (<Button variant="ghost" size="sm" className="h-6 text-[9px] px-2 text-[#C6A87C] hover:bg-[#C6A87C]/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleOpenPayment(item, 'item')}>Antecipar</Button>)}{(isOverdue || isDueToday) && item.status === 'pending' && (<Button variant="ghost" size="sm" className="h-6 text-[9px] px-2 text-red-500 hover:bg-red-50" onClick={() => handleOpenPayment(item, 'item')}>Pagar</Button>)}</div></div></div>); })}</div></div></TabsContent>))}
                    </Tabs>
                </div>
            )}

            {/* 🔥 MODAL CARTÃO COM LABELS CORRIGIDOS */}
            <Dialog open={isCardModalOpen} onOpenChange={setIsCardModalOpen}>
                <DialogContent className="bg-white rounded-3xl p-6">
                    <DialogHeader><DialogTitle className="text-xl font-black text-stone-800">{editingCardId ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle></DialogHeader>
                    <div className="grid gap-5 py-4">
                        <div className="space-y-1.5"><Label className="text-xs font-bold text-stone-400 uppercase">Apelido do Cartão</Label><Input value={cardForm.name} onChange={e => setCardForm({...cardForm, name: e.target.value})} placeholder="Ex: Nubank Ultravioleta" className="rounded-xl border-stone-200 h-11"/></div>
                        <div className="space-y-1.5"><Label className="text-xs font-bold text-stone-400 uppercase">Limite Total (R$)</Label><Input type="number" value={cardForm.limit_centavos} onChange={e => setCardForm({...cardForm, limit_centavos: e.target.value})} placeholder="0,00" className="rounded-xl border-stone-200 h-11"/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5"><Label className="text-xs font-bold text-stone-400 uppercase">Dia Fechamento</Label><Input type="number" min="1" max="31" value={cardForm.closing_day} onChange={e => setCardForm({...cardForm, closing_day: e.target.value})} className="rounded-xl border-stone-200 h-11 text-center font-bold"/></div>
                            <div className="space-y-1.5"><Label className="text-xs font-bold text-stone-400 uppercase">Dia Vencimento</Label><Input type="number" min="1" max="31" value={cardForm.due_day} onChange={e => setCardForm({...cardForm, due_day: e.target.value})} className="rounded-xl border-stone-200 h-11 text-center font-bold"/></div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveCard} className="bg-stone-900 text-white rounded-xl h-11 font-bold w-full">Salvar Cartão</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteCardAlertOpen} onOpenChange={setIsDeleteCardAlertOpen}><DialogContent className="bg-white rounded-3xl"><DialogHeader><DialogTitle>Excluir Cartão?</DialogTitle><DialogDescription>Essa ação é irreversível.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setIsDeleteCardAlertOpen(false)} className="rounded-xl">Cancelar</Button><Button onClick={confirmDeleteCard} className="bg-red-600 text-white rounded-xl hover:bg-red-700">Sim, Excluir</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}><DialogContent className="bg-white rounded-3xl"><DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader><div className="grid gap-4 py-4"><div className="space-y-1.5"><Label className="text-xs font-bold text-stone-400 uppercase">Nome da Conta</Label><Input value={accountForm.name} onChange={e => setAccountForm({...accountForm, name: e.target.value})} placeholder="Ex: Itaú" className="rounded-xl h-11"/></div><div className="space-y-1.5"><Label className="text-xs font-bold text-stone-400 uppercase">Saldo Inicial (R$)</Label><Input type="number" value={accountForm.balance_reais} onChange={e => setAccountForm({...accountForm, balance_reais: e.target.value})} placeholder="0,00" className="rounded-xl h-11"/></div></div><DialogFooter><Button onClick={handleSaveAccount} className="bg-stone-900 text-white rounded-xl h-11 w-full">Salvar Conta</Button></DialogFooter></DialogContent></Dialog>
            
            {/* Modal de Pagamento (Universal) */}
            <Dialog open={!!paymentModalData} onOpenChange={() => setPaymentModalData(null)}>
                <DialogContent className="bg-white rounded-3xl sm:max-w-[400px]">
                    <DialogHeader><div className="mx-auto w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mb-3"><CheckCircle2 className="w-7 h-7 text-emerald-600"/></div><DialogTitle className="text-center text-xl font-black">Confirmar Baixa</DialogTitle><DialogDescription className="text-center">Valor Total: <span className="text-stone-900 font-black text-lg block mt-1">{paymentModalData ? formatCurrency(paymentModalData.type === 'invoice' ? paymentModalData.items.filter((i:any) => i.status === 'pending').reduce((acc:number, i:any) => acc + Number(i.amount_centavos), 0)/100 : paymentModalData.amount_centavos/100) : 'R$ 0,00'}</span></DialogDescription></DialogHeader>
                    <div className="py-4 space-y-3">
                        <Label className="text-xs font-bold text-stone-400 uppercase">Origem do Pagamento</Label>
                        <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                            <SelectTrigger className="h-12 bg-stone-50 border-stone-200 rounded-xl"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                            <SelectContent>{(accounts || []).map((acc: any) => (<SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance_centavos/100)})</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                    <DialogFooter className="flex gap-2"><Button variant="ghost" onClick={() => setPaymentModalData(null)} className="flex-1 rounded-xl">Cancelar</Button><Button onClick={handleConfirmPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 font-bold rounded-xl shadow-lg shadow-emerald-100">Confirmar</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}