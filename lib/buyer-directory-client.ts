import type { BuyerBusiness } from './buyer-commercial';
import { publicBrowse,recentPublicBrowse } from './public-browse-client';
type PublicDirectory = { businesses: BuyerBusiness[]; preview?: boolean; stale?:boolean };
let snapshot: { value: PublicDirectory; at: number } | null = null;
let pending: Promise<PublicDirectory> | null = null;
export function recentBuyerDirectory(): PublicDirectory | null {
  if(snapshot && Date.now()-snapshot.at<30000)return snapshot.value;
  const saved=recentPublicBrowse('/api/comprador/negocios');return saved?{...saved,stale:true}:null;
}
export function refreshBuyerDirectory(): Promise<PublicDirectory> {
  if (pending) return pending;
  pending = publicBrowse('/api/comprador/negocios').then(({data,stale}) => {
    if (!Array.isArray(data.businesses)) throw Error('Invalid public directory');
    const value = { businesses: data.businesses, preview: data.preview === true,stale };
    snapshot = { value, at: Date.now() };
    return value;
  }).finally(() => { pending = null; });
  return pending;
}
