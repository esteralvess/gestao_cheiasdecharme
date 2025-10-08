import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  confirmed: { label: "Confirmado", color: "bg-green-100 text-green-800" },
  completed: { label: "Concluído", color: "bg-blue-100 text-blue-800" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
};

export default function AppointmentCard({ customerName, serviceName, staffName, startTime, endTime, status, onClick }) {
  const config = statusConfig[status] || statusConfig.pending;
  
  return (
    <Card 
      className="p-4 hover:shadow-md transition-shadow cursor-pointer" 
      onClick={onClick}
      data-testid={`card-appointment-${customerName.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gold-dark truncate">{customerName}</h3>
            <Badge className={config.color}>
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mb-1">{serviceName}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{staffName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{format(new Date(startTime), "HH:mm", { locale: ptBR })} - {format(new Date(endTime), "HH:mm", { locale: ptBR })}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
