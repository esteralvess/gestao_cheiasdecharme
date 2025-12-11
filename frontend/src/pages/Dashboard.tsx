import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  ArrowUpRight, 
  MapPin, 
  Clock,
  Briefcase,
  Receipt
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { appointmentsAPI, customersAPI, locationsAPI } from "@/services/api";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO, isToday, subDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

// --- COMPONENTES VISUAIS ---

// Cartão de Métrica
function StatCard({ title, value, subtext, icon: Icon, trend, onClick }: any) {
  return (
    <Card 
      onClick={onClick}
      className={`border-stone-100 shadow-sm transition-all duration-200 dark:bg-stone-900 dark:border-stone-800 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-[#C6A87C]/50 active:scale-[0.98]' : ''}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{title}</p>
          <div className="h-8 w-8 bg-[#C6A87C]/10 rounded-full flex items-center justify-center">
             <Icon className="h-4 w-4 text-[#C6A87C]" />
          </div>
        </div>
        <div className="flex flex-col mt-2">
          <div className="text-2xl font-bold text-stone-800 dark:text-stone-100">{value}</div>
          <p className="text-xs text-stone-400 mt-1 flex items-center gap-1 dark:text-stone-500">
            {trend && <TrendingUp className="w-3 h-3 text-emerald-500" />}
            {subtext}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Cartão de Agendamento (Agenda de Hoje)
function AppointmentItem({ appointment, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className="group flex items-center gap-4 p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer border border-transparent hover:border-stone-100 dark:hover:border-stone-700"
    >
      <div className="flex flex-col items-center justify-center min-w-[3.5rem] h-14 bg-stone-100 rounded-lg group-hover:bg-[#C6A87C]/10 group-hover:text-[#C6A87C] transition-colors dark:bg-stone-800 dark:text-stone-300">
        <span className="text-sm font-bold">{format(appointment.startTime, 'HH:mm')}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-800 truncate dark:text-stone-200">{appointment.customerName}</p>
        <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5 dark:text-stone-400">
          <span className="truncate">{appointment.serviceName}</span>
          <span className="w-1 h-1 bg-stone-300 rounded-full dark:bg-stone-600"></span>
          <span className="truncate">{appointment.staffName}</span>
        </div>
      </div>

      <div className="text-stone-300 group-hover:text-[#C6A87C] dark:text-stone-600">
         <ArrowUpRight className="w-4 h-4" />
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  
  // Estado para o Modal de Detalhes
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsType, setDetailsType] = useState<'revenue' | 'appointments' | 'ticket' | null>(null);

  const isMobile = window.innerWidth < 768;

  // 1. Buscando Dados
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => apiRequest("GET", "/users/me/").then(res => res.json()) });
  const { data: appointments = [] } = useQuery<any[]>({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll });
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ['customers'], queryFn: customersAPI.getAll });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });

  // 3. Processamento dos Dados
  const dashboardData = useMemo(() => {
    // Filtra agendamentos pela unidade selecionada
    const filteredAppointments = selectedLocation === "all" 
      ? appointments 
      : appointments.filter((a: any) => a.location === selectedLocation || a.location_id === selectedLocation);

    // Calcula faturamento
    const revenue = filteredAppointments.reduce((acc: number, curr: any) => {
        const val = curr.final_amount_centavos || (curr.service_price || 0); 
        return acc + val;
    }, 0);

    const appointmentsCount = filteredAppointments.length;
    
    // Novo KPI: Ticket Médio
    const averageTicket = appointmentsCount > 0 ? revenue / appointmentsCount : 0;

    // Agenda de Hoje
    const todayApps = filteredAppointments
      .filter((app: any) => isToday(parseISO(app.start_time)))
      .map((app: any) => ({
        id: app.id,
        customerName: app.customer_name || "Cliente",
        serviceName: app.service_name || "Serviço",
        staffName: app.staff_name || "Profissional",
        startTime: parseISO(app.start_time),
      }))
      .sort((a: any, b: any) => a.startTime.getTime() - b.startTime.getTime());

    // Dados do Gráfico
    const last7Days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });

    const chartData = last7Days.map(day => {
      const dayApps = filteredAppointments.filter((app: any) => {
        const appDate = parseISO(app.start_time);
        return format(appDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      const dayRevenue = dayApps.reduce((acc: number, curr: any) => acc + (curr.final_amount_centavos || 0), 0);
      return { name: format(day, 'dd/MM', { locale: ptBR }), value: dayRevenue / 100 };
    });

    return {
      revenue,
      appointmentsCount,
      averageTicket,
      todayApps,
      chartData,
      filteredAppointments // Lista filtrada para o modal
    };
  }, [appointments, customers, selectedLocation]);

  // Função para abrir o modal
  const handleOpenDetails = (type: 'revenue' | 'appointments' | 'ticket') => {
      setDetailsType(type);
      setDetailsModalOpen(true);
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const displayName = user?.first_name || user?.username || "Alessandra";
  const axisColor = "#A1A1AA";
  const gridColor = "#E5E7EB40";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 bg-stone-50/30 dark:bg-stone-950 min-h-screen">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-800 tracking-tight dark:text-stone-100">
            {greeting}, <span>{displayName}</span>!
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Resumo do salão para hoje, {format(new Date(), "d 'de' MMMM", { locale: ptBR })}.
          </p>
        </div>

        {/* Filtro de Unidade */}
        <div className="w-full md:w-auto flex items-center gap-2">
            <div className="bg-white dark:bg-stone-900 p-1 rounded-xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center w-full md:w-auto">
                <MapPin className="w-4 h-4 text-stone-400 ml-2" />
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="w-full md:w-[180px] border-0 focus:ring-0 text-stone-600 dark:text-stone-300 bg-transparent h-9 text-xs font-medium uppercase tracking-wide">
                        <SelectValue placeholder="Todas as Unidades" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as Unidades</SelectItem>
                        {locations.map((loc: any) => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <Button onClick={() => setLocation("/appointments")} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white hidden md:flex rounded-xl shadow-md shadow-[#C6A87C]/20">
                Ver Agenda
            </Button>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Faturamento (Total)" 
          value={(dashboardData.revenue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
          subtext="Clique para ver detalhes"
          icon={DollarSign}
          trend
          onClick={() => handleOpenDetails('revenue')} 
        />
        <StatCard 
          title="Agendamentos" 
          value={dashboardData.appointmentsCount} 
          subtext="Total registrado no período"
          icon={Calendar}
          onClick={() => handleOpenDetails('appointments')}
        />
        {/* NOVA MÉTRICA: TICKET MÉDIO */}
        <StatCard 
          title="Ticket Médio" 
          value={(dashboardData.averageTicket / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
          subtext="Média gasta por cliente"
          icon={Receipt}
          onClick={() => handleOpenDetails('ticket')} // Abre a mesma lista, mas o contexto é valor
        />
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 md:gap-8">
        
        {/* GRÁFICO */}
        <Card className="col-span-1 lg:col-span-4 border-stone-100 shadow-sm flex flex-col dark:bg-stone-900 dark:border-stone-800 rounded-2xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-stone-700 flex items-center gap-2 dark:text-stone-200">
                <TrendingUp className="w-4 h-4 text-[#C6A87C]" />
                Receita (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px] px-2 md:px-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C6A87C" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#C6A87C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                {!isMobile && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />}
                <XAxis 
                    dataKey="name" 
                    stroke={axisColor}
                    fontSize={isMobile ? 10 : 12}
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                />
                {!isMobile ? (
                  <YAxis 
                      stroke={axisColor} 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `R$${value}`} 
                  />
                ) : (
                  <YAxis hide={true} domain={['auto', 'auto']} />
                )}

                <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    itemStyle={{ color: 'var(--foreground)' }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]}
                    labelStyle={{ color: 'var(--muted-foreground)' }}
                />
                <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#C6A87C" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AGENDA DE HOJE */}
        <Card className="col-span-1 lg:col-span-3 border-stone-100 shadow-sm flex flex-col h-full dark:bg-stone-900 dark:border-stone-800 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold text-stone-700 flex items-center gap-2 dark:text-stone-200">
                <Clock className="w-4 h-4 text-[#C6A87C]" />
                Agenda de Hoje
            </CardTitle>
            <Link href="/appointments" className="text-xs text-[#C6A87C] hover:underline font-bold uppercase tracking-wider">
                Ver completa
            </Link>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[300px] md:max-h-full p-2 md:p-6 pt-0">
            <div className="space-y-1">
              {dashboardData.todayApps.length > 0 ? (
                dashboardData.todayApps.slice(0, 6).map((app: any) => (
                    <AppointmentItem 
                        key={app.id} 
                        appointment={app} 
                        onClick={() => setLocation(`/appointments`)} 
                    />
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 text-stone-400 dark:text-stone-600">
                    <Briefcase className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">Nenhum agendamento para hoje.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- MODAL DE DETALHES (RESPONSIVO) --- */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] w-[95vw] overflow-hidden flex flex-col bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800 rounded-2xl p-0">
          <DialogHeader className="px-6 py-4 border-b border-stone-100 dark:border-stone-800">
            <DialogTitle className="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
               {detailsType === 'revenue' && <DollarSign className="w-5 h-5 text-[#C6A87C]" />}
               {detailsType === 'appointments' && <Calendar className="w-5 h-5 text-[#C6A87C]" />}
               {detailsType === 'ticket' && <Receipt className="w-5 h-5 text-[#C6A87C]" />}
               
               {detailsType === 'revenue' && "Extrato de Faturamento"}
               {detailsType === 'appointments' && "Lista de Agendamentos"}
               {detailsType === 'ticket' && "Base de Cálculo (Ticket Médio)"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-0">
             {dashboardData.filteredAppointments.length > 0 ? (
                 <>
                    {/* VISÃO DESKTOP (TABELA) */}
                    <div className="hidden md:block p-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Data/Hora</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Serviço</TableHead>
                                    <TableHead>Profissional</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dashboardData.filteredAppointments.map((app: any) => (
                                    <TableRow key={app.id} className="hover:bg-stone-50">
                                        <TableCell className="text-stone-500">{format(parseISO(app.start_time), 'dd/MM HH:mm')}</TableCell>
                                        <TableCell className="font-bold text-stone-700">{app.customer_name}</TableCell>
                                        <TableCell>{app.service_name}</TableCell>
                                        <TableCell className="text-stone-500">{app.staff_name}</TableCell>
                                        <TableCell className="text-right font-bold text-[#C6A87C]">
                                            R$ {((app.final_amount_centavos || 0) / 100).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={app.status === 'completed' ? 'default' : 'secondary'} className={app.status === 'completed' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-stone-200 text-stone-500'}>
                                                {app.status === 'completed' ? 'Concluído' : app.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* VISÃO MOBILE (CARDS) */}
                    <div className="md:hidden space-y-3 p-4 bg-stone-50/50">
                        {dashboardData.filteredAppointments.map((app: any) => (
                            <div key={app.id} className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-stone-800">{app.customer_name}</p>
                                        <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                                            <Clock className="w-3 h-3"/> {format(parseISO(app.start_time), 'dd/MM - HH:mm')}
                                        </p>
                                    </div>
                                    <Badge variant={app.status === 'completed' ? 'default' : 'outline'} className={`text-[10px] ${app.status === 'completed' ? 'bg-emerald-500' : ''}`}>
                                        {app.status === 'completed' ? 'Pago' : app.status}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-end border-t border-stone-50 pt-2 mt-1">
                                    <div className="text-xs text-stone-500">
                                        <p>{app.service_name}</p>
                                        <p className="opacity-70">com {app.staff_name}</p>
                                    </div>
                                    <span className="font-bold text-[#C6A87C]">R$ {((app.final_amount_centavos || 0) / 100).toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                 </>
             ) : (
                <div className="flex flex-col items-center justify-center py-12 text-stone-400">
                    <Briefcase className="w-12 h-12 mb-2 opacity-20" />
                    <p>Nenhum registro encontrado para o filtro atual.</p>
                </div>
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}