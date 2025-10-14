import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Phone } from "lucide-react";

interface CustomerRowProps {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  lastAppointmentStatus?: "confirmed" | "completed" | "cancelled" | "pending";
  onEdit?: () => void;
  onDelete?: () => void;
}

const statusConfig = {
  confirmed: { label: "Confirmado", color: "bg-chart-3/10 text-chart-3" },
  completed: { label: "Concluído", color: "bg-chart-1/10 text-chart-1" },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
  pending: { label: "Pendente", color: "bg-chart-2/10 text-chart-2" },
};

export default function CustomerRow({ 
  id, 
  name, 
  whatsapp, 
  email, 
  lastAppointmentStatus,
  onEdit, 
  onDelete 
}: CustomerRowProps) {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  
  return (
    <div 
      className="flex items-center gap-4 p-4 border-b hover:bg-muted/50 transition-colors"
      data-testid={`row-customer-${id}`}
    >
      <Avatar className="w-10 h-10">
        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{name}</p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            <span>{whatsapp}</span>
          </div>
          {email && <span className="truncate">{email}</span>}
        </div>
      </div>
      {lastAppointmentStatus && (
        <Badge className={`${statusConfig[lastAppointmentStatus].color} no-default-hover-elevate no-default-active-elevate`}>
          {statusConfig[lastAppointmentStatus].label}
        </Badge>
      )}
      <div className="flex items-center gap-2">
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onEdit}
          data-testid={`button-edit-customer-${id}`}
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onDelete}
          data-testid={`button-delete-customer-${id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
