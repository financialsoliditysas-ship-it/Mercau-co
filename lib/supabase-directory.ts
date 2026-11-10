import { toDirectoryCategory, type DirectoryBusiness, type DirectoryCategory } from '@/data/directory';
import { getSupabaseAdminClient } from './supabase-admin';
import { pilotBusinessName } from './pilot-directory-data';
import { directoryLogoAsset } from './directory-logo-assets';

type DirectoryRow = {
  id: string;
  name: string;
  category: string;
  municipality: string;
  neighborhood: string;
  description: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  maps_url: string;
  delivery_notes: string;
  status: string;
  source: string;
  subcategory:string;
  secondary_categories:string[];
  tags:string[];
  commerce_plan:'presencia'|'vitrina'|'ventas'|'ventas_plus'|null;
};

type HoursRow = { business_id: string; schedule: { display?: string } | null };
type MediaRow = { business_id: string; kind: string; storage_path: string };

const publicStatuses = ['Verificado', 'Destacado', 'Publicado'];

function toDirectoryBusiness(row: DirectoryRow, hours: Map<string, string>, media: Map<string, MediaRow>): DirectoryBusiness {
  const mediaRow = media.get(row.id);
  const logoAsset = directoryLogoAsset(row.id);
  const pilotRestaurant = row.name.trim() === pilotBusinessName ? 'restaurante-mercado' as const : undefined;
  return {
    id: row.id,
    name: row.name,
    category: toDirectoryCategory(row.category),
    subcategory: row.subcategory || undefined,
    secondaryCategories: (row.secondary_categories || []).map(toDirectoryCategory).filter((item):item is DirectoryCategory=>Boolean(item)),
    tags: row.tags || [],
    commercePlan: row.commerce_plan || undefined,
    municipality: row.municipality as DirectoryBusiness['municipality'],
    neighborhood: row.neighborhood,
    description: row.description,
    hours: hours.get(row.id) || '',
    whatsapp: row.whatsapp,
    deliveries: row.delivery_notes,
    instagram: row.instagram,
    facebook: row.facebook,
    mapsUrl: row.maps_url,
    status: row.status as DirectoryBusiness['status'],
    source: row.source || 'Supabase',
    pilotRestaurant,
    photoUrl: mediaRow ? `/api/negocios/${row.id}/foto?source=supabase` : row.source === 'mercau-test' ? '/demo-store/telefono-negro.jpg' : logoAsset?.url,
    photoKind: mediaRow ? 'logo' : row.source === 'mercau-test' ? 'photo' : logoAsset?.kind
  } satisfies DirectoryBusiness;
}

async function directoryMetadata(businessIds?: string[]) {
  const db = getSupabaseAdminClient();
  const [hours, media] = await Promise.all([
    (businessIds?.length
      ? db.from('directory_business_hours').select('business_id,schedule').in('business_id', businessIds)
      : db.from('directory_business_hours').select('business_id,schedule')),
    (businessIds?.length
      ? db.from('directory_business_media').select('business_id,kind,storage_path').eq('kind', 'logo').in('business_id', businessIds)
      : db.from('directory_business_media').select('business_id,kind,storage_path').eq('kind', 'logo'))
      .order('position').order('created_at')
  ]);
  if (hours.error || media.error) return null;
  const hoursByBusiness = new Map((hours.data as HoursRow[]).map(row => [row.business_id, row.schedule?.display || '']));
  const mediaByBusiness = new Map<string, MediaRow>();
  for (const row of media.data as MediaRow[]) if (!mediaByBusiness.has(row.business_id)) mediaByBusiness.set(row.business_id, row);
  return { hoursByBusiness, mediaByBusiness };
}

export async function loadSupabaseDirectoryBusinesses(): Promise<DirectoryBusiness[] | null> {
  try {
    const db = getSupabaseAdminClient();
    let businesses:any = await db.from('directory_businesses').select('id,name,category,subcategory,secondary_categories,tags,commerce_plan,municipality,neighborhood,description,whatsapp,instagram,facebook,maps_url,delivery_notes,status,source').in('status', publicStatuses).neq('source', 'mercau-test').order('name');
    if(businesses.error?.code==='42703')businesses=await db.from('directory_businesses').select('id,name,category,municipality,neighborhood,description,whatsapp,instagram,facebook,maps_url,delivery_notes,status,source').in('status', publicStatuses).neq('source', 'mercau-test').order('name');
    const metadata = await directoryMetadata();
    if (businesses.error || !metadata) return null;
    if (!businesses.data?.length) return null;
    return (businesses.data as DirectoryRow[]).map(row => toDirectoryBusiness(row, metadata.hoursByBusiness, metadata.mediaByBusiness));
  } catch {
    return null;
  }
}

export async function loadSupabaseDirectoryBusiness(id: string): Promise<DirectoryBusiness | null> {
  try {
    const db = getSupabaseAdminClient();
    let business:any = await db.from('directory_businesses').select('id,name,category,subcategory,secondary_categories,tags,commerce_plan,municipality,neighborhood,description,whatsapp,instagram,facebook,maps_url,delivery_notes,status,source').eq('id', id).in('status', publicStatuses).maybeSingle();
    if(business.error?.code==='42703')business=await db.from('directory_businesses').select('id,name,category,municipality,neighborhood,description,whatsapp,instagram,facebook,maps_url,delivery_notes,status,source').eq('id', id).in('status', publicStatuses).maybeSingle();
    if (business.error || !business.data) return null;
    const metadata = await directoryMetadata([id]);
    if (!metadata) return null;
    return toDirectoryBusiness(business.data as DirectoryRow, metadata.hoursByBusiness, metadata.mediaByBusiness);
  } catch {
    return null;
  }
}
