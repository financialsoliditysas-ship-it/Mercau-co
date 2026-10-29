import type { BuyerBusiness } from './buyer-commercial';
type PublicDirectory = { businesses: BuyerBusiness[]; preview?: boolean };
let snapshot: { value: PublicDirectory; at: number } | null = null;
let pending: Promise<PublicDirectory> | null = null;
export function recentBuyerDirectory(): PublicDirectory | null {
  return snapshot && Date.now() - snapshot.at < 30000 ? snapshot.value : null;
}
export function refreshBuyerDirectory(): Promise<PublicDirectory> {
  if (pending) return pending;
  pending = fetch('/api/comprador/negocios', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw Error('Directory unavailable');
    const data = await response.json();
    if (!Array.isArray(data.businesses)) throw Error('Invalid public directory');
    const value = { businesses: data.businesses, preview: data.preview === true };
    snapshot = { value, at: Date.now() };
    return value;
  }).finally(() => { pending = null; });
  return pending;
}
