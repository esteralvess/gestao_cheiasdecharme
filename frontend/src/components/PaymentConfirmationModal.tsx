import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, DollarSign, Calendar, User, Scissors } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// 👇 AQUI ESTÁ A CORREÇÃO: Adicionei 'appointment' na interface
export interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  appointment: any; // ✅ Agora ele aceita o objeto de agendamento
}

export function PaymentConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  appointment 
}: PaymentConfirmationModalProps) {
  
  // Proteção contra dados vazios
  if (!appointment) return null;

  // Garante que temos um objeto de data válido
  const date = appointment.startTime instanceof Date 
    ? appointment.startTime 
    : parseISO(appointment.originalData?.start_time || appointment.start_time || new Date().toISOString());

  // Calcula valor (usando final_amount ou service price)
  const priceCentavos = appointment.originalData?.final_amount_centavos 
    || appointment.originalData?.service_price_centavos 
    || appointment.final_amount_centavos 
    || 0;
    
  const price = (priceCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <DialogTitle className="text-center text-xl text-stone-800 dark:text-stone-100">
            Confirmar Pagamento
          </DialogTitle>
          <DialogDescription className="text-center text-stone-500">
            Deseja marcar este agendamento como concluído e pago?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-stone-50 dark:bg-stone-900 p-4 rounded-lg space-y-3 my-2 border border-stone-100 dark:border-stone-800">
          
          <div className="flex justify-between items-center pb-3 border-b border-stone-200 dark:border-stone-800">
             <span className="text-sm text-stone-500 font-medium">Valor a Receber</span>
             <span className="text-lg font-bold text-emerald-600">{price}</span>
          </div>

          <div className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
             <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#C6A87C]" />
                <span>{appointment.customerName || appointment.customer_name}</span>
             </div>
             <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#C6A87C]" />
                <span>{appointment.serviceName || appointment.service_name}</span>
             </div>
             <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C6A87C]" />
                <span className="capitalize">
                  {format(date, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </span>
             </div>
          </div>

        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto dark:text-stone-300">
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            <Check className="w-4 h-4 mr-2" />
            Confirmar Recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}