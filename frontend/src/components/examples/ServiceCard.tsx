import ServiceCard from '../ServiceCard';
import heroImage from '@assets/generated_images/Beauty_salon_hero_image_c52e36ac.png';

export default function ServiceCardExample() {
  return (
    <div className="p-4 max-w-sm">
      <ServiceCard 
        name="Manicure Completa"
        category="Unhas"
        description="Tratamento completo de unhas com esmaltação premium e hidratação"
        duration={60}
        price={8000}
        popular={true}
        imageUrl={heroImage}
        onClick={() => console.log('Service clicked')}
      />
    </div>
  );
}
