import { toDirectoryCategory, type DirectoryBusiness } from '@/data/directory';
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
};

type HoursRow = { business_id: string; schedule: { display?: string } | null };
type MediaRow = { business_id: string; kind: string; storage_path: string };

const publicStatuses = ['Verificado', 'Destacado', 'Publicado'];

export async function loadSupabaseDirectoryBusinesses(): Promise<DirectoryBusiness[] | null> {
  try {
    const db = getSupabaseAdminClient();
    const [businesses, hours, media] = await Promise.all([
      db.from('directory_businesses').select('id,name,category,municipality,neighborhood,description,whatsapp,instagram,facebook,maps_url,delivery_notes,status,source').in('status', publicStatuses).order('name'),
      db.from('directory_business_hours').select('business_id,schedule'),
      db.from('directory_business_media').select('business_id,kind,storage_path').eq('kind', 'logo').order('position').order('created_at')
    ]);
    if (businesses.error || hours.error || media.error) return null;
    if (!businesses.data?.length) return null;

    const hoursByBusiness = new Map((hours.data as HoursRow[]).map(row => [row.business_id, row.schedule?.display || '']));
    const mediaByBusiness = new Map<string, MediaRow>();
    for (const row of media.data as MediaRow[]) if (!mediaByBusiness.has(row.business_id)) mediaByBusiness.set(row.business_id, row);

    return (businesses.data as DirectoryRow[]).map(row => {
      const mediaRow = mediaByBusiness.get(row.id);
      const logoAsset = directoryLogoAsset(row.id);
      const pilotRestaurant = row.name.trim() === pilotBusinessName ? 'restaurante-mercado' as const : undefined;
      return {
        id: row.id,
        name: row.name,
        category: toDirectoryCategory(row.category),
        municipality: row.municipality as DirectoryBusiness['municipality'],
        neighborhood: row.neighborhood,
        description: row.description,
        hours: hoursByBusiness.get(row.id) || '',
        whatsapp: row.whatsapp,
        deliveries: row.delivery_notes,
        instagram: row.instagram,
        facebook: row.facebook,
        mapsUrl: row.maps_url,
        status: row.status as DirectoryBusiness['status'],
        source: row.source || 'Supabase',
        pilotRestaurant,
        photoUrl: mediaRow ? `/api/negocios/${row.id}/foto?source=supabase` : logoAsset?.url,
        photoKind: mediaRow ? 'logo' : logoAsset?.kind
      } satisfies DirectoryBusiness;
    });
  } catch {
    return null;
  }
}
