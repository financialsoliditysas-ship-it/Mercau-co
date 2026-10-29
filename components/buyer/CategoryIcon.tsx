import { Bike, BriefcaseBusiness, HeartPulse, House, Leaf, Scissors, Shirt, Store, Truck, Utensils, Wrench } from 'lucide-react';
import type { DirectoryCategory } from '@/data/directory';

const icons = {
  'Comidas y bebidas': Utensils,
  'Tiendas y comercio': Store,
  'Ferretería y construcción': Wrench,
  'Motos y vehículos': Bike,
  'Salud y bienestar': HeartPulse,
  'Belleza y cuidado personal': Scissors,
  'Moda y accesorios': Shirt,
  'Hogar, tecnología y reparación': House,
  'Transporte y movilidad': Truck,
  'Agro, campo y alimentos': Leaf,
  'Profesionales y servicios': BriefcaseBusiness,
} satisfies Record<DirectoryCategory, typeof Store>;

export default function CategoryIcon({ name }: { name: DirectoryCategory }) {
  const Icon = icons[name];
  return <Icon size={25} aria-hidden="true" />;
}
