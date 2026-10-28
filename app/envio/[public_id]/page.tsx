import ProtectedDeliveryTracking from '@/components/ProtectedDeliveryTracking';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Seguimiento | Mercáu', robots: { index: false, follow: false } };
export default function Tracking({ params }: { params: { public_id: string } }) {
  return <ProtectedDeliveryTracking publicId={params.public_id} />;
}
