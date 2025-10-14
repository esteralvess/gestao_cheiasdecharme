import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PaymentConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (paymentDetails: {
        payment_method: string;
        discount_centavos: number;
        final_amount_centavos: number;
    }) => void;
    servicePrice: number; // in centavos
    isSaving: boolean;
}

export function PaymentConfirmationModal({ isOpen, onClose, onConfirm, servicePrice, isSaving }: PaymentConfirmationModalProps) {
    const [discountReais, setDiscountReais] = useState('0');
    const [paymentMethod, setPaymentMethod] = useState('pix');

    useEffect(() => {
        if (isOpen) {
            setDiscountReais('0');
            setPaymentMethod('pix');
        }
    }, [isOpen]);

    const finalAmountCentavos = useMemo(() => {
        const discountCentavos = Math.round(parseFloat(discountReais.replace(',', '.')) * 100) || 0;
        return servicePrice - discountCentavos;
    }, [servicePrice, discountReais]);

    const handleConfirm = () => {
        const discountCentavos = Math.round(parseFloat(discountReais.replace(',', '.')) * 100) || 0;
        onConfirm({
            payment_method: paymentMethod,
            discount_centavos: discountCentavos,
            final_amount_centavos: finalAmountCentavos,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirmar Recebimento</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Valor Original do Serviço</p>
                        <p className="text-2xl font-bold">R$ {(servicePrice / 100).toFixed(2)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="discount">Desconto (R$)</Label>
                            <Input 
                                id="discount" 
                                type="number" 
                                step="0.01"
                                value={discountReais}
                                onChange={(e) => setDiscountReais(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="payment-method">Método de Pagamento</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger id="payment-method">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pix">Pix</SelectItem>
                                    <SelectItem value="credito">Crédito</SelectItem>
                                    <SelectItem value="debito">Débito</SelectItem>
                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="outros">Outro</SelectItem> {/* ✅ CORREÇÃO */}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="p-4 border border-primary rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Valor Final a Receber</p>
                        <p className="text-3xl font-bold text-primary">R$ {(finalAmountCentavos / 100).toFixed(2)}</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleConfirm} disabled={isSaving}>
                        {isSaving ? "Salvando..." : "Confirmar Recebimento"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}