import { useState, useEffect } from "react";
import { appointmentsAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import CalendarView from "@/components/CalendarView";
import AppointmentCard from "@/components/AppointmentCard";

export default function Appointments() {
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gold-dark">Agenda</h1>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>

      {loading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <CalendarView
          appointments={appointments}
          onAppointmentClick={(apt) => console.log("Appointment clicked:", apt)}
          onDateClick={(date) => console.log("Date clicked:", date)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Todos os Agendamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appointments.slice(0, 10).map((apt) => (
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
        </CardContent>
      </Card>
    </div>
  );
}
