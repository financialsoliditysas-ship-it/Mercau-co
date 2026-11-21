import { accountUser, accountJson, accountFailure } from '@/lib/account-server';
import { authorizedDeliveryTracking } from '@/lib/delivery-tracking';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, props: { params: Promise<{ publicId: string }> }) {
  const params = await props.params;
  try {
    const user = await accountUser(request);
    return accountJson(await authorizedDeliveryTracking(user.id, params.publicId));
  } catch (error) { return accountFailure(error); }
}
