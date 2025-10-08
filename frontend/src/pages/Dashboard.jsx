import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, Users, DollarSign, CheckCircle } from "lucide-react";
import { appointmentsAPI } from "@/services/api";
import AppointmentCard from "@/components/AppointmentCard";

export default function Dashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const response = await appointmentsAPI.getAll();
      setAppointments(response.data);
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const todayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.start_time);
    const today = new Date();
    return aptDate.toDateString() === today.toDateString();
  });

  const completedCount = appointments.filter(apt => apt.status === 'completed').length;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gold-dark">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Agendamentos Hoje</p>
                <p className="text-3xl font-bold text-gold-dark mt-2">{todayAppointments.length}</p>
              </div>
              <Calendar className="w-12 h-12 text-gold-dark opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Clientes</p>
                <p className="text-3xl font-bold text-gold-dark mt-2">-</p>
              </div>
              <Users className="w-12 h-12 text-gold-dark opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Faturamento Hoje</p>
                <p className="text-3xl font-bold text-gold-dark mt-2">R$ 0,00</p>
              </div>
              <DollarSign className="w-12 h-12 text-gold-dark opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Concluídos</p>
                <p className="text-3xl font-bold text-gold-dark mt-2">{completedCount}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-gold-dark opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximos Agendamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Carregando...</p>
          ) : todayAppointments.length > 0 ? (
            <div className="space-y-4">
              {todayAppointments.slice(0, 5).map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  customerName={apt.customer_name || "Cliente"}
                  serviceName={apt.service_name || "Serviço"}
                  staffName={apt.staff_name || "Colaborador"}
                  startTime={apt.start_time}
                  endTime={apt.end_time}
                  status={apt.status}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhum agendamento para hoje</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
