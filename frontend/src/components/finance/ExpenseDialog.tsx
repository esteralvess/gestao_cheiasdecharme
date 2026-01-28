import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, CheckCircle2, Clock, CalendarIcon, ArrowUpCircle, ArrowDownCircle, Wallet, CreditCard, Banknote, QrCode } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// Helper para formatar moeda visualmente
const formatCurrencyInput = (value: string) => {
    const number = value.replace(/\D/g, "") || "0";
    return (parseFloat(number) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
};

export function ExpenseDialog({ open, onClose, onSave, expense, cards = [], categories = [], accounts = [], isSaving, defaultType = 'expense' }: any) {
    const isNew = !expense?.id;
    const initialType = expense?.type === 'income' ? 'income' : (defaultType === 'income' ? 'income' : 'variable');
    
    // Estados do Formulário
    const [formData, setFormData] = useState({ 
        description: '', 
        category: '', 
        type: initialType, 
        status: 'paid', 
        card: 'none', 
        payment_method: 'pix', // 🔥 Novo Campo
        account_id: '', // 🔥 Novo Campo (Conta de Destino/Origem)
        amount_display: '0,00', 
        payment_date: format(new Date(), 'yyyy-MM-dd'), 
        notes: '',
        installments_total: '1'
    }); 

    // Pré-seleciona a primeira conta se for novo
    useEffect(() => {
        if (open && isNew && accounts.length > 0 && !formData.account_id) {
            setFormData(prev => ({ ...prev, account_id: accounts[0].id }));
        }
    }, [open, accounts, isNew]);

    useEffect(() => { 
        if (open) {
            const currentType = expense?.id ? (expense.type === 'income' ? 'income' : 'variable') : (defaultType === 'income' ? 'income' : 'variable');
            
            if (expense?.id) { 
                setFormData({ 
                    description: expense.description || '', 
                    category: expense.category || '', 
                    type: currentType, 
                    status: expense.status || 'paid', 
                    card: expense.card || 'none', 
                    payment_method: expense.payment_method || 'pix',
                    account_id: expense.account_id || (accounts[0]?.id || ''), // Tenta recuperar conta vinculada se tivesse essa info
                    amount_display: expense.amount_centavos ? (Math.abs(expense.amount_centavos) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : '0,00', 
                    payment_date: expense.payment_date || format(new Date(), 'yyyy-MM-dd'), 
                    notes: expense.notes || '',
                    installments_total: String(expense.installments_total || 1)
                }); 
            } else {
                // Reset
                setFormData(prev => ({ 
                    ...prev, 
                    description: '', category: '', type: currentType, status: 'paid', card: 'none', 
                    payment_method: 'pix', amount_display: '0,00', installments_total: '1',
                    payment_date: format(new Date(), 'yyyy-MM-dd')
                }));
            }
        }
    }, [expense, open, defaultType, accounts]); 

    const handleAmountChange = (e: any) => {
        const value = e.target.value.replace(/\D/g, "");
        const formatted = (parseFloat(value) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        setFormData({ ...formData, amount_display: formatted });
    };

    const handleSave = () => { 
        if (!formData.description || formData.amount_display === '0,00') return toast.warning("Preencha descrição e valor.");
        
        // Converte visual (1.000,00) para centavos (100000)
        const amount_centavos = Math.round(parseFloat(formData.amount_display.replace(/\./g, '').replace(',', '.')) * 100);
        
        // Lógica de Conta vs Cartão
        let finalAccountId = formData.account_id;
        let finalStatus = formData.status;

        // Se escolheu Cartão de Crédito, a conta não é usada agora (só na fatura) e status é pendente
        if (formData.payment_method === 'credit_card' && formData.card !== 'none') {
            finalAccountId = ''; 
            finalStatus = 'pending';
        }

        const dataToSend = { 
            ...formData, 
            amount_centavos,
            status: finalStatus,
            card: (formData.payment_method === 'credit_card' && formData.card !== 'none') ? formData.card : null,
            account_id: finalAccountId // Envia a conta para o backend fazer o saldo
        };
        
        delete (dataToSend as any).amount_display; // Remove campo visual
        
        onSave({ ...expense, ...dataToSend }); 
    }; 

    const isIncome = formData.type === 'income';
    const headerColor = isIncome ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100';
    const iconColor = isIncome ? 'text-emerald-600' : 'text-red-600';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[550px] bg-white p-0 overflow-hidden rounded-3xl border-none shadow-2xl font-sans">
                
                <DialogHeader className={`px-8 pt-8 pb-6 border-b ${headerColor}`}>
                    <DialogTitle className="text-2xl font-black text-stone-800 flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm ${iconColor}`}>
                            {isNew ? (isIncome ? <ArrowUpCircle className="w-7 h-7" /> : <ArrowDownCircle className="w-7 h-7" />) : <Pencil className="w-6 h-6" />}
                        </div>
                        <div>
                            {isNew ? (isIncome ? 'Nova Receita' : 'Nova Despesa') : 'Editar Lançamento'}
                            <p className="text-sm font-medium text-stone-500 mt-0.5 opacity-80">
                                {isIncome ? 'Dinheiro entrando no caixa.' : 'Pagamento ou conta.'}
                            </p>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                
                <div className="px-8 py-6 space-y-5 bg-white">
                    {/* INPUT DE VALOR GIGANTE */}
                    <div className="flex flex-col items-center justify-center">
                        <Label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Valor Total</Label>
                        <div className="flex items-center justify-center relative">
                            <span className={`text-3xl font-bold mr-2 absolute left-0 ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>R$</span>
                            <Input 
                                type="text" 
                                className={`bg-transparent border-none text-center text-5xl font-black h-16 w-full pl-12 focus-visible:ring-0 placeholder:text-stone-200 shadow-none ${isIncome ? 'text-emerald-700' : 'text-red-700'}`} 
                                value={formData.amount_display} 
                                onChange={handleAmountChange}
                                placeholder="0,00" autoFocus
                            />
                        </div>
                    </div>

                    {/* DESCRIÇÃO E CATEGORIA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-stone-500 ml-1">Descrição</Label>
                            <Input placeholder={isIncome ? "Ex: Venda de Produtos" : "Ex: Conta de Luz"} className="h-11 bg-stone-50 border-stone-200 rounded-xl font-medium" value={formData.description} onChange={e => setFormData(f => ({...f, description: e.target.value}))}/>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-stone-500 ml-1">Categoria</Label>
                            <Select value={formData.category} onValueChange={(v) => setFormData(f => ({...f, category: v}))}>
                                <SelectTrigger className="h-11 bg-stone-50 border-stone-200 rounded-xl"><SelectValue placeholder="Selecione"/></SelectTrigger>
                                <SelectContent>
                                    {categories.filter((c: any) => c.type === (isIncome ? 'income' : 'expense')).map((cat: any) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                                    <SelectItem value="outros">Outros / Geral</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* LINHA DE PAGAMENTO (Onde a mágica acontece) */}
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-4">
                        <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-stone-400"/><Label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Detalhes do Pagamento</Label></div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* FORMA DE PAGAMENTO */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-stone-400">Forma</Label>
                                <Select value={formData.payment_method} onValueChange={(v) => setFormData(f => ({...f, payment_method: v}))}>
                                    <SelectTrigger className="h-10 bg-white border-stone-200 rounded-xl"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pix"><div className="flex items-center gap-2"><QrCode className="w-4 h-4"/> Pix</div></SelectItem>
                                        <SelectItem value="cash"><div className="flex items-center gap-2"><Banknote className="w-4 h-4"/> Dinheiro</div></SelectItem>
                                        <SelectItem value="debit_card"><div className="flex items-center gap-2"><CreditCard className="w-4 h-4"/> Débito</div></SelectItem>
                                        <SelectItem value="credit_card"><div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-purple-600"/> Crédito</div></SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* CONTA OU CARTÃO (Depende da forma) */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-stone-400">
                                    {formData.payment_method === 'credit_card' ? 'Qual Cartão?' : (isIncome ? 'Entrar em:' : 'Sair de:')}
                                </Label>
                                
                                {formData.payment_method === 'credit_card' ? (
                                    // SELECIONA CARTÃO DE CRÉDITO
                                    <Select value={formData.card} onValueChange={(v) => setFormData(f => ({...f, card: v}))}>
                                        <SelectTrigger className="h-10 bg-white border-stone-200 rounded-xl"><SelectValue placeholder="Selecione"/></SelectTrigger>
                                        <SelectContent>
                                            {cards.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    // SELECIONA CONTA BANCÁRIA (Incluindo Caixa)
                                    <Select value={formData.account_id} onValueChange={(v) => setFormData(f => ({...f, account_id: v}))}>
                                        <SelectTrigger className="h-10 bg-white border-stone-200 rounded-xl"><SelectValue placeholder="Selecione Conta"/></SelectTrigger>
                                        <SelectContent>
                                            {accounts.map((acc: any) => (
                                                <SelectItem key={acc.id} value={acc.id}>
                                                    {acc.name} {acc.name.toLowerCase().includes('caixa') ? '(Físico)' : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {/* DATA E PARCELAS */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-stone-400">Data {formData.payment_method === 'credit_card' ? 'da Compra' : 'do Pagamento'}</Label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4"/>
                                    <Input type="date" className="h-10 pl-9 bg-white border-stone-200 rounded-xl text-xs" value={formData.payment_date} onChange={e => setFormData(f => ({...f, payment_date: e.target.value}))} />
                                </div>
                            </div>
                            
                            {formData.payment_method === 'credit_card' && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-stone-400">Parcelas</Label>
                                    <Select value={formData.installments_total} onValueChange={(v) => setFormData(f => ({...f, installments_total: v}))}>
                                        <SelectTrigger className="h-10 bg-white border-stone-200 rounded-xl"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">À vista (1x)</SelectItem>
                                            {[2,3,4,5,6,10,12].map(i => <SelectItem key={i} value={String(i)}>{i}x</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            
                            {/* Se não for cartão, mostra status (geralmente já vem pago) */}
                            {formData.payment_method !== 'credit_card' && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-stone-400">Situação</Label>
                                    <div className="flex bg-white rounded-xl border border-stone-200 p-1">
                                        <button onClick={() => setFormData(f => ({...f, status: 'paid'}))} className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${formData.status === 'paid' ? 'bg-stone-100 text-stone-800 shadow-sm' : 'text-stone-400'}`}>Realizado</button>
                                        <button onClick={() => setFormData(f => ({...f, status: 'pending'}))} className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${formData.status === 'pending' ? 'bg-amber-50 text-amber-600 shadow-sm' : 'text-stone-400'}`}>Agendado</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-8 py-5 bg-stone-50 border-t border-stone-100 flex gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving} className="flex-1 rounded-xl h-11">Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving} className={`flex-1 font-bold shadow-lg text-white rounded-xl h-11 ${isIncome ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-stone-900 hover:bg-black shadow-stone-200'}`}>
                        {isSaving ? 'Salvando...' : 'Confirmar Lançamento'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}