import PaymentCard from '../PaymentCard';

export default function PaymentCardExample() {
  return (
    <div className="p-4">
      <PaymentCard 
        appointmentId="1"
        customerName="Maria Silva"
        serviceName="Manicure Completa"
        amount={8000}
        paymentMethod="pix"
        paymentDate={new Date()}
        commission={1600}
      />
    </div>
  );
}
