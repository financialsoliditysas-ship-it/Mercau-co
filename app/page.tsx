import type { Metadata } from 'next';
import Presentation from '@/components/presentation/Presentation';
import HomeEntry from '@/components/presentation/HomeEntry';
import './presentacion-revision/presentation.css';

export const metadata: Metadata = {
  title: 'Mercáu | Pide comida y compra local',
  description: 'Explora restaurantes, menús y catálogos. Encuentra lo que necesitas y consulta tu pedido en Mercáu.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Mercáu | Pide comida y compra local',
    description: 'Explora restaurantes, menús y catálogos de los negocios de tu municipio.',
    url: '/',
    images: [{ url: '/og-mercau.jpg', width: 1200, height: 630, alt: 'Mercáu' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mercáu | Pide comida y compra local',
    description: 'Explora restaurantes, menús y catálogos de los negocios de tu municipio.',
    images: ['/og-mercau.jpg'],
  },
};

export default function Page() {
  return <><HomeEntry /><Presentation /></>;
}
