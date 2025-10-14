import StaffCard from '../StaffCard';

export default function StaffCardExample() {
  return (
    <div className="p-4">
      <StaffCard 
        name="Ana Costa"
        role="Manicure Especialista"
        active={true}
        services={["Manicure", "Pedicure", "Unhas em Gel", "Alongamento"]}
        location="Unidade Centro"
        onClick={() => console.log('Staff clicked')}
      />
    </div>
  );
}
