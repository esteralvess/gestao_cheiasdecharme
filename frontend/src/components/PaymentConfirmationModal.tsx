import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { customersAPI, servicesAPI, appointmentsAPI } from "@/services/api";
import { Check, DollarSign, Wallet, Gift, Percent, Package, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  appointment: any;
}

export function PaymentConfirmationModal({ isOpen, onClose, onConfirm, appointment }: PaymentModalProps) {
  // --- ESTADOS ---
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [useReferralDiscount, setUseReferralDiscount] = useState(false);
  const [customDiscount, setCustomDiscount] = useState<string>("");
  
  // Estado para controle de erro visual
  const [showError, setShowError] = useState(false);

  // --- EXTRAÇÃO SEGURA DE IDS ---
  const customerId = typeof appointment?.customer === 'object' ? appointment.customer.id : appointment?.customer;
  const serviceId = typeof appointment?.service === 'object' ? appointment.service.id : appointment?.service;

  // --- QUERIES ---
  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersAPI.getOne(customerId),
    enabled: !!customerId
  });

  const { data: service } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => servicesAPI.getOne(serviceId),
    enabled: !!serviceId
  });

  // --- LÓGICA DE PRECIFICAÇÃO ---
  const isPriceFixed = useMemo(() => {
      return appointment?.final_amount_centavos !== undefined && appointment?.final_amount_centavos !== null;
  }, [appointment]);

  const basePrice = useMemo(() => {
    if (isPriceFixed) {
        return appointment.final_amount_centavos;
    }
    if (service?.price_centavos) {
        return service.price_centavos;
    }
    return appointment?.service_price || appointment?.service?.price_centavos || 0;
  }, [appointment, service, isPriceFixed]);

  const appointmentType = useMemo(() => {
      const notes = appointment?.notes || "";
      if (notes.includes("[Combo:")) return "combo";
      if (notes.includes("[Pacote:")) return "pacote";
      return "avulso";
  }, [appointment]);

  const isNewCustomer = useMemo(() => {
      return customer && (customer.visits === 0 || customer.visits === null);
  }, [customer]);

  const hasReferralBonus = useMemo(() => {
      return customer && (customer.referral_count > 0); 
  }, [customer]);

  const customerPoints = customer?.points || 0;

  const { finalPrice, discountsApplied } = useMemo(() => {
      let total = basePrice;
      const discounts = [];

      if (!isPriceFixed) {
          if (appointmentType === "combo") {
              const comboDiscount = Math.round(basePrice * 0.05);
              total -= comboDiscount;
              discounts.push({ name: "Desconto Combo (5%)", value: comboDiscount, type: 'structural' });
          } else if (appointmentType === "pacote") {
              const packageDiscount = Math.round(basePrice * 0.08);
              total -= packageDiscount;
              discounts.push({ name: "Desconto Pacote (8%)", value: packageDiscount, type: 'structural' });
          }
      }

      if (isNewCustomer) {
          const firstTimeDiscount = Math.round(basePrice * 0.10);
          total -= firstTimeDiscount;
          discounts.push({ name: "Bem-vinda (10%)", value: firstTimeDiscount, type: 'benefit' });
      }

      if (useReferralDiscount && appointmentType === "avulso" && !useLoyaltyPoints && !isNewCustomer) {
          const referralVal = Math.round(basePrice * 0.05);
          total -= referralVal;
          discounts.push({ name: "Bônus Indicação (5%)", value: referralVal, type: 'benefit' });
      }

      if (useLoyaltyPoints && !useReferralDiscount && customerPoints > 0) {
          const pointsValueInCents = Math.floor(customerPoints * 10); 
          const discountToApply = Math.min(pointsValueInCents, total);
          
          if (discountToApply > 0) {
              total -= discountToApply;
              discounts.push({ name: "Fidelidade", value: discountToApply, type: 'benefit' });
          }
      }

      if (customDiscount) {
          const manualVal = parseFloat(customDiscount.replace(',', '.')) * 100;
          if (!isNaN(manualVal) && manualVal > 0) {
              total -= manualVal;
              discounts.push({ name: "Extra", value: manualVal });
          }
      }

      return { finalPrice: Math.max(0, total), discountsApplied: discounts };
  }, [basePrice, isNewCustomer, useReferralDiscount, useLoyaltyPoints, customerPoints, appointmentType, customDiscount, isPriceFixed]);


  // --- HANDLERS ---
  const handleConfirmPayment = async () => {
    // Validação de Campo Obrigatório
    if (!paymentMethod) {
        setShowError(true); // Ativa o estado de erro visual
        toast.error("Por favor, selecione a Forma de Pagamento para continuar.");
        return;
    }

    if (!customer) return toast.error("Erro: Cliente não identificado.");

    try {
        await appointmentsAPI.update(appointment.id, {
            status: 'completed',
            payment_method: paymentMethod,
            final_amount_centavos: finalPrice,
            notes: appointment.notes + (useLoyaltyPoints ? " [Pontos Usados]" : "") + (isNewCustomer ? " [1ª Visita]" : "")
        });

        // Deduzir Pontos
        if (useLoyaltyPoints) {
            const discountValue = discountsApplied.find(d => d.name === "Fidelidade")?.value || 0;
            const pointsToDeduct = Math.floor(discountValue / 10); 
            
            const newPoints = Math.max(0, Math.floor(customerPoints - pointsToDeduct));
            await customersAPI.update(customer.id, { 
                full_name: customer.full_name, 
                whatsapp: customer.whatsapp,
                points: newPoints 
            });
        }

        // Atualizar Visita
        await customersAPI.update(customer.id, { 
            full_name: customer.full_name, 
            whatsapp: customer.whatsapp,
            visits: (customer.visits || 0) + 1,
            last_visit: new Date().toISOString()
        });

        toast.success("Pagamento confirmado!");
        onConfirm();
    } catch (error: any) {
        console.error(error);
        const msg = error.response?.data?.payment_method?.[0] || "Erro ao processar pagamento.";
        toast.error(msg);
    }
  };

  const toggleReferral = (val: boolean) => { setUseReferralDiscount(val); if(val) setUseLoyaltyPoints(false); };
  const togglePoints = (val: boolean) => { setUseLoyaltyPoints(val); if(val) setUseReferralDiscount(false); };

  // Handler para limpar erro ao selecionar
  const handlePaymentChange = (value: string) => {
      setPaymentMethod(value);
      if (value) setShowError(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 bg-white border-stone-100 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-2 bg-white border-b border-stone-50 z-10">
          <div className="mx-auto bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-2 shadow-sm">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <DialogTitle className="text-center text-xl text-stone-800">Confirmar Pagamento</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-6">
            <div className="bg-stone-50 p-4 rounded-xl space-y-2 border border-stone-100">
                <div className="flex justify-between text-sm"><span className="text-stone-500 font-medium">Serviço</span><span className="text-stone-800 font-bold text-right w-1/2">{appointment?.service_name || service?.name}</span></div>
                
                {appointmentType !== 'avulso' && (
                    <div className="flex items-center gap-2 text-xs font-bold text-[#C6A87C] bg-[#C6A87C]/10 p-2 rounded-lg">
                        {appointmentType === 'combo' ? <Sparkles className="w-3 h-3"/> : <Package className="w-3 h-3"/>}
                        {appointmentType === 'combo' ? 'Combo Promocional' : 'Pacote Recorrente'}
                    </div>
                )}

                <div className="flex justify-between text-sm pt-2"><span className="text-stone-500 font-medium">Valor Base</span><span className="text-stone-800">R$ {(basePrice / 100).toFixed(2).replace('.', ',')}</span></div>
                
                {discountsApplied.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-dashed border-stone-200 space-y-1">
                        {discountsApplied.map((d, i) => (
                            <div key={i} className={`flex justify-between text-xs ${d.type === 'structural' ? 'text-[#C6A87C] font-bold' : 'text-emerald-600'}`}>
                                <span>{d.name}</span><span>- R$ {(d.value / 100).toFixed(2).replace('.', ',')}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Descontos & Fidelidade</p>
                {isNewCustomer ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                        <div className="flex items-center gap-2"><Gift className="w-4 h-4 text-emerald-600" /><div><p className="text-sm font-bold text-emerald-700">Boas-vindas</p><p className="text-[10px] text-emerald-600">10% OFF na 1ª visita aplicado!</p></div></div><Check className="w-4 h-4 text-emerald-600" />
                    </div>
                ) : (
                   <div className={`flex items-center justify-between p-3 rounded-lg border ${(appointmentType !== 'avulso' || !hasReferralBonus) ? 'opacity-50 bg-stone-50 cursor-not-allowed' : 'border-stone-200'}`}>
                        <div className="flex items-center gap-2">
                            <Percent className="w-4 h-4 text-blue-500" />
                            <div><p className="text-sm font-medium text-stone-700">Indique e Ganhe (5%)</p><p className="text-[10px] text-stone-400">{appointmentType !== 'avulso' ? "Apenas serviços avulsos" : (hasReferralBonus ? "Saldo disponível" : "Sem saldo de indicações")}</p></div>
                        </div>
                        <Switch checked={useReferralDiscount} onCheckedChange={toggleReferral} disabled={appointmentType !== 'avulso' || !hasReferralBonus || useLoyaltyPoints} />
                    </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-lg border border-stone-200">
                    <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-[#C6A87C]" />
                        <div><p className="text-sm font-medium text-stone-700">Usar Pontos</p><p className="text-[10px] text-stone-400">Saldo: {customerPoints} pts (R$ {(customerPoints * 0.10).toFixed(2)})</p></div>
                    </div>
                    <Switch checked={useLoyaltyPoints} onCheckedChange={togglePoints} disabled={!customer || customerPoints <= 0} />
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1">
                    Forma de Pagamento <span className="text-red-500 text-sm">*</span>
                </Label>
                <Select value={paymentMethod} onValueChange={handlePaymentChange}>
                    <SelectTrigger className={`bg-stone-50 h-12 transition-all duration-300 ${showError && !paymentMethod ? "border-red-500 ring-1 ring-red-500 bg-red-50" : "border-stone-200"}`}>
                        <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pix">Pix</SelectItem>
                        <SelectItem value="credito">Cartão de Crédito</SelectItem>
                        <SelectItem value="debito">Cartão de Débito</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                </Select>
                {showError && !paymentMethod && (
                    <div className="flex items-center gap-1 text-xs text-red-500 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-3 h-3" /> Campo obrigatório
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-100 mt-2 pb-2">
                <span className="text-stone-500 font-medium">Total a Receber</span>
                <span className="text-3xl font-bold text-emerald-600">R$ {(finalPrice / 100).toFixed(2).replace('.', ',')}</span>
            </div>
        </div>

        <DialogFooter className="p-6 pt-2 bg-white border-t border-stone-50 flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={onClose} className="w-full h-12 text-base">Cancelar</Button>
            <Button onClick={handleConfirmPayment} className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-200">Confirmar Recebimento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}