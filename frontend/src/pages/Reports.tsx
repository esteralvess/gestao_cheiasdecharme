import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { reportsAPI } from "@/services/api";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";


// --- Tipos de Dados ---
interface RevenueData {
    name: string;
    value: number; // Faturamento em centavos
    appointments?: number;
}
interface RevenueByServiceData {
    name: string;
    category: string;
    value: number;
    count: number;
}

// --- Componente de Carregamento ---
function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center h-full min-h-[250px]">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
    );
}

export default function Reports() {
  const [period, setPeriod] = useState("month");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
      const today = new Date();
      switch (period) {
          case 'week': return { startDate: format(startOfWeek(today), 'yyyy-MM-dd'), endDate: format(endOfWeek(today), 'yyyy-MM-dd') };
          case 'year': return { startDate: format(startOfYear(today), 'yyyy-MM-dd'), endDate: format(endOfYear(today), 'yyyy-MM-dd') };
          default: return { startDate: format(startOfMonth(today), 'yyyy-MM-dd'), endDate: format(endOfMonth(today), 'yyyy-MM-dd') };
      }
  }, [period]);

  // --- Chamadas de Dados Reais ---
  const { data: revenueByStaff = [], isLoading: isLoadingRevenueByStaff } = useQuery<RevenueData[]>({ queryKey: ['report', 'revenueByStaff', period], queryFn: () => reportsAPI.getRevenueByStaff(startDate, endDate) });
  const { data: revenueByLocation = [], isLoading: isLoadingRevenueByLocation } = useQuery<RevenueData[]>({ queryKey: ['report', 'revenueByLocation', period], queryFn: () => reportsAPI.getRevenueByLocation(startDate, endDate) });
  const { data: revenueByService = [], isLoading: isLoadingRevenueByService } = useQuery<RevenueByServiceData[]>({ queryKey: ['report', 'revenueByService', period], queryFn: () => reportsAPI.getRevenueByService(startDate, endDate) });

  // Agrega os dados por categoria para o gráfico de pizza
  const revenueByCategory = useMemo(() => {
    if (!revenueByService) return [];
    const categoryMap = revenueByService.reduce((acc, service) => {
        const currentTotal = acc.get(service.category) || 0;
        acc.set(service.category, currentTotal + service.value);
        return acc;
    }, new Map<string, number>());
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  }, [revenueByService]);

  // Filtra os serviços para a tabela com base na categoria selecionada
  const filteredServicesForTable = useMemo(() => {
    if (!revenueByService) return [];
    if (!selectedCategory) return revenueByService; // Se nada selecionado, mostra todos
    return revenueByService.filter(service => service.category === selectedCategory);
  }, [revenueByService, selectedCategory]);

  const isLoading = isLoadingRevenueByStaff || isLoadingRevenueByLocation || isLoadingRevenueByService;
  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-3))", "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  // Mocks restantes
  const mockAttendanceData = [{ month: "Set", attendance: 95, cancellation: 5 }, { month: "Out", attendance: 98, cancellation: 2 }];
  const mockTopCustomers = [{ name: "Maria Silva", visits: 24, spent: 186000, status: "fidelizado" }];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Relatórios</h1>
          <p className="text-muted-foreground">Análise de desempenho e insights</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40" data-testid="select-period"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="year">Este Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {isLoading ? (
            <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </>
        ) : (
            <>
                <Card className="p-6"><div className="flex items-center gap-3"><div><p className="text-sm text-muted-foreground">Faturamento</p><p className="text-2xl font-bold text-foreground">R$ 45.280</p></div></div></Card>
                <Card className="p-6"><div className="flex items-center gap-3"><div><p className="text-sm text-muted-foreground">Comparecimento</p><p className="text-2xl font-bold text-foreground">95%</p></div></div></Card>
                <Card className="p-6"><div className="flex items-center gap-3"><div><p className="text-sm text-muted-foreground">Cancelamento</p><p className="text-2xl font-bold text-foreground">5%</p></div></div></Card>
                <Card className="p-6"><div className="flex items-center gap-3"><div><p className="text-sm text-muted-foreground">Clientes Ativos</p><p className="text-2xl font-bold text-foreground">247</p></div></div></Card>
            </>
        )}
      </div>

      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="revenue">Faturamento</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="attendance">Comparecimento</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 flex flex-col h-[400px]">
              <h2 className="text-lg font-semibold text-foreground mb-4">Faturamento por Unidade</h2>
              {isLoadingRevenueByLocation ? <LoadingSpinner /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByLocation.map(d => ({...d, value: d.value / 100}))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`}/>
                        <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                        <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-6 flex flex-col h-[400px]">
              <h2 className="text-lg font-semibold text-foreground mb-4">Faturamento por Profissional</h2>
              {isLoadingRevenueByStaff ? <LoadingSpinner /> : (
                  <div className="space-y-3 overflow-y-auto h-full pr-2">
                    {revenueByStaff.map((staff, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">{staff.name}</p>
                          <p className="text-sm text-muted-foreground">{staff.appointments} agendamentos</p>
                        </div>
                        <p className="text-lg font-semibold text-primary">R$ {(staff.value / 100).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
              )}
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="services" className="space-y-6">
            <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Faturamento por Categoria de Serviço</h2>
                {isLoadingRevenueByService ? <LoadingSpinner /> : (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie 
                                data={revenueByCategory} 
                                labelLine={false} 
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} 
                                outerRadius={100} 
                                dataKey="value"
                                onClick={(data) => setSelectedCategory(data.name === selectedCategory ? null : data.name)}
                            >
                                {revenueByCategory.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={COLORS[index % COLORS.length]} 
                                        className="cursor-pointer"
                                        stroke={entry.name === selectedCategory ? 'hsl(var(--foreground))' : ''}
                                        strokeWidth={2}
                                    />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `R$ ${(value / 100).toFixed(2)}`} />
                            <Legend onClick={(data) => setSelectedCategory(data.value === selectedCategory ? null : data.value)} className="cursor-pointer"/>
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>
                        {selectedCategory ? `Detalhes dos Serviços: ${selectedCategory}` : 'Todos os Serviços'}
                    </CardTitle>
                    {selectedCategory && <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)}>Limpar seleção</Button>}
                </CardHeader>
                <CardContent>
                    {isLoadingRevenueByService ? <LoadingSpinner /> : (
                        <Table>
                            <TableHeader><TableRow><TableHead>Serviço</TableHead><TableHead>Categoria</TableHead><TableHead className="text-center">Quantidade</TableHead><TableHead className="text-right">Faturamento</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filteredServicesForTable.map(service => (
                                    <TableRow key={service.name}>
                                        <TableCell className="font-medium">{service.name}</TableCell>
                                        <TableCell>{service.category}</TableCell>
                                        <TableCell className="text-center">{service.count}</TableCell>
                                        <TableCell className="text-right font-semibold">R$ {(service.value / 100).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="customers">
            <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Clientes Mais Frequentes</h2>
                <div className="space-y-3">
                    {mockTopCustomers.map((customer, idx) => (
                        <div key={idx} className="p-4 bg-muted/30 rounded-lg">
                            <div className="flex items-start justify-between">
                                <p className="font-semibold">{customer.name}</p>
                                <p className="text-xl font-bold text-primary">R$ {(customer.spent / 100).toFixed(2)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </TabsContent>
        <TabsContent value="attendance">
            <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Taxa de Comparecimento vs Cancelamento</h2>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={mockAttendanceData}>
                        <CartesianGrid />
                        <XAxis dataKey="month" />
                        <YAxis domain={[0, 100]}/>
                        <Tooltip formatter={(value: number) => [`${value}%`, ""]}/>
                        <Legend />
                        <Line type="monotone" dataKey="attendance" stroke="hsl(var(--chart-1))" name="Comparecimento"/>
                        <Line type="monotone" dataKey="cancellation" stroke="hsl(var(--destructive))" name="Cancelamento"/>
                    </LineChart>
                </ResponsiveContainer>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}