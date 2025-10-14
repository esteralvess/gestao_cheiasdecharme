import CalendarView from '../CalendarView';

//todo: remove mock functionality
const mockAppointments = [
  {
    id: "1",
    customerName: "Maria Silva",
    serviceName: "Manicure & Pedicure",
    staffName: "Ana Costa",
    startTime: new Date(2025, 9, 8, 14, 0),
    endTime: new Date(2025, 9, 8, 15, 30),
    status: "confirmed" as const,
  },
  {
    id: "2",
    customerName: "João Santos",
    serviceName: "Corte de Cabelo",
    staffName: "Carlos Lima",
    startTime: new Date(2025, 9, 8, 15, 0),
    endTime: new Date(2025, 9, 8, 16, 0),
    status: "pending" as const,
  },
  {
    id: "3",
    customerName: "Ana Paula",
    serviceName: "Design de Sobrancelhas",
    staffName: "Beatriz Souza",
    startTime: new Date(2025, 9, 10, 16, 30),
    endTime: new Date(2025, 9, 10, 17, 15),
    status: "confirmed" as const,
  },
  {
    id: "4",
    customerName: "Carla Mendes",
    serviceName: "Escova Modeladora",
    staffName: "Carlos Lima",
    startTime: new Date(2025, 9, 12, 17, 0),
    endTime: new Date(2025, 9, 12, 17, 45),
    status: "completed" as const,
  },
];

export default function CalendarViewExample() {
  return (
    <div className="p-4">
      <CalendarView 
        appointments={mockAppointments}
        onAppointmentClick={(apt) => console.log('Appointment clicked:', apt)}
        onDateClick={(date) => console.log('Date clicked:', date)}
      />
    </div>
  );
}
