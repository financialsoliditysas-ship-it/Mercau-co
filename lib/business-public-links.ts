import { getSupabaseAdminClient } from './supabase-admin';
import { businessSlugBase, validBusinessSlug } from './business-public-url';
type LinkableBusiness = { id: string; name: string; municipality: string; publicSlug?: string };
type LinkRow = { business_id: string; slug: string };
const table = 'business_public_links';

function validRows(value: unknown): LinkRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is LinkRow => !!row && typeof row.business_id === 'string' && validBusinessSlug(row.slug));
}
export async function withPublicBusinessLinks<T extends LinkableBusiness>(businesses: T[]): Promise<T[]> {
  if (!businesses.length) return businesses;
  try {
    const db = getSupabaseAdminClient();
    const result = await db.from(table).select('business_id,slug').in('business_id', businesses.map(b => b.id)).eq('is_canonical', true);
    if (result.error) throw new Error('Public links unavailable');
    const slugs = new Map(validRows(result.data).map(row => [row.business_id, row.slug]));
    const missing = businesses.filter(b => !slugs.has(b.id));
    if (missing.length) {
      const reserved = await db.rpc('ensure_business_public_links', { p_businesses: missing.map(b => ({
        business_id: b.id, base_slug: businessSlugBase(b.name), municipality_slug: businessSlugBase(b.municipality).slice(0, 32).replace(/-+$/g, '')
      })) });
      if (reserved.error) console.warn('[public-links] New links could not be reserved; existing URLs remain available.');
      else for (const row of validRows(reserved.data)) slugs.set(row.business_id, row.slug);
    }
    return businesses.map(b => slugs.has(b.id) ? { ...b, publicSlug: slugs.get(b.id) } : b);
  } catch {
    // A missing migration must not take the existing ID-based directory offline.
    console.warn('[public-links] Registry unavailable; keeping existing business URLs.');
    return businesses;
  }
}
export async function publicLinkBusinessId(slug: string) {
  if (!validBusinessSlug(slug)) return null;
  const result = await getSupabaseAdminClient().from(table).select('business_id').eq('slug', slug).maybeSingle();
  if (result.error) throw new Error('No se pudo consultar el enlace del negocio. Intenta nuevamente.');
  return result.data?.business_id as string | undefined || null;
}
export async function canonicalBusinessSlug(businessId: string) {
  const result = await getSupabaseAdminClient().from(table).select('slug').eq('business_id', businessId).eq('is_canonical', true).maybeSingle();
  if (result.error || !validBusinessSlug(result.data?.slug)) throw new Error('No se pudo consultar la dirección del negocio. Intenta nuevamente.');
  return result.data.slug as string;
}
