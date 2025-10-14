import CustomerRow from '../CustomerRow';

export default function CustomerRowExample() {
  return (
    <div className="p-4">
      <CustomerRow 
        id="1"
        name="Maria Silva"
        whatsapp="(11) 98765-4321"
        email="maria@email.com"
        lastAppointmentStatus="completed"
        onEdit={() => console.log('Edit customer')}
        onDelete={() => console.log('Delete customer')}
      />
    </div>
  );
}
