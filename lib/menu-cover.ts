import { createHash } from 'crypto';

// Use the published catalog order for both the menu banner and its share preview.
export function menuCover(business:{photoUrl?:string;photoKind?:string;photoVersion?:string},products:{id?:string;position?:number;imageUrl?:string}[]) {
  const photos=products.filter(product=>product.imageUrl).sort((a,b)=>(a.position || 0)-(b.position || 0) || String(a.id || '').localeCompare(String(b.id || '')));
  const imageUrl=photos[0]?.imageUrl || (business.photoKind==='photo'?business.photoUrl:'') || '';
  return {imageUrl,version:createHash('sha256').update(imageUrl || business.photoVersion || '1').digest('hex').slice(0,16)};
}
