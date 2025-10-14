import LocationCard from '../LocationCard';

export default function LocationCardExample() {
  return (
    <div className="p-4">
      <LocationCard 
        name="Unidade Centro"
        address="Rua das Flores, 123 - Centro, São Paulo - SP"
        businessHours="Segunda a Sábado, 9h às 19h"
        onClick={() => console.log('Location clicked')}
        onEdit={() => console.log('Edit location')}
      />
    </div>
  );
}
