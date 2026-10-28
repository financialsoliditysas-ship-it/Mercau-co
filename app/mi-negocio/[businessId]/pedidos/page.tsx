import { notFound } from 'next/navigation';
import RestaurantPilot from '@/components/RestaurantPilot';
import { loadDirectoryBusiness } from '@/lib/airtable-directory';
export const dynamic = 'force-dynamic';
export default async function BusinessOrdersPage({ params }: { params: { businessId: string } }) {
  const business = await loadDirectoryBusiness(params.businessId);
  if (!business) notFound();
  return <RestaurantPilot manager restaurantId={params.businessId} businessName={business.name} />;
}
