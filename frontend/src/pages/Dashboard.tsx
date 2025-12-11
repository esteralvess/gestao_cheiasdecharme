import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  DollarSign, 
  Calendar, 
  Users, 
  TrendingUp, 
  ArrowUpRight, 
  MapPin, 
  Clock,
  Briefcase
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { appointmentsAPI, customersAPI, locationsAPI } from "@/services/api";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO, isToday, subDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

// --- COMPONENTES VISUAIS ADAPTADOS PARA DARK MODE ---

// Cartão de Métrica
function StatCard({ title, value, subtext, icon: Icon, trend }: any) {
  return (
    // Adicionado dark:bg-stone-900 dark:border-stone-800
    <Card className="border-stone-100 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-stone-900 dark:border-stone-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          {/* Adicionado dark:text-stone-400 */}
          <p className="text-sm font-medium text-stone-500 uppercase tracking-wide dark:text-stone-400">{title}</p>
          <div className="h-8 w-8 bg-[#C6A87C]/10 rounded-full flex items-center justify-center">
             <Icon className="h-4 w-4 text-[#C6A87C]" />
          </div>
        </div>
        <div className="flex flex-col mt-2">
          {/* Adicionado dark:text-stone-100 */}
          <div className="text-2xl font-bold text-stone-800 dark:text-stone-100">{value}</div>
          {/* Adicionado dark:text-stone-500 */}
          <p className="text-xs text-stone-400 mt-1 flex items-center gap-1 dark:text-stone-500">
            {trend && <TrendingUp className="w-3 h-3 text-emerald-500" />}
            {subtext}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Cartão de Agendamento Minimalista
function AppointmentItem({ appointment, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      // Adicionado hover e border para dark mode
      className="group flex items-center gap-4 p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer border border-transparent hover:border-stone-100 dark:hover:border-stone-700"
    >
      {/* Horário - Adicionado dark:bg-stone-800 dark:text-stone-300 */}
      <div className="flex flex-col items-center justify-center min-w-[3.5rem] h-14 bg-stone-100 rounded-lg group-hover:bg-[#C6A87C]/10 group-hover:text-[#C6A87C] transition-colors dark:bg-stone-800 dark:text-stone-300">
        <span className="text-sm font-bold">{format(appointment.startTime, 'HH:mm')}</span>
      </div>

      {/* Detalhes */}
      <div className="flex-1 min-w-0">
        {/* Adicionado dark:text-stone-200 */}
        <p className="text-sm font-semibold text-stone-800 truncate dark:text-stone-200">{appointment.customerName}</p>
        {/* Adicionado dark:text-stone-400 */}
        <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5 dark:text-stone-400">
          <span className="truncate">{appointment.serviceName}</span>
          <span className="w-1 h-1 bg-stone-300 rounded-full dark:bg-stone-600"></span>
          <span className="truncate">{appointment.staffName}</span>
        </div>
      </div>

      {/* Status / Ação */}
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
  
  // Hook para detectar se é tela pequena (mobile) para ajustar o gráfico
  const isMobile = window.innerWidth < 768;

  // 1. Buscando Dados do Usuário
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest("GET", "/users/me/").then(res => res.json())
  });

  // 2. Buscando Dados do Sistema (com tipagem any[] para evitar erros TS)
  const { data: appointments = [] } = useQuery<any[]>({ 
    queryKey: ['appointments'], 
    queryFn: appointmentsAPI.getAll 
  });
  
  const { data: customers = [] } = useQuery<any[]>({ 
    queryKey: ['customers'], 
    queryFn: customersAPI.getAll 
  });

  const { data: locations = [] } = useQuery<any[]>({ 
    queryKey: ['locations'], 
    queryFn: locationsAPI.getAll 
  });

  // 3. Processamento dos Dados
  const dashboardData = useMemo(() => {
    const filteredAppointments = selectedLocation === "all" 
      ? appointments 
      : appointments.filter((a: any) => a.location === selectedLocation || a.location_id === selectedLocation);

    const totalCustomers = customers.length;
    
    const revenue = filteredAppointments.reduce((acc: number, curr: any) => {
        const val = curr.final_amount_centavos || (curr.service_price || 0); 
        return acc + val;
    }, 0);

    const appointmentsCount = filteredAppointments.length;

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

    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });

    const chartData = last7Days.map(day => {
      const dayApps = filteredAppointments.filter((app: any) => {
        const appDate = parseISO(app.start_time);
        return format(appDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });

      const dayRevenue = dayApps.reduce((acc: number, curr: any) => acc + (curr.final_amount_centavos || 0), 0);

      return {
        name: format(day, 'dd/MM', { locale: ptBR }),
        value: dayRevenue / 100, 
        count: dayApps.length
      };
    });

    return {
      revenue,
      totalCustomers,
      appointmentsCount,
      todayApps,
      chartData
    };
  }, [appointments, customers, selectedLocation]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const displayName = user?.first_name || user?.username || "Alessandra";

  // Definição de cores para o gráfico dependendo do tema
  // Nota: Idealmente usaríamos variáveis CSS, mas para garantir o funcionamento rápido:
  const axisColor = "#A1A1AA"; // Um cinza médio que funciona no claro e no escuro
  const gridColor = "#E5E7EB40"; // Cinza claro com transparência para a grade

  return (
    // Adicionado dark:bg-stone-950 para o fundo principal
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 dark:bg-stone-950 min-h-screen">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          {/* Adicionado dark:text-stone-100 */}
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight dark:text-stone-100">
            {greeting}, <span>{displayName}</span>!
          </h1>
          {/* Adicionado dark:text-stone-400 */}
          <p className="text-stone-500 dark:text-stone-400">
            Aqui está o resumo do seu salão hoje, {format(new Date(), "d 'de' MMMM", { locale: ptBR })}.
          </p>
        </div>

        {/* Filtro de Unidade */}
        <div className="w-full md:w-auto flex items-center gap-2">
            {/* Adaptado o container do Select para dark mode */}
            <div className="bg-white dark:bg-stone-900 p-1 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm flex items-center">
                <MapPin className="w-4 h-4 text-stone-400 ml-2" />
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    {/* Adaptado o texto do Trigger */}
                    <SelectTrigger className="w-[180px] border-0 focus:ring-0 text-stone-600 dark:text-stone-300 bg-transparent h-8">
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
            
            <Button onClick={() => setLocation("/appointments")} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white hidden md:flex">
                Ver Agenda
            </Button>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Faturamento (Estimado)" 
          value={(dashboardData.revenue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
          subtext="Baseado nos agendamentos"
          icon={DollarSign}
          trend
        />
        <StatCard 
          title="Agendamentos" 
          value={dashboardData.appointmentsCount} 
          subtext="Total registrado"
          icon={Calendar}
        />
        <StatCard 
          title="Clientes Ativos" 
          value={dashboardData.totalCustomers} 
          subtext="Base de cadastros"
          icon={Users}
        />
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
        
        {/* GRÁFICO */}
        <Card className="col-span-1 lg:col-span-4 border-stone-100 shadow-sm flex flex-col dark:bg-stone-900 dark:border-stone-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-stone-700 flex items-center gap-2 dark:text-stone-200">
                <TrendingUp className="w-4 h-4 text-[#C6A87C]" />
                Receita (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C6A87C" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#C6A87C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                {/* Grade: Oculta em mobile para limpar o visual */}
                {!isMobile && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />}
                <XAxis 
                    dataKey="name" 
                    stroke={axisColor}
                    fontSize={isMobile ? 10 : 12} // Fonte menor no mobile
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                />
                {/* Eixo Y: Oculto em mobile */}
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

                {/* Tooltip adaptado para Dark Mode via estilos inline */}
                <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--background)', // Usa a variável do tema (branco ou preto)
                      borderColor: 'var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    itemStyle={{ color: 'var(--foreground)' }} // Cor do texto se adapta
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
        <Card className="col-span-1 lg:col-span-3 border-stone-100 shadow-sm flex flex-col h-full dark:bg-stone-900 dark:border-stone-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-stone-700 flex items-center gap-2 dark:text-stone-200">
                <Clock className="w-4 h-4 text-[#C6A87C]" />
                Agenda de Hoje
            </CardTitle>
            <Link href="/appointments" className="text-xs text-[#C6A87C] hover:underline font-medium">
                Ver completa
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-1">
              {dashboardData.todayApps.length > 0 ? (
                dashboardData.todayApps.slice(0, 6).map((app: any) => (
                    <AppointmentItem 
                        key={app.id} 
                        appointment={app} 
                        onClick={() => setLocation(`/appointments?id=${app.id}`)}
                    />
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 text-stone-400 dark:text-stone-600">
                    <Briefcase className="w-10 h-10 mb-3 opacity-20" />
                    <p>Nenhum agendamento para hoje.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}