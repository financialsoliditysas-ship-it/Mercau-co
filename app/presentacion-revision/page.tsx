import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Presentation from '@/components/presentation/Presentation';
import './presentation.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Mercáu | Presentación en revisión',
  robots: { index: false, follow: false },
};

export default function PresentationReviewPage() {
  if (process.env.NODE_ENV !== 'development' || process.env.MERCAU_PRESENTATION_REVIEW !== '1') notFound();
  return <Presentation />;
}
