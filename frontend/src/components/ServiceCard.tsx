import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign } from "lucide-react";

interface ServiceCardProps {
  name: string;
  category: string;
  description?: string;
  duration: number;
  price: number;
  popular?: boolean;
  imageUrl?: string;
  onClick?: () => void;
}

export default function ServiceCard({ 
  name, 
  category, 
  description, 
  duration, 
  price, 
  popular = false,
  imageUrl,
  onClick 
}: ServiceCardProps) {
  return (
    <Card 
      className="overflow-hidden hover-elevate cursor-pointer group" 
      onClick={onClick}
      data-testid={`card-service-${name.toLowerCase().replace(/\s/g, '-')}`}
    >
      {imageUrl && (
        <div className="relative h-40 bg-muted overflow-hidden">
          <img 
            src={imageUrl} 
            alt={name} 
            className="w-full h-full object-cover"
          />
          {popular && (
            <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">
              Popular
            </Badge>
          )}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>
            <p className="text-sm text-muted-foreground">{category}</p>
          </div>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{description}</p>
        )}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{duration} min</span>
          </div>
          <div className="flex items-center gap-1 text-primary font-semibold">
            <DollarSign className="w-4 h-4" />
            <span>R$ {(price / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
