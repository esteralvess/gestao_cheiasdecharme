import { useMemo, useState } from "react"; // ✅ Adicionado useState
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { DollarSign, Calendar, TrendingUp, Users } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import AppointmentCard from "@/components/AppointmentCard";
import { Card } from "@/components/ui/card";
// ✅ Importações para o menu de seleção
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { appointmentsAPI, customersAPI, servicesAPI, locationsAPI } from "@/services/api"; // ✅ Adicionado locationsAPI
import { format, parseISO, eachDayOfInterval, subDays, startOfDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

// --- Tipagem de Dados ---

interface AppointmentFromAPI {
  id: string;
  customer_name: string;
  service_name: string;
  staff_name: string;
  start_time: string; // ISO String
  end_time: string;   // ISO String
  status: "confirmed" | "completed" | "cancelled" | "pending";
  service: string; 
  location: string; // ✅ Adicionado location
}

interface ProcessedAppointment {
    id: string;
    customerName: string;
    serviceName: string;
    staffName: string;
    startTime: Date;
    endTime: Date;
    status: "confirmed" | "completed" | "cancelled" | "pending";
    serviceId: string;
    locationId: string; // ✅ Adicionado locationId
}

interface Service {
    id: string;
    name: string;
    price_centavos?: number;
}

// ✅ Adicionada interface para Location
interface Location {
    id: string;
    name: string;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  // ✅ Adicionado estado para controlar o filtro de unidade selecionada
  const [locationFilter, setLocationFilter] = useState<string>('');
  
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<AppointmentFromAPI[]>({
    queryKey: ['appointments'],
    queryFn: appointmentsAPI.getAll,
  });

  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery<any[]>({
    queryKey: ['customers'],
    queryFn: customersAPI.getAll,
  });

  const { data: services = [], isLoading: isLoadingServices } = useQuery<Service[]>({
      queryKey: ['services'],
      queryFn: servicesAPI.getAll,
  });

  // ✅ Adicionada busca de dados das unidades
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<Location[]>({
      queryKey: ['locations'],
      queryFn: locationsAPI.getAll,
  });

  const loading = isLoadingAppointments || isLoadingCustomers || isLoadingServices || isLoadingLocations;

  const processedAppointments: ProcessedAppointment[] = useMemo(() => {
    return appointments.map(apt => ({
        id: apt.id,
        status: apt.status,
        customerName: apt.customer_name,
        serviceName: apt.service_name,
        staffName: apt.staff_name,
        startTime: parseISO(apt.start_time),
        endTime: parseISO(apt.end_time),
        serviceId: apt.service,
        locationId: apt.location, // ✅ Mapeando o locationId
    }));
  }, [appointments]);

  // ✅ Criada uma lista de agendamentos que reage ao filtro de unidade
  const filteredAppointments = useMemo(() => {
    if (!locationFilter) {
        return processedAppointments; // Se nenhum filtro, retorna todos
    }
    return processedAppointments.filter(apt => apt.locationId === locationFilter);
  }, [processedAppointments, locationFilter]);


  const today = startOfDay(new Date());

  const faturamentoHoje = useMemo(() => {
    const servicePriceMap = new Map(services.map(s => [s.id, s.price_centavos || 0]));
    
    // ✅ Usando filteredAppointments
    const totalCentavos = filteredAppointments
      .filter(apt => apt.status === 'completed' && isToday(apt.startTime))
      .reduce((sum, apt) => {
        const price = servicePriceMap.get(apt.serviceId) || 0;
        return sum + price;
      }, 0);

    return (totalCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }, [filteredAppointments, services]);

  const chartData = useMemo(() => {
    const servicePriceMap = new Map(services.map(s => [s.id, s.price_centavos || 0]));
    const last7Days = eachDayOfInterval({ start: subDays(today, 6), end: today });
    const dailyRevenue = new Map<string, number>();

    last7Days.forEach(day => { dailyRevenue.set(format(day, 'yyyy-MM-dd'), 0); });

    // ✅ Usando filteredAppointments
    filteredAppointments
        .filter(apt => apt.status === 'completed')
        .forEach(apt => {
            const aptDateStr = format(apt.startTime, 'yyyy-MM-dd');
            if (dailyRevenue.has(aptDateStr)) {
                const price = servicePriceMap.get(apt.serviceId) || 0;
                dailyRevenue.set(aptDateStr, (dailyRevenue.get(aptDateStr) || 0) + price);
            }
        });

    return last7Days.map(day => ({
        day: format(day, 'EEE', { locale: ptBR }),
        value: dailyRevenue.get(format(day, 'yyyy-MM-dd')) || 0,
    }));
  }, [filteredAppointments, services]);
  
  const totalTodayAppointmentsCount = useMemo(() => {
    // ✅ Usando filteredAppointments
    return filteredAppointments.filter(apt => isToday(apt.startTime)).length;
  }, [filteredAppointments]);

  const todayAppointments = useMemo(() => {
    // ✅ Usando filteredAppointments
    return filteredAppointments
      .filter(apt => 
          isToday(apt.startTime) &&
          (apt.status === 'confirmed' || apt.status === 'pending')
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [filteredAppointments]);

  // O total de clientes não é afetado pelo filtro de unidade
  const totalCustomers = customers.length;
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu studio de beleza</p>
        </div>
        
        {/* ✅ ADICIONADO O COMPONENTE DE FILTRO */}
        <Select 
            value={locationFilter || 'all'} 
            onValueChange={(value) => setLocationFilter(value === 'all' ? '' : value)}
        >
            <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por Unidade" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todas as Unidades</SelectItem>
                {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/profissionais?tab=commissions">
            <MetricCard
              title="Faturamento Hoje"
              value={loading ? "..." : faturamentoHoje}
              icon={DollarSign}
              iconColor="bg-chart-1/10 text-chart-1"
            />
        </Link>
        <Link href="/appointments">
            <MetricCard
              title="Agendamentos Hoje"
              value={loading ? "..." : totalTodayAppointmentsCount}
              icon={Calendar}
              iconColor="bg-chart-3/10 text-chart-3"
            />
        </Link>
        <Link href="/customers">
            <MetricCard
              title="Total de Clientes"
              value={loading ? "..." : totalCustomers}
              icon={Users}
              iconColor="bg-chart-2/10 text-chart-2"
            />
        </Link>
        <Link href="/profissionais?tab=commissions">
            <MetricCard
              title="Concluídos (Hoje)"
              // ✅ Usando filteredAppointments
              value={loading ? "..." : filteredAppointments.filter(apt => apt.status === 'completed' && isToday(apt.startTime)).length}
              icon={TrendingUp}
              iconColor="bg-primary/10 text-primary"
            />
        </Link>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Faturamento dos Últimos 7 Dias</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => `R$ ${value / 100}`} />
            <Tooltip 
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }}
              formatter={(value: number) => [ (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), "Faturamento"]}
            />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Próximos Agendamentos (Hoje)</h2>
        <div className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Carregando agendamentos...</p>
          ) : todayAppointments.length > 0 ? (
            todayAppointments.slice(0, 5).map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                {...appointment}
                onClick={() => setLocation(`/appointments?appointment_id=${appointment.id}`)}
              />
            ))
          ) : (
            <p className="text-muted-foreground">Nenhum agendamento para hoje.</p>
          )}
        </div>
      </div>
    </div>
  );
}