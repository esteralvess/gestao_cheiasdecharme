import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Landmark } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export function TransferDialog({ open, onClose, onSave, accounts }: any) {
    const [formData, setFormData] = useState({ 
        amount_reais: '', 
        account_id: '', 
        date: format(new Date(), 'yyyy-MM-dd'),
        description: 'Sangria de Caixa'
    });

    const handleSave = () => {
        if (!formData.amount_reais || !formData.account_id) return toast.warning("Preencha valor e conta.");
        
        const amount_centavos = Math.round(parseFloat(formData.amount_reais.replace(',', '.')) * 100);
        
        onSave({
            description: formData.description,
            amount_centavos: amount_centavos,
            payment_date: formData.date,
            type: 'transfer', // 🔥 Tipo especial
            category_legacy: 'Transferência', // Para compatibilidade
            status: 'paid',
            account_id: formData.account_id // Envia ID para o backend somar
        });
        
        setFormData({ amount_reais: '', account_id: '', date: format(new Date(), 'yyyy-MM-dd'), description: 'Sangria de Caixa' });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] bg-white">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                        <ArrowRightLeft className="w-6 h-6 text-blue-600"/>
                    </div>
                    <DialogTitle className="text-center">Transferir para Conta</DialogTitle>
                    <DialogDescription className="text-center">
                        Tirar do <strong>Caixa (Atendimentos)</strong> e enviar para um Banco.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Valor */}
                    <div className="space-y-1.5">
                        <Label>Valor a Transferir</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 font-bold">R$</span>
                            <Input 
                                className="pl-10 text-lg font-bold" 
                                placeholder="0,00"
                                value={formData.amount_reais}
                                onChange={e => setFormData({...formData, amount_reais: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Conta Destino */}
                    <div className="space-y-1.5">
                        <Label>Conta de Destino</Label>
                        <Select value={formData.account_id} onValueChange={(v) => setFormData({...formData, account_id: v})}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o Banco"/></SelectTrigger>
                            <SelectContent>
                                {accounts.map((acc: any) => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Data */}
                    <div className="space-y-1.5">
                        <Label>Data</Label>
                        <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                        Confirmar Transferência
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}