import { loadDirectoryBusinesses } from './airtable-directory';
import { getSupabaseAdminClient } from './supabase-admin';
import { isFoodBusiness } from './catalog-validation';
import { dishStartingPrice } from './dish-pricing';
import { businessCatalogPath, businessPath } from './business-public-url';

export type DiscoveredDish = {
  id: string; name: string; section: string; price: number; from: boolean; image?: string;
  restaurantId: string; restaurantName: string; menuPath: string; businessPath: string;
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
type Cursor = { round: number; offset: number; more: boolean; scope: string };
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
  }
  const directory = (await loadDirectoryBusinesses()).filter(business =>
    !business.pilotRestaurant && isFoodBusiness(business.category) && business.municipality === municipality);
  if (!directory.length) return { products: [], categories: [], nextCursor: null };
  const db = getSupabaseAdminClient();
  const restaurants = await db.from('pilot_restaurants').select('id,directory_business_id')
    .in('id', directory.map(b => b.id)).eq('enabled', true).eq('is_live', true).eq('directory_initialized', true);
  if (restaurants.error) throw new Error('No se pudo consultar la oferta.');
  const eligible = directory.filter(business => (restaurants.data || []).some(row => row.id === business.id && row.directory_business_id === business.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!eligible.length) return { products: [], categories: [], nextCursor: null };
  const categories = new Set<string>();
  // Only section metadata, never complete menus. Bound this metadata read and paginate it.
  for (let start = 0; ; start += 1000) {
    const result = await db.from('business_catalog_products').select('section').in('business_id', eligible.map(b => b.id))
      .eq('status', 'published').eq('available', true).gt('price', 0).order('id').range(start, start + 999);
    if (result.error) throw new Error('No se pudieron consultar las categorías.');
    for (const row of result.data || []) categories.add(row.section || 'Otros');
    if (!result.data || result.data.length < 1000) break;
  }
  if (page.offset >= eligible.length) throw new Error('Página inválida.');
  // One dish per restaurant per round: a large menu cannot occupy the whole first page.
  const batch = eligible.slice(page.offset, page.offset + 12);
  const products = await Promise.all(batch.map(async (business): Promise<DiscoveredDish | null> => {
    let request = db.from('business_catalog_products').select('id,name,section,price,image_path,version,option_groups', { count: 'exact' })
      .eq('business_id', business.id).eq('status', 'published').eq('available', true).gt('price', 0);
    if (section) request = section === 'Otros' ? request.in('section', ['Otros', '']) : request.eq('section', section);
    if (query && !normalize(business.name).includes(normalize(query))) request = request.ilike('name', `%${query.replace(/[\\%_]/g, '\\$&')}%`);
    const result = await request.order('position').order('id').range(page.round, page.round);
    if (result.error) throw new Error('No se pudieron consultar los platos.');
    if ((result.count || 0) > page.round + 1) page.more = true;
    const row = result.data?.[0];
    if (!row) return null;
    return { id: row.id, name: row.name, section: row.section || 'Otros', ...dishStartingPrice(row.price, row.option_groups),
      image: row.image_path ? `/api/negocios/${business.id}/catalogo/${row.id}/foto?v=${row.version}` : undefined,
      restaurantId: business.id, restaurantName: business.name, menuPath: businessCatalogPath(business), businessPath: businessPath(business) } satisfies DiscoveredDish;
  }));
  const offset = page.offset + batch.length;
  const next = offset < eligible.length ? { ...page, offset } : page.more ? { ...page, offset: 0, round: page.round + 1, more: false } : null;
  return { products: products.filter((product): product is DiscoveredDish => product !== null),
    categories: [...categories].sort((a, b) => a.localeCompare(b, 'es')), nextCursor: next ? Buffer.from(JSON.stringify(next)).toString('base64url') : null };
}
