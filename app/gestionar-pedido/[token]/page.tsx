import RestaurantOrderAction from '@/components/RestaurantOrderAction';
import CommerceOrderAction from '@/components/CommerceOrderAction';
import {getRestaurantActionOrder} from '@/lib/restaurant-order-action-link';
import {getCommerceOrderByToken} from '@/lib/commerce-order-action';

export const dynamic = 'force-dynamic';

export default async function RestaurantOrderActionPage({ params }: { params: { token: string } }) {
  try{await getRestaurantActionOrder(params.token);return <RestaurantOrderAction token={params.token}/>;}catch{try{await getCommerceOrderByToken(params.token);return <CommerceOrderAction token={params.token}/>;}catch{return <RestaurantOrderAction token={params.token}/>;}}
}
