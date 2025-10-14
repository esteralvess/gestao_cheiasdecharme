import { Card } from "@/components/ui/card";
import { MapPin, Clock, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationCardProps {
  name: string;
  address: string;
  businessHours?: string;
  onClick?: () => void;
  onEdit?: () => void;
}

export default function LocationCard({ name, address, businessHours, onClick, onEdit }: LocationCardProps) {
  return (
    <Card 
      className="p-6 hover-elevate cursor-pointer" 
      onClick={onClick}
      data-testid={`card-location-${name.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-foreground mb-3">{name}</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="flex-1">{address}</span>
            </div>
            {businessHours && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>{businessHours}</span>
              </div>
            )}
          </div>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          data-testid={`button-edit-location-${name.toLowerCase().replace(/\s/g, '-')}`}
        >
          <Edit className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
