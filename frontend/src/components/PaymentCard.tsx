import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, CreditCard, Wallet, Smartphone } from "lucide-react";

interface PaymentCardProps {
  appointmentId: string;
  customerName: string;
  serviceName: string;
  amount: number;
  paymentMethod: "dinheiro" | "debito" | "credito" | "pix" | "outros";
  paymentDate: Date;
  commission?: number;
}

const paymentMethodConfig = {
  dinheiro: { label: "Dinheiro", icon: Wallet },
  debito: { label: "Débito", icon: CreditCard },
  credito: { label: "Crédito", icon: CreditCard },
  pix: { label: "PIX", icon: Smartphone },
  outros: { label: "Outros", icon: DollarSign },
};

export default function PaymentCard({ 
  customerName, 
  serviceName, 
  amount, 
  paymentMethod, 
  paymentDate,
  commission 
}: PaymentCardProps) {
  const config = paymentMethodConfig[paymentMethod];
  const Icon = config.icon;
  
  return (
    <Card className="p-4" data-testid={`card-payment-${customerName.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-foreground truncate">{customerName}</h3>
            <Badge className="bg-primary/10 text-primary no-default-hover-elevate no-default-active-elevate">
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-1">{serviceName}</p>
          <p className="text-xs text-muted-foreground">
            {format(paymentDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">R$ {(amount / 100).toFixed(2)}</p>
          {commission !== undefined && commission > 0 && (
            <p className="text-xs text-muted-foreground">
              Comissão: R$ {(commission / 100).toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
