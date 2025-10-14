import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

interface StaffCardProps {
  name: string;
  role?: string;
  active: boolean;
  services?: string[];
  location?: string;
  onClick?: () => void;
}

export default function StaffCard({ name, role, active, services = [], location, onClick }: StaffCardProps) {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  
  return (
    <Card 
      className="p-4 hover-elevate cursor-pointer" 
      onClick={onClick}
      data-testid={`card-staff-${name.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-start gap-4">
        <Avatar className="w-12 h-12">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>
            <Badge 
              className={`${active ? 'bg-chart-1/10 text-chart-1' : 'bg-muted text-muted-foreground'} no-default-hover-elevate no-default-active-elevate`}
            >
              {active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          {role && <p className="text-sm text-muted-foreground mb-2">{role}</p>}
          {location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="w-4 h-4" />
              <span>{location}</span>
            </div>
          )}
          {services.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {services.slice(0, 3).map((service, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="text-xs no-default-hover-elevate no-default-active-elevate"
                >
                  {service}
                </Badge>
              ))}
              {services.length > 3 && (
                <Badge 
                  variant="outline" 
                  className="text-xs no-default-hover-elevate no-default-active-elevate"
                >
                  +{services.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
