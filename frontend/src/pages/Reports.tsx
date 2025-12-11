import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, CardHeader, CardTitle, CardContent 
} from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, 
  TrendingUp, 
  Users, 
  AlertCircle, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Scissors, 
  Target 
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from "recharts";
import { appointmentsAPI, servicesAPI, staffAPI, locationsAPI, customersAPI } from "@/services/api";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// --- Componente de Carregamento ---
function LoadingSpinner() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-stone-400">
            <Loader2 className="w-8 h-8 text-[#C6A87C] animate-spin mb-2" />
            <p className="text-sm">Processando dados...</p>
        </div>
    );
}

export default function Reports() {
  const [period, setPeriod] = useState("month");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // ✅ NOVO: Estado para controlar a navegação das abas
  const [activeTab, setActiveTab] = useState("revenue");

  // 1. Definição do Período de Data
  const dateInterval = useMemo(() => {
      const today = new Date();
      switch (period) {
          case 'week': return { start: startOfWeek(today), end: endOfWeek(today) };
          case 'year': return { start: startOfYear(today), end: endOfYear(today) };
          default: return { start: startOfMonth(today), end: endOfMonth(today) };
      }
  }, [period]);

  // 2. Buscando TODOS os dados brutos do Banco de Dados
  const { data: appointments = [], isLoading: loadingApps } = useQuery({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll });
  const { data: services = [], isLoading: loadingServices } = useQuery({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: staffList = [], isLoading: loadingStaff } = useQuery({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: locations = [], isLoading: loadingLocs } = useQuery({ queryKey: ['locations'], queryFn: locationsAPI.getAll });
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({ queryKey: ['customers'], queryFn: customersAPI.getAll });

  const isLoading = loadingApps || loadingServices || loadingStaff || loadingLocs || loadingCustomers;

  // 3. Processamento dos Dados (CÁLCULOS REAIS)
  const reportData = useMemo(() => {
    if (isLoading) return null;

    // Filtra agendamentos dentro do período selecionado
    const filteredAppointments = appointments.filter((app: any) => {
        const appDate = parseISO(app.start_time);
        return isWithinInterval(appDate, dateInterval);
    });

    const completedAppointments = filteredAppointments.filter((app: any) => app.status === 'completed');
    const cancelledAppointments = filteredAppointments.filter((app: any) => app.status === 'cancelled');

    // --- KPI: Totais ---
    const totalRevenue = completedAppointments.reduce((acc: number, app: any) => acc + (app.final_amount_centavos || 0), 0);
    const attendanceRate = filteredAppointments.length > 0 
        ? (completedAppointments.length / filteredAppointments.length) * 100 
        : 0;
    const cancellationRate = filteredAppointments.length > 0 
        ? (cancelledAppointments.length / filteredAppointments.length) * 100 
        : 0;
    const uniqueActiveCustomers = new Set(completedAppointments.map((app: any) => app.customer)).size;

    // --- GRÁFICO 1: Faturamento por Unidade ---
    const revenueByLocationMap = new Map();
    completedAppointments.forEach((app: any) => {
        const locName = locations.find((l: any) => l.id === app.location)?.name || 'Desconhecida';
        const val = app.final_amount_centavos || 0;
        revenueByLocationMap.set(locName, (revenueByLocationMap.get(locName) || 0) + val);
    });
    const revenueByLocation = Array.from(revenueByLocationMap.entries()).map(([name, value]) => ({ name, value: value / 100 }));

    // --- GRÁFICO 2: Faturamento por Profissional ---
    const revenueByStaffMap = new Map();
    const appointmentsByStaffMap = new Map();
    completedAppointments.forEach((app: any) => {
        const staffName = staffList.find((s: any) => s.id === app.staff)?.name || 'Desconhecido';
        const val = app.final_amount_centavos || 0;
        revenueByStaffMap.set(staffName, (revenueByStaffMap.get(staffName) || 0) + val);
        appointmentsByStaffMap.set(staffName, (appointmentsByStaffMap.get(staffName) || 0) + 1);
    });
    const revenueByStaff = Array.from(revenueByStaffMap.entries())
        .map(([name, value]) => ({ name, value: value / 100, appointments: appointmentsByStaffMap.get(name) }))
        .sort((a, b) => b.value - a.value);

    // --- GRÁFICO 3: Serviços e Categorias ---
    const revenueByServiceMap = new Map();
    completedAppointments.forEach((app: any) => {
        const service = services.find((s: any) => s.id === app.service);
        const sName = service?.name || 'Serviço Excluído';
        const sCat = service?.category || 'Geral';
        const val = app.final_amount_centavos || 0;
        
        if (!revenueByServiceMap.has(sName)) {
            revenueByServiceMap.set(sName, { category: sCat, value: 0, count: 0 });
        }
        const current = revenueByServiceMap.get(sName);
        current.value += val;
        current.count += 1;
    });

    const revenueByService = Array.from(revenueByServiceMap.entries()).map(([name, data]: any) => ({
        name,
        category: data.category,
        value: data.value,
        count: data.count
    }));

    const revenueByCategoryMap = new Map();
    revenueByService.forEach((item: any) => {
        revenueByCategoryMap.set(item.category, (revenueByCategoryMap.get(item.category) || 0) + item.value);
    });
    const revenueByCategory = Array.from(revenueByCategoryMap.entries())
        .map(([name, value]: any) => ({ name, value: value / 100 }))
        .sort((a, b) => b.value - a.value);

    // --- GRÁFICO 4: Clientes VIP (Top Spenders) ---
    const allCompletedApps = appointments.filter((a: any) => a.status === 'completed');
    const customerStatsMap = new Map();
    
    allCompletedApps.forEach((app: any) => {
        if (!customerStatsMap.has(app.customer)) {
            const customerData = customers.find((c: any) => c.id === app.customer);
            customerStatsMap.set(app.customer, { 
                name: app.customer_name || customerData?.full_name || 'Anônimo',
                visits: 0, 
                spent: 0,
                last_visit: app.start_time
            });
        }
        const current = customerStatsMap.get(app.customer);
        current.visits += 1;
        current.spent += (app.final_amount_centavos || 0);
        if (new Date(app.start_time) > new Date(current.last_visit)) {
            current.last_visit = app.start_time;
        }
    });
    const topCustomers = Array.from(customerStatsMap.values())
        .sort((a: any, b: any) => b.spent - a.spent)
        .slice(0, 10);

    // --- GRÁFICO 5: Evolução de Comparecimento ---
    const sixMonthsAgo = subMonths(new Date(), 5);
    const monthlyStatsMap = new Map();
    
    for (let i = 0; i < 6; i++) {
        const d = subMonths(new Date(), i);
        const key = format(d, 'MMM', { locale: ptBR });
        monthlyStatsMap.set(key, { month: key, total: 0, completed: 0, cancelled: 0, sort: d.getTime() });
    }

    appointments.forEach((app: any) => {
        const appDate = parseISO(app.start_time);
        if (appDate >= sixMonthsAgo) {
            const key = format(appDate, 'MMM', { locale: ptBR });
            if (monthlyStatsMap.has(key)) {
                const stat = monthlyStatsMap.get(key);
                stat.total++;
                if (app.status === 'completed') stat.completed++;
                if (app.status === 'cancelled') stat.cancelled++;
            }
        }
    });

    const attendanceData = Array.from(monthlyStatsMap.values())
        .sort((a: any, b: any) => a.sort - b.sort)
        .map((stat: any) => ({
            month: stat.month,
            attendance: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
            cancellation: stat.total > 0 ? Math.round((stat.cancelled / stat.total) * 100) : 0
        }));

    return {
        totalRevenue,
        attendanceRate,
        cancellationRate,
        uniqueActiveCustomers,
        revenueByLocation,
        revenueByStaff,
        revenueByService,
        revenueByCategory,
        topCustomers,
        attendanceData
    };

  }, [appointments, services, staffList, locations, customers, dateInterval, isLoading]);

  // Filtro de tabela de serviços
  const filteredServicesForTable = useMemo(() => {
    if (!reportData?.revenueByService) return [];
    let list = [...reportData.revenueByService];
    if (selectedCategory) {
        list = list.filter((s: any) => s.category === selectedCategory);
    }
    return list.sort((a: any, b: any) => b.value - a.value);
  }, [reportData, selectedCategory]);

  const COLORS = ["#C6A87C", "#374151", "#9CA3AF", "#F59E0B", "#10B981", "#EF4444"];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <BarChart3 className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Relatórios
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">
            Análise de desempenho e insights estratégicos.
          </p>
        </div>
        
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40 bg-white dark:bg-stone-900 border-stone-200 shadow-sm rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="year">Este Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* CARDS DE KPI (TOPO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !reportData ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : (
            <>
                <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp className="w-6 h-6" /></div>
                            <div>
                                <p className="text-xs font-semibold text-stone-400 uppercase">Faturamento</p>
                                <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">
                                    R$ {(reportData.totalRevenue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users className="w-6 h-6" /></div>
                            <div>
                                <p className="text-xs font-semibold text-stone-400 uppercase">Comparecimento</p>
                                <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">
                                    {reportData.attendanceRate.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 w-full bg-stone-100 rounded-full h-1.5 dark:bg-stone-800">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${reportData.attendanceRate}%` }}></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 rounded-lg text-red-600"><AlertCircle className="w-6 h-6" /></div>
                            <div>
                                <p className="text-xs font-semibold text-stone-400 uppercase">Cancelamentos</p>
                                <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">
                                    {reportData.cancellationRate.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#C6A87C]/10 rounded-lg text-[#C6A87C]"><PieChartIcon className="w-6 h-6" /></div>
                            <div>
                                <p className="text-xs font-semibold text-stone-400 uppercase">Clientes Ativos</p>
                                <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">
                                    {reportData.uniqueActiveCustomers}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-stone-400 mt-4">Com visita no período</p>
                    </CardContent>
                </Card>
            </>
        )}
      </div>

      {/* ✅ MENU DE NAVEGAÇÃO "CLEAN" (Botões Pílula) */}
      <div className="flex flex-col sm:flex-row gap-2 border-b border-stone-200 dark:border-stone-800 pb-2 overflow-x-auto">
         <Button 
            variant={activeTab === 'revenue' ? 'secondary' : 'ghost'} 
            onClick={() => setActiveTab('revenue')} 
            className={`rounded-full px-5 text-sm ${activeTab === 'revenue' ? 'bg-[#C6A87C]/10 text-[#C6A87C] hover:bg-[#C6A87C]/20' : 'text-stone-500 hover:text-stone-700'}`}
         >
            <BarChart3 className="w-4 h-4 mr-2" /> Faturamento
         </Button>
         <Button 
            variant={activeTab === 'services' ? 'secondary' : 'ghost'} 
            onClick={() => setActiveTab('services')} 
            className={`rounded-full px-5 text-sm ${activeTab === 'services' ? 'bg-[#C6A87C]/10 text-[#C6A87C] hover:bg-[#C6A87C]/20' : 'text-stone-500 hover:text-stone-700'}`}
         >
            <Scissors className="w-4 h-4 mr-2" /> Serviços
         </Button>
         <Button 
            variant={activeTab === 'customers' ? 'secondary' : 'ghost'} 
            onClick={() => setActiveTab('customers')} 
            className={`rounded-full px-5 text-sm ${activeTab === 'customers' ? 'bg-[#C6A87C]/10 text-[#C6A87C] hover:bg-[#C6A87C]/20' : 'text-stone-500 hover:text-stone-700'}`}
         >
            <Users className="w-4 h-4 mr-2" /> Clientes
         </Button>
         <Button 
            variant={activeTab === 'attendance' ? 'secondary' : 'ghost'} 
            onClick={() => setActiveTab('attendance')} 
            className={`rounded-full px-5 text-sm ${activeTab === 'attendance' ? 'bg-[#C6A87C]/10 text-[#C6A87C] hover:bg-[#C6A87C]/20' : 'text-stone-500 hover:text-stone-700'}`}
         >
            <Target className="w-4 h-4 mr-2" /> Performance
         </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        
        {/* 1. FATURAMENTO */}
        <TabsContent value="revenue" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900 h-[450px]">
              <CardHeader><CardTitle className="text-lg text-stone-700">Faturamento por Unidade</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                {isLoading || !reportData ? <LoadingSpinner /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.revenueByLocation} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#78716c', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            cursor={{ fill: '#f5f5f4' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]} 
                          />
                          <Bar dataKey="value" fill="#C6A87C" radius={[0, 4, 4, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900 h-[450px]">
              <CardHeader><CardTitle className="text-lg text-stone-700">Top Profissionais (Receita)</CardTitle></CardHeader>
              <CardContent className="h-[350px] overflow-y-auto pr-2">
                {isLoading || !reportData ? <LoadingSpinner /> : (
                    <div className="space-y-4">
                      {reportData.revenueByStaff.map((staff: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-800">
                          <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-white text-stone-500 shadow-sm'}`}>
                                {idx + 1}º
                             </div>
                             <div>
                                <p className="font-bold text-stone-700 dark:text-stone-200 text-sm">{staff.name}</p>
                                <p className="text-xs text-stone-400">{staff.appointments} atendimentos</p>
                             </div>
                          </div>
                          <p className="text-sm font-bold text-[#C6A87C]">R$ {staff.value.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* 2. SERVIÇOS */}
        <TabsContent value="services" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
                    <CardHeader><CardTitle className="text-lg text-stone-700">Categorias Mais Rentáveis</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        {isLoading || !reportData ? <LoadingSpinner /> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={reportData.revenueByCategory} 
                                        innerRadius={60}
                                        outerRadius={80} 
                                        paddingAngle={5}
                                        dataKey="value"
                                        onClick={(data) => setSelectedCategory(data.name === selectedCategory ? null : data.name)}
                                        cursor="pointer"
                                    >
                                        {reportData.revenueByCategory.map((entry: any, index: number) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={COLORS[index % COLORS.length]} 
                                                stroke={entry.name === selectedCategory ? '#000' : ''}
                                                strokeWidth={entry.name === selectedCategory ? 2 : 0}
                                                opacity={selectedCategory && entry.name !== selectedCategory ? 0.3 : 1}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36} 
                                        iconType="circle"
                                        onClick={(data) => setSelectedCategory(data.value === selectedCategory ? null : data.value)}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg text-stone-700">
                            {selectedCategory ? `Serviços de ${selectedCategory}` : 'Top Serviços por Receita'}
                        </CardTitle>
                        {selectedCategory && (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)} className="text-stone-400 hover:text-stone-600 h-8 text-xs">
                                Limpar filtro
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <LoadingSpinner /> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[300px]">Serviço</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead className="text-center">Qtd.</TableHead>
                                            <TableHead className="text-right">Receita Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredServicesForTable.slice(0, 10).map((service: any, idx: number) => (
                                            <TableRow key={idx} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                                                <TableCell className="font-medium text-stone-700 dark:text-stone-200">{service.name}</TableCell>
                                                <TableCell><Badge variant="secondary" className="bg-stone-100 text-stone-600 hover:bg-stone-200 border-0">{service.category}</Badge></TableCell>
                                                <TableCell className="text-center font-bold text-stone-500">{service.count}</TableCell>
                                                <TableCell className="text-right font-bold text-[#C6A87C]">R$ {(service.value / 100).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        {/* 3. CLIENTES VIP */}
        <TabsContent value="customers" className="animate-in fade-in slide-in-from-bottom-2">
            <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
                <CardHeader><CardTitle className="text-lg text-stone-700">Clientes VIP (Top Spend)</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Cliente</TableHead>
                                <TableHead className="text-center">Visitas</TableHead>
                                <TableHead className="text-center">Última Visita</TableHead>
                                <TableHead className="text-right">Total Investido</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData?.topCustomers.map((customer: any, idx: number) => (
                                <TableRow key={idx} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                                    <TableCell className="font-bold text-stone-700 dark:text-stone-200">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-[#C6A87C]/10 text-[#C6A87C] rounded-full flex items-center justify-center text-xs font-bold">
                                                {customer.name.charAt(0)}
                                            </div>
                                            {customer.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">{customer.visits}</TableCell>
                                    <TableCell className="text-center text-stone-400 text-xs">{format(new Date(customer.last_visit), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="text-right font-bold text-[#C6A87C]">R$ {(customer.spent / 100).toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        {/* 4. PERFORMANCE */}
        <TabsContent value="attendance" className="animate-in fade-in slide-in-from-bottom-2">
            <Card className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900 p-6">
                <CardHeader className="px-0 pt-0"><CardTitle className="text-lg text-stone-700">Evolução de Comparecimento</CardTitle></CardHeader>
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={reportData?.attendanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip 
                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                             formatter={(value: number) => [`${value}%`, ""]}
                        />
                        <Legend iconType="circle" />
                        <Line type="monotone" dataKey="attendance" stroke="#10B981" strokeWidth={3} name="Comparecimento" dot={{r: 4, fill: "#10B981"}} activeDot={{r: 6}} />
                        <Line type="monotone" dataKey="cancellation" stroke="#EF4444" strokeWidth={3} name="Cancelamento" dot={{r: 4, fill: "#EF4444"}} />
                    </LineChart>
                </ResponsiveContainer>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}