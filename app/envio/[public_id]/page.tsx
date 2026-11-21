import ProtectedDeliveryTracking from '@/components/ProtectedDeliveryTracking';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Seguimiento | Mercáu', robots: { index: false, follow: false } };
export default async function Tracking(props: { params: Promise<{ public_id: string }> }) {
  const params = await props.params;
  return <ProtectedDeliveryTracking publicId={params.public_id} />;
}
