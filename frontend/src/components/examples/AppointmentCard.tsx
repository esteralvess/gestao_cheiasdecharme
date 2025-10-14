import AppointmentCard from '../AppointmentCard';

export default function AppointmentCardExample() {
  return (
    <div className="p-4">
      <AppointmentCard 
        id="1"
        customerName="Maria Silva"
        serviceName="Manicure & Pedicure"
        staffName="Ana Costa"
        startTime={new Date(2025, 9, 8, 14, 0)}
        endTime={new Date(2025, 9, 8, 15, 30)}
        status="confirmed"
        onClick={() => console.log('Appointment clicked')}
      />
    </div>
  );
}
