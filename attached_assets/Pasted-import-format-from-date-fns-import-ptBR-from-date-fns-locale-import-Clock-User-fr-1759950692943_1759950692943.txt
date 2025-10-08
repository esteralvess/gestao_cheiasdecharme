import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AppointmentCardProps {
  id: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  startTime: Date;
  endTime: Date;
  status: "confirmed" | "completed" | "cancelled" | "pending";
  onClick?: () => void;
}

const statusConfig = {
  confirmed: { label: "Confirmado", color: "bg-chart-3/10 text-chart-3" },
  completed: { label: "Concluído", color: "bg-chart-1/10 text-chart-1" },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
  pending: { label: "Pendente", color: "bg-chart-2/10 text-chart-2" },
};

export default function AppointmentCard({ customerName, serviceName, staffName, startTime, endTime, status, onClick }: AppointmentCardProps) {
  const config = statusConfig[status];
  
  return (
    <Card 
      className="p-4 hover-elevate cursor-pointer" 
      onClick={onClick}
      data-testid={`card-appointment-${customerName.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-foreground truncate">{customerName}</h3>
            <Badge className={`${config.color} no-default-hover-elevate no-default-active-elevate`}>
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-1">{serviceName}</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{staffName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{format(startTime, "HH:mm", { locale: ptBR })} - {format(endTime, "HH:mm", { locale: ptBR })}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
