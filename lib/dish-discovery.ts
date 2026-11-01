import { loadDirectoryBusinesses } from './airtable-directory';
import { getSupabaseAdminClient } from './supabase-admin';
import { isFoodBusiness } from './catalog-validation';
import { dishStartingPrice } from './dish-pricing';
import { businessCatalogPath, businessPath } from './business-public-url';
import { publicReadCache } from './public-read-cache';
import { businessOrderHours } from './business-order-hours';
const publicDirectory=publicReadCache<Awaited<ReturnType<typeof loadDirectoryBusinesses>>>(10000,1);
const publicSections=publicReadCache<string[]>(10000,8);

export type DiscoveredDish = {
  id: string; name: string; section: string; price: number; from: boolean; image?: string;
  restaurantId: string; restaurantName: string; menuPath: string; businessPath: string;
  acceptingOrders: boolean; availabilityMessage?: string; nextOpeningAt?: string;
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
type Cursor = { round: number; offset: number; more: boolean; scope: string; phase?: 'open'|'closed'; at?: string };
export async function discoverDishes({ municipality, query = '', section = '', cursor = '' }: {
  municipality: string; query?: string; section?: string; cursor?: string;
}) {
  // The current order flow serves Nechi only. Do not infer delivery coverage from proximity.
  if (municipality !== 'Nechí') return { products: [], categories: [], nextCursor: null };
  const scope = JSON.stringify([municipality, query, section]);
  let page: Cursor = { round: 0, offset: 0, more: false, scope };
  if (cursor) {
    try { page = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch { throw new Error('Página inválida.'); }
    if (page.scope !== scope || !Number.isInteger(page.round) || page.round < 0 || page.round > 10000 ||
      !Number.isInteger(page.offset) || page.offset < 0 || typeof page.more !== 'boolean') throw new Error('Página inválida.');
    if(page.phase!==undefined&&!['open','closed'].includes(page.phase))throw new Error('Página inválida.');
    if(page.at!==undefined&&(typeof page.at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(page.at)||!Number.isFinite(new Date(page.at).getTime())))throw new Error('Página inválida.');
  }
  page.at=page.at||new Date().toISOString();
  const directory = (await publicDirectory('directory',loadDirectoryBusinesses)).filter(business =>
    !business.pilotRestaurant && isFoodBusiness(business.category) && business.municipality === municipality);
  if (!directory.length) return { products: [], categories: [], nextCursor: null };
  const db = getSupabaseAdminClient();
  const restaurants = await db.from('pilot_restaurants').select('id,directory_business_id')
    .in('id', directory.map(b => b.id)).eq('enabled', true).eq('is_live', true).eq('directory_initialized', true);
  if (restaurants.error) throw new Error('No se pudo consultar la oferta.');
  const hoursResult=await db.from('business_account_settings').select('business_id,data').in('business_id',(restaurants.data||[]).map(row=>row.id));
  if(hoursResult.error)throw new Error('No se pudieron comprobar los horarios.');
  const hoursByBusiness=new Map((hoursResult.data||[]).map(row=>[row.business_id,row.data]));
  const eligible = directory.filter(business => (restaurants.data || []).some(row => row.id === business.id && row.directory_business_id === business.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const availability=new Map(eligible.map(business=>[business.id,businessOrderHours(hoursByBusiness.get(business.id))]));
  // Freeze only ordering at the first page; purchase availability is always evaluated now.
  const ordering=new Map(eligible.map(business=>[business.id,businessOrderHours(hoursByBusiness.get(business.id),new Date(page.at!)).open]));
  if (!eligible.length) return { products: [], categories: [], nextCursor: null };
  const categories = await publicSections(JSON.stringify(eligible.map(b=>b.id)),async()=>{
  const found = new Set<string>();
  // Only section metadata, never complete menus. Bound this metadata read and paginate it.
  for (let start = 0; ; start += 1000) {
    const result = await db.from('business_catalog_products').select('section').in('business_id', eligible.map(b => b.id))
      .eq('status', 'published').eq('available', true).gt('price', 0).order('id').range(start, start + 999);
    if(start>0&&result.status===416&&result.error?.code==='PGRST103')break;
    if (result.error) throw new Error('No se pudieron consultar las categorías.');
    for (const row of result.data || []) found.add(row.section || 'Otros');
    if (!result.data || result.data.length < 1000) break;
  }
  return [...found].sort((a,b)=>a.localeCompare(b,'es'));
  });
  const phase=page.phase||(eligible.some(business=>ordering.get(business.id))?'open':'closed');
  const phaseBusinesses=eligible.filter(business=>ordering.get(business.id)===(phase==='open'));
  const closedCursor=phase==='open'&&eligible.some(business=>!ordering.get(business.id))?{round:0,offset:0,more:false,scope,phase:'closed' as const,at:page.at}:null;
  if(page.offset>=phaseBusinesses.length)return {products:[],categories,nextCursor:closedCursor?Buffer.from(JSON.stringify(closedCursor)).toString('base64url'):null};
  // Two products per restaurant, up to eight per page; interleave them to balance exposure.
  const batch = phaseBusinesses.slice(page.offset, page.offset + 4);
  const products = await Promise.all(batch.map(async (business): Promise<DiscoveredDish[]> => {
    let request = db.from('business_catalog_products').select('id,name,section,price,image_path,version,option_groups', { count: 'exact' })
      .eq('business_id', business.id).eq('status', 'published').eq('available', true).gt('price', 0);
    if (section) request = section === 'Otros' ? request.in('section', ['Otros', '']) : request.eq('section', section);
    if (query && !normalize(business.name).includes(normalize(query))) request = request.ilike('name', `%${query.replace(/[\\%_]/g, '\\$&')}%`);
    const result = await request.order('position').order('id').range(page.round, page.round + 1);
    // Exact-count ranges past this restaurant's last row are normal exhaustion.
    // Keep other errors visible; never turn an authorization/network failure into an empty menu.
    if(page.round>0 && result.status===416 && result.error?.code==='PGRST103')return [];
    if (result.error) throw new Error('No se pudieron consultar los platos.');
    if ((result.count || 0) > page.round + 2) page.more = true;
    return (result.data || []).map(row=>({ id: row.id, name: row.name, section: row.section || 'Otros', ...dishStartingPrice(row.price, row.option_groups),
      image: row.image_path ? `/api/negocios/${business.id}/catalogo/${row.id}/foto?v=${row.version}` : undefined,
      restaurantId: business.id, restaurantName: business.name, menuPath: businessCatalogPath(business), businessPath: businessPath(business),
      acceptingOrders:availability.get(business.id)!.open,availabilityMessage:availability.get(business.id)!.message,nextOpeningAt:availability.get(business.id)!.nextOpeningAt } satisfies DiscoveredDish));
  }));
  const offset = page.offset + batch.length;
  const next = offset < phaseBusinesses.length ? { ...page, phase, offset } : page.more ? { ...page, phase, offset: 0, round: page.round + 2, more: false } : closedCursor;
  return { products: [0,1].flatMap(index=>products.flatMap(items=>items[index]?[items[index]]:[])),
    categories, nextCursor: next ? Buffer.from(JSON.stringify(next)).toString('base64url') : null };
}
