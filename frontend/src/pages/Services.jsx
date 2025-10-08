import { useState, useEffect } from "react";
import { servicesAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await servicesAPI.getAll();
      setServices(response.data);
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (centavos) => {
    if (!centavos) return "R$ 0,00";
    const reais = centavos / 100;
    return `R$ ${reais.toFixed(2).replace('.', ',')}`;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gold-dark">Serviços</h1>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-gray-500">Carregando...</p>
        ) : services.length > 0 ? (
          services.map((service) => (
            <Card key={service.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gold-light text-gold-dark flex items-center justify-center">
                    <Scissors className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gold-dark">{service.name}</h3>
                      {service.popular && (
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">Popular</Badge>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-gold-dark">
                        {formatPrice(service.price_centavos)}
                      </span>
                      {service.default_duration_min && (
                        <span className="text-sm text-gray-500">
                          {service.default_duration_min} min
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-gray-500">Nenhum serviço cadastrado</p>
        )}
      </div>
    </div>
  );
}
