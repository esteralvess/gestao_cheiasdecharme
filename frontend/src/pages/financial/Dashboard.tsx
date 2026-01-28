import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  PieChart as PieIcon,
  Activity,
  AlertCircle,
  BarChart3
} from "lucide-react";
import { financialAPI } from "@/services/api";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend 
} from "recharts";
import { Badge } from "@/components/ui/badge";

// Componente de Seleção de Data (Reutilizável)
function DatePickerWithPresets({ date, setDate }: { date: DateRange | undefined, setDate: (d: DateRange | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal border-stone-200 bg-white h-10 shadow-sm", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4 text-[#C6A87C]" />
          {date?.from ? ( date.to ? <>{format(date.from, "dd/MM/yyyy")} - {format(date.to, "dd/MM/yyyy")}</> : format(date.from, "dd/MM/yyyy") ) : <span>Selecione o período</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar mode="range" selected={date} onSelect={setDate} numberOfMonths={2} locale={ptBR} />
      </PopoverContent>
    </Popover>
  );
}

// Formatador de Moeda
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
};

export default function FinancialDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });

  // Busca Dados do Backend
  const { data: dashboard, isLoading } = useQuery({ 
    queryKey: ['financial-dashboard', dateRange], 
    queryFn: () => financialAPI.getDashboard(
        dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
        dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
    ),
    enabled: !!dateRange?.from
  });

  // Preparar dados para o gráfico de pizza (Custos)
  const costBreakdownData = dashboard ? [
    { name: 'Custos Fixos', value: dashboard.details.expenses_fixed, color: '#ef4444' }, // Vermelho
    { name: 'Custos Variáveis', value: dashboard.details.expenses_variable, color: '#f59e0b' }, // Amarelo
    { name: 'Comissões', value: dashboard.details.commissions, color: '#3b82f6' }, // Azul
  ].filter(i => i.value > 0) : [];

  if (isLoading) return <div className="p-8 space-y-6"><Skeleton className="h-40 w-full rounded-xl"/><div className="grid grid-cols-3 gap-6"><Skeleton className="h-64 rounded-xl"/><Skeleton className="h-64 rounded-xl"/><Skeleton className="h-64 rounded-xl"/></div></div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 bg-[#FAFAF9] min-h-screen pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 flex items-center gap-3">
            <PieIcon className="w-8 h-8 text-[#C6A87C]" />
            Painel Financeiro
          </h1>
          <p className="text-stone-500 mt-1 text-sm">Visão estratégica da saúde do seu negócio.</p>
        </div>
        <div className="flex gap-3">
            <DatePickerWithPresets date={dateRange} setDate={setDateRange} />
            <Button variant="outline" className="h-10 bg-white border-stone-200"><Download className="w-4 h-4 mr-2"/> PDF</Button>
        </div>
      </div>

      {/* 1. CARTÕES DE KPI (INDICADORES CHAVE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Receita */}
        <Card className="border-stone-100 shadow-sm bg-white">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold text-stone-400 uppercase tracking-wider">Faturamento</CardTitle>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-stone-800">{formatCurrency(dashboard?.summary.revenue || 0)}</div>
                <p className="text-xs text-stone-400 mt-1">Entradas confirmadas no período</p>
            </CardContent>
        </Card>

        {/* Custos Totais */}
        <Card className="border-stone-100 shadow-sm bg-white">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold text-stone-400 uppercase tracking-wider">Custos Totais</CardTitle>
                <TrendingDown className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-stone-800">{formatCurrency(dashboard?.summary.costs || 0)}</div>
                <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] text-red-600 bg-red-50 border-none">Fixos: {formatCurrency(dashboard?.details.expenses_fixed || 0)}</Badge>
                    <Badge variant="outline" className="text-[10px] text-blue-600 bg-blue-50 border-none">Comissões: {formatCurrency(dashboard?.details.commissions || 0)}</Badge>
                </div>
            </CardContent>
        </Card>

        {/* Lucro Líquido */}
        <Card className={`border-none shadow-md ${dashboard?.summary.profit >= 0 ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold text-white/80 uppercase tracking-wider">Lucro Líquido</CardTitle>
                <DollarSign className="w-4 h-4 text-white" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black">{formatCurrency(dashboard?.summary.profit || 0)}</div>
                <p className="text-xs text-white/80 mt-1">Margem Real: <strong>{(dashboard?.indicators.profit_margin || 0).toFixed(1)}%</strong></p>
            </CardContent>
        </Card>

        {/* Ponto de Equilíbrio */}
        <Card className="border-stone-100 shadow-sm bg-white relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-5 p-4"><Target className="w-24 h-24" /></div>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-stone-400 uppercase tracking-wider">Ponto de Equilíbrio</CardTitle></CardHeader>
            <CardContent>
                <div className="flex justify-between items-end mb-2">
                    <span className="text-2xl font-bold text-stone-800">{(dashboard?.indicators.break_even_percent || 0).toFixed(0)}%</span>
                    <span className="text-xs text-stone-400">da meta fixa</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                    <div className="bg-[#C6A87C] h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.min(dashboard?.indicators.break_even_percent || 0, 100)}%` }}></div>
                </div>
                {dashboard?.summary.revenue < dashboard?.details.expenses_fixed && (
                    <p className="text-xs text-amber-600 mt-2 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3"/> Falta {formatCurrency(dashboard.details.expenses_fixed - dashboard.summary.revenue)} para pagar o fixo.
                    </p>
                )}
            </CardContent>
        </Card>
      </div>

      {/* 2. GRÁFICOS DETALHADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Gráfico de Composição de Custos */}
          <Card className="col-span-1 border-stone-100 shadow-md bg-white">
              <CardHeader>
                  <CardTitle className="text-lg font-bold text-stone-700 flex items-center gap-2"><Activity className="w-5 h-5 text-[#C6A87C]"/> Para onde vai o dinheiro?</CardTitle>
                  <CardDescription>Distribuição dos seus custos no período.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                  {costBreakdownData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie data={costBreakdownData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                  {costBreakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                              </Pie>
                              <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                              <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                      </ResponsiveContainer>
                  ) : (
                      <p className="text-stone-400 text-sm">Sem dados de despesas.</p>
                  )}
              </CardContent>
          </Card>

          {/* Gráfico de Evolução (Placeholder visual por enquanto, backend precisa enviar série histórica) */}
          <Card className="col-span-1 lg:col-span-2 border-stone-100 shadow-md bg-white">
              <CardHeader>
                  <CardTitle className="text-lg font-bold text-stone-700">Fluxo de Caixa (Previsão vs Realizado)</CardTitle>
                  <CardDescription>Acompanhe se está sobrando ou faltando dinheiro.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex flex-col justify-center items-center text-stone-400 bg-stone-50/50 rounded-xl m-6 border border-dashed border-stone-200">
                  <BarChart3 className="w-12 h-12 mb-2 opacity-20"/>
                  <p>Evolução diária em breve.</p>
                  <span className="text-xs">(Requer atualização no endpoint para enviar dados dia-a-dia)</span>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}