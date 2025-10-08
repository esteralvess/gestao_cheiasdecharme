import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Phone } from "lucide-react";

const statusConfig = {
  confirmed: { label: "Confirmado", color: "bg-green-100 text-green-800" },
  completed: { label: "Concluído", color: "bg-blue-100 text-blue-800" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
};

export default function CustomerRow({ 
  id, 
  name, 
  whatsapp, 
  email, 
  lastAppointmentStatus,
  onEdit, 
  onDelete 
}) {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  
  return (
    <div 
      className="flex items-center gap-4 p-4 border-b hover:bg-beige-light transition-colors"
      data-testid={`row-customer-${id}`}
    >
      <Avatar className="w-10 h-10">
        <AvatarFallback className="bg-gold-light text-gold-dark font-semibold text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gold-dark truncate">{name}</p>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            <span>{whatsapp}</span>
          </div>
          {email && <span className="truncate">{email}</span>}
        </div>
      </div>
      {lastAppointmentStatus && (
        <Badge className={statusConfig[lastAppointmentStatus]?.color || statusConfig.pending.color}>
          {statusConfig[lastAppointmentStatus]?.label || statusConfig.pending.label}
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
