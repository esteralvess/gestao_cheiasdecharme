import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function Payments() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gold-dark">Financeiro</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Faturamento Hoje</p>
                <p className="text-2xl font-bold text-gold-dark mt-2">R$ 0,00</p>
              </div>
              <DollarSign className="w-10 h-10 text-gold-dark opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Faturamento Mês</p>
                <p className="text-2xl font-bold text-gold-dark mt-2">R$ 0,00</p>
              </div>
              <DollarSign className="w-10 h-10 text-gold-dark opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Comissões Pendentes</p>
                <p className="text-2xl font-bold text-gold-dark mt-2">R$ 0,00</p>
              </div>
              <DollarSign className="w-10 h-10 text-gold-dark opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sistema Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            Módulo de financeiro em desenvolvimento. 
            Em breve você poderá lançar pagamentos, visualizar relatórios detalhados e gerenciar comissões.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
