import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Search, 
  Download,
  Filter
} from "lucide-react";
import { financialAPI } from "@/services/api";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Componente DatePicker (Reutilizável)
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

export default function CashFlowPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const [searchTerm, setSearchTerm] = useState("");

  // Busca dados do endpoint unificado (CashFlowView)
  const { data: transactions = [], isLoading } = useQuery({ 
    queryKey: ['cash-flow', dateRange], 
    queryFn: () => financialAPI.getCashFlow(
        dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
        dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
    ),
    enabled: !!dateRange?.from
  });

  // Filtro local por texto
  const filteredTransactions = transactions.filter((t: any) => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cálculos de Totais na Tela
  const totalIn = filteredTransactions.filter((t: any) => t.type === 'receita').reduce((acc: number, t: any) => acc + t.amount, 0);
  const totalOut = filteredTransactions.filter((t: any) => t.type === 'despesa').reduce((acc: number, t: any) => acc + t.amount, 0); // amount já vem negativo do back? Se não, ajustar.
  // Nota: No backend eu coloquei amount * -1 para despesas. Então somamos tudo para ter o saldo.
  const balance = filteredTransactions.reduce((acc: number, t: any) => acc + t.amount, 0);

  const handleExport = () => {
    let csv = "Data,Descrição,Categoria,Tipo,Valor,Saldo Acumulado\n";
    filteredTransactions.forEach((t: any) => {
        csv += `${format(new Date(t.date), 'dd/MM/yyyy')},${t.description},${t.category},${t.type},${(t.amount/100).toFixed(2).replace('.',',')},${(t.accumulated_balance/100).toFixed(2).replace('.',',')}\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `fluxo_caixa_${format(new Date(), 'dd-MM')}.csv`;
    link.click();
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-[#FAFAF9] min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Fluxo de Caixa</h1>
          <p className="text-stone-500 text-sm">Extrato detalhado de todas as movimentações.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <DatePickerWithPresets date={dateRange} setDate={setDateRange} />
            <Button variant="outline" className="bg-white" onClick={handleExport}><Download className="w-4 h-4 mr-2"/> Exportar</Button>
        </div>
      </div>

      {/* RESUMO RÁPIDO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-emerald-100 bg-emerald-50/50 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                  <div>
                      <p className="text-xs font-bold text-emerald-600 uppercase">Entradas</p>
                      <span className="text-xl font-bold text-emerald-700">R$ {(totalIn/100).toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-emerald-100 rounded-full"><ArrowUpCircle className="w-6 h-6 text-emerald-600"/></div>
              </CardContent>
          </Card>
          <Card className="border-red-100 bg-red-50/50 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                  <div>
                      <p className="text-xs font-bold text-red-600 uppercase">Saídas</p>
                      <span className="text-xl font-bold text-red-700">R$ {(Math.abs(totalOut)/100).toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-red-100 rounded-full"><ArrowDownCircle className="w-6 h-6 text-red-600"/></div>
              </CardContent>
          </Card>
          <Card className="border-stone-200 bg-white shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                  <div>
                      <p className="text-xs font-bold text-stone-500 uppercase">Saldo do Período</p>
                      <span className={`text-xl font-bold ${balance >= 0 ? 'text-stone-800' : 'text-red-600'}`}>R$ {(balance/100).toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-stone-100 rounded-full"><Filter className="w-6 h-6 text-stone-500"/></div>
              </CardContent>
          </Card>
      </div>

      {/* TABELA */}
      <Card className="border-stone-100 shadow-md bg-white">
          <div className="p-4 border-b border-stone-50 flex items-center gap-2">
              <Search className="w-4 h-4 text-stone-400" />
              <Input 
                placeholder="Buscar por descrição ou categoria..." 
                className="max-w-sm border-none bg-transparent h-8 focus-visible:ring-0 px-0"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          <div className="rounded-md">
            <Table>
                <TableHeader className="bg-stone-50/50">
                    <TableRow>
                        <TableHead className="w-[120px]">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Saldo Acumulado</TableHead>
                        <TableHead className="w-[100px] text-center">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-40"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-10"/></TableCell></TableRow>
                        ))
                    ) : filteredTransactions.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-stone-400">Nenhuma movimentação encontrada.</TableCell></TableRow>
                    ) : (
                        filteredTransactions.map((t: any) => (
                            <TableRow key={t.id} className="hover:bg-stone-50/50">
                                <TableCell className="font-medium text-stone-600">{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="font-medium text-stone-800">{t.description}</TableCell>
                                <TableCell><Badge variant="outline" className="font-normal text-stone-500 border-stone-200">{t.category}</Badge></TableCell>
                                <TableCell className={`text-right font-bold ${t.type === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {t.type === 'receita' ? '+' : ''} R$ {(t.amount / 100).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right text-stone-500">
                                    R$ {(t.accumulated_balance / 100).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">
                                    {t.status === 'realizado' ? 
                                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-none shadow-none text-[10px]">Realizado</Badge> : 
                                        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none shadow-none text-[10px]">Previsto</Badge>
                                    }
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
          </div>
      </Card>
    </div>
  );
}