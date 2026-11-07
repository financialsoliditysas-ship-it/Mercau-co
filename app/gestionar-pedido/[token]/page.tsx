import RestaurantOrderAction from '@/components/RestaurantOrderAction';

export const dynamic = 'force-dynamic';

export default function RestaurantOrderActionPage({ params }: { params: { token: string } }) {
  return <RestaurantOrderAction token={params.token} />;
}
