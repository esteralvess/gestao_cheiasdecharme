import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { customersAPI, servicesAPI, accountsAPI } from "@/services/api"; 
import { Check, DollarSign, Wallet, Gift, Percent, Package, AlertCircle, CheckCircle2, Landmark, CreditCard, Banknote, QrCode } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils"; // Certifique-se de ter criado este utilitário

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  appointment: any;
}

export function PaymentConfirmationModal({ isOpen, onClose, onConfirm, appointment }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [accountId, setAccountId] = useState<string>(""); // Conta de Destino
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [useReferralDiscount, setUseReferralDiscount] = useState(false);
  const [customDiscount, setCustomDiscount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showError, setShowError] = useState(false);

  // Queries
  const customerId = typeof appointment?.customer === 'object' ? appointment.customer.id : appointment?.customer;
  const serviceId = typeof appointment?.service === 'object' ? appointment.service.id : appointment?.service;

  const { data: customer } = useQuery({ queryKey: ['customer', customerId], queryFn: () => customersAPI.getOne(customerId), enabled: !!customerId });
  const { data: service } = useQuery({ queryKey: ['service', serviceId], queryFn: () => servicesAPI.getOne(serviceId), enabled: !!serviceId });
  
  // 🔥 Busca as Contas para o Seletor
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsAPI.getAll, enabled: isOpen });

  // 🔥 Pré-seleciona a conta "Caixa" ou a primeira disponível
  useEffect(() => {
      if (isOpen && accounts.length > 0 && !accountId) {
          const caixa = accounts.find((a:any) => a.name.toLowerCase().includes('caixa'));
          setAccountId(caixa ? caixa.id : accounts[0].id);
      }
  }, [isOpen, accounts]);

  // Lógica de Preço (Mantida igual)
  const fixedAmount = appointment?.final_amount_centavos;
  const hasFixedPrice = fixedAmount !== undefined && fixedAmount !== null;
  const isAlreadyPaid = hasFixedPrice && fixedAmount === 0 && (appointment?.notes?.includes('[Pacote') || appointment?.notes?.includes('[Combo'));

  const basePrice = useMemo(() => {
    if (hasFixedPrice) return fixedAmount;
    if (service?.price_centavos) return service.price_centavos;
    return appointment?.service_price || 0;
  }, [appointment, service, hasFixedPrice, fixedAmount]);

  const appointmentType = useMemo(() => {
      const n = appointment?.notes || "";
      if (n.includes("[Combo:")) return "combo";
      if (n.includes("[Pacote:")) return "pacote";
      return "avulso";
  }, [appointment]);

  const isNewCustomer = customer && (customer.visits === 0 || customer.visits === null);
  const hasReferralBonus = customer && (customer.referral_count > 0); 
  const customerPoints = customer?.points || 0;

  const { finalPrice, discountsApplied } = useMemo(() => {
      if (isAlreadyPaid) return { finalPrice: 0, discountsApplied: [] };
      let total = basePrice;
      const discounts = [];

      if (!hasFixedPrice) {
          if (appointmentType === "combo") {
              const disc = Math.round(basePrice * 0.05); total -= disc; discounts.push({ name: "Desconto Combo (5%)", value: disc, type: 'structural' });
          } else if (appointmentType === "pacote") {
              const disc = Math.round(basePrice * 0.08); total -= disc; discounts.push({ name: "Desconto Pacote (8%)", value: disc, type: 'structural' });
          }
      }
      if (isNewCustomer) { const disc = Math.round(basePrice * 0.10); total -= disc; discounts.push({ name: "Bem-vinda (10%)", value: disc, type: 'benefit' }); }
      
      if (useReferralDiscount && !useLoyaltyPoints && !isNewCustomer) {
          const disc = Math.round(basePrice * 0.05); total -= disc; discounts.push({ name: "Bônus Indicação (5%)", value: disc, type: 'benefit' });
      }
      if (useLoyaltyPoints && !useReferralDiscount && customerPoints > 0) {
          const pointsVal = Math.floor(customerPoints * 10); const disc = Math.min(pointsVal, total);
          if (disc > 0) { total -= disc; discounts.push({ name: `Fidelidade (${customerPoints} pts)`, value: disc, type: 'benefit' }); }
      }
      if (customDiscount) {
          const manual = parseFloat(customDiscount.replace(',', '.')) * 100;
          if (!isNaN(manual) && manual > 0) { total -= manual; discounts.push({ name: "Desconto Extra", value: manual, type: 'manual' }); }
      }
      return { finalPrice: Math.max(0, total), discountsApplied: discounts };
  }, [basePrice, isNewCustomer, useReferralDiscount, useLoyaltyPoints, customerPoints, appointmentType, customDiscount, hasFixedPrice, isAlreadyPaid]);

  const handleConfirmPayment = async () => {
    // Validação: Exige Conta se não estiver pago
    if (!isAlreadyPaid && (!paymentMethod || !accountId)) {
        setShowError(true);
        toast.error("Selecione a Forma de Pagamento e a Conta.");
        return;
    }
    if (!customer) return toast.error("Cliente não identificado.");

    // 🔥 Payload Completo para a API /pay/
    const payload = {
        payment_method: isAlreadyPaid ? 'pacote_pre_pago' : paymentMethod,
        account_id: isAlreadyPaid ? null : accountId, // Envia o ID da conta
        amount: finalPrice,
        final_amount_centavos: finalPrice,
        notes: (appointment.notes || "") + (notes ? `\n[Obs: ${notes}]` : "")
    };

    onConfirm(payload);

    // Atualiza Pontos
    if (useLoyaltyPoints) {
        const discountValue = discountsApplied.find(d => d.name.includes("Fidelidade"))?.value || 0;
        const newPoints = Math.max(0, Math.floor(customerPoints - Math.floor(discountValue / 10)));
        await customersAPI.update(customer.id, { points: newPoints });
    }
    if (finalPrice > 0) {
         const pointsEarned = Math.floor(finalPrice / 100);
         setTimeout(async () => {
             const current = await customersAPI.getOne(customer.id);
             await customersAPI.update(customer.id, { points: (current.points || 0) + pointsEarned });
         }, 500);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md bg-white rounded-3xl p-0 overflow-hidden font-sans border-none shadow-2xl">
        <DialogHeader className={`p-6 pb-4 border-b ${isAlreadyPaid ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-stone-50'}`}>
          <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 shadow-sm ${isAlreadyPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-50 text-stone-600'}`}>
            {isAlreadyPaid ? <CheckCircle2 className="w-7 h-7"/> : <DollarSign className="w-7 h-7" />}
          </div>
          <DialogTitle className="text-center text-xl font-black text-stone-800">{isAlreadyPaid ? "Concluir Sessão" : "Confirmar Recebimento"}</DialogTitle>
          <DialogDescription className="text-center text-xs text-stone-500 font-medium">{appointment.customer_name} • {appointment.service_name}</DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* CARD DE VALOR */}
            <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Valor Final</span>
                <span className="text-3xl font-black text-stone-800">{formatCurrency(finalPrice/100)}</span>
                
                {discountsApplied.length > 0 && (
                    <div className="w-full mt-3 pt-3 border-t border-dashed border-stone-200 space-y-1">
                        {discountsApplied.map((d, i) => (
                            <div key={i} className="flex justify-between text-xs font-medium text-emerald-600">
                                <span>{d.name}</span><span>- {formatCurrency(d.value/100)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {!isAlreadyPaid && (
                <>
                    {/* OPÇÕES DE DESCONTO */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest pl-1">Aplicar Descontos</p>
                        {isNewCustomer && <div className="flex justify-between p-3 border rounded-xl border-emerald-100 bg-emerald-50/50 text-emerald-700 text-xs font-bold items-center"><span className="flex gap-2"><Gift className="w-4 h-4"/> Boas-vindas (10%)</span><Check className="w-4 h-4"/></div>}
                        
                        {!isNewCustomer && <div className="flex justify-between items-center p-3 border border-stone-100 rounded-xl bg-white"><div className="flex gap-3 items-center"><div className="p-1.5 bg-blue-50 rounded-lg text-blue-500"><Percent className="w-4 h-4"/></div><span className="text-xs font-bold text-stone-600">Indicação (5%)</span></div><Switch checked={useReferralDiscount} onCheckedChange={(v) => {setUseReferralDiscount(v); if(v) setUseLoyaltyPoints(false);}} disabled={!hasReferralBonus || useLoyaltyPoints}/></div>}
                        
                        <div className="flex justify-between items-center p-3 border border-stone-100 rounded-xl bg-white"><div className="flex gap-3 items-center"><div className="p-1.5 bg-amber-50 rounded-lg text-amber-500"><Wallet className="w-4 h-4"/></div><div className="flex flex-col"><span className="text-xs font-bold text-stone-600">Usar Pontos</span><span className="text-[9px] text-stone-400">{customerPoints} pts disponíveis</span></div></div><Switch checked={useLoyaltyPoints} onCheckedChange={(v) => {setUseLoyaltyPoints(v); if(v) setUseReferralDiscount(false);}} disabled={!customer || customerPoints <= 0}/></div>
                    </div>

                    {/* SELEÇÃO DE PAGAMENTO & CONTA */}
                    <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-stone-500 ml-1">Forma</Label>
                                <Select value={paymentMethod} onValueChange={(v) => {setPaymentMethod(v); setShowError(false);}}>
                                    <SelectTrigger className="h-11 bg-white border-stone-200 rounded-xl"><SelectValue placeholder="Selecione"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pix"><div className="flex gap-2 items-center"><QrCode className="w-3 h-3"/> Pix</div></SelectItem>
                                        <SelectItem value="credit_card"><div className="flex gap-2 items-center"><CreditCard className="w-3 h-3 text-purple-600"/> Crédito</div></SelectItem>
                                        <SelectItem value="debit_card"><div className="flex gap-2 items-center"><CreditCard className="w-3 h-3"/> Débito</div></SelectItem>
                                        <SelectItem value="cash"><div className="flex gap-2 items-center"><Banknote className="w-3 h-3 text-green-600"/> Dinheiro</div></SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {/* 🔥 SELETOR DE CONTA OBRIGATÓRIO */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-stone-500 ml-1">Entrar em</Label>
                                <Select value={accountId} onValueChange={(v) => {setAccountId(v); setShowError(false);}}>
                                    <SelectTrigger className="h-11 bg-white border-stone-200 rounded-xl"><SelectValue placeholder="Conta"/></SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((acc:any) => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                <div className="flex gap-2 items-center">
                                                    <Landmark className="w-3 h-3 text-stone-400"/> {acc.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {showError && <p className="text-xs text-red-500 text-center font-bold bg-red-50 p-2 rounded-lg flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4"/> Selecione a Forma e a Conta!</p>}
                    </div>
                </>
            )}

            <div className="space-y-1.5">
                <Label className="text-xs font-bold text-stone-500 ml-1">Observações</Label>
                <Textarea placeholder="Detalhes do pagamento..." value={notes} onChange={e => setNotes(e.target.value)} className="resize-none h-14 text-xs bg-stone-50 border-stone-200 rounded-xl"/>
            </div>
        </div>

        <DialogFooter className="p-5 bg-stone-50 border-t border-stone-100 flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1 h-12 rounded-xl text-stone-500 hover:text-stone-700 hover:bg-stone-100">Cancelar</Button>
            <Button onClick={handleConfirmPayment} className="flex-1 bg-stone-900 hover:bg-black text-white font-bold h-12 rounded-xl shadow-lg shadow-stone-200 transition-all hover:scale-[1.02]">
                {isAlreadyPaid ? "Concluir Sessão" : "Confirmar Recebimento"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}