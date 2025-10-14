import MetricCard from '../MetricCard';
import { DollarSign } from 'lucide-react';

export default function MetricCardExample() {
  return (
    <div className="p-4">
      <MetricCard 
        title="Faturamento Hoje"
        value="R$ 2.450,00"
        icon={DollarSign}
        iconColor="bg-chart-1/10 text-chart-1"
        trend={{ value: 12, label: "vs. ontem" }}
      />
    </div>
  );
}
