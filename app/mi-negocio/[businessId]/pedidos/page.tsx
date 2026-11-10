import { notFound } from 'next/navigation';
import RestaurantPilot from '@/components/RestaurantPilot';
import { loadDirectoryBusiness } from '@/lib/airtable-directory';
import {isFoodBusiness} from '@/lib/catalog-validation';
import CommerceOrdersManager from '@/components/CommerceOrdersManager';
export const dynamic = 'force-dynamic';
export default async function BusinessOrdersPage({ params }: { params: { businessId: string } }) {
  const business = await loadDirectoryBusiness(params.businessId);
  if (!business) notFound();
  return isFoodBusiness(business.category)?<RestaurantPilot manager restaurantId={params.businessId} businessName={business.name} />:<CommerceOrdersManager businessId={params.businessId} businessName={business.name}/>;
}
