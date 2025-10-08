import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gold-dark">Relatórios</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Faturamento por Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Relatório em desenvolvimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Serviços Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Relatório em desenvolvimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Performance por Colaborador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Relatório em desenvolvimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Taxa de Comparecimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Relatório em desenvolvimento</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
