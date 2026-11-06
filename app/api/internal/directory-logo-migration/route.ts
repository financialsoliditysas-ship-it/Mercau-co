import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const assets = [
  ['recXRpTxUmzbiZYLO', '/directory-logos/recXRpTxUmzbiZYLO.jpg', 'image/jpeg'],
  ['rece62hjPb3DM0l8P', '/directory-logos/rece62hjPb3DM0l8P.png', 'image/png'],
  ['recZQzu4If5VE0Egr', '/directory-logos/recZQzu4If5VE0Egr.jpg', 'image/jpeg'],
  ['recEJfgtRJtCdh4xS', '/directory-logos/recEJfgtRJtCdh4xS.png', 'image/png'],
  ['recJijPZH0koyAY3c', '/directory-logos/recJijPZH0koyAY3c.png', 'image/png'],
  ['recLhzizMbEgMN6gg', '/directory-logos/recLhzizMbEgMN6gg.jpg', 'image/jpeg'],
  ['recGLMhJYXTRE46st', '/directory-logos/recGLMhJYXTRE46st.png', 'image/png'],
  ['recUVIMp2TSDKQ79F', '/directory-logos/recUVIMp2TSDKQ79F.png', 'image/png'],
  ['recYpWUN69hNqECRt', '/directory-logos/recYpWUN69hNqECRt.jpg', 'image/jpeg']
] as const;

export async function POST(request: Request) {
  const token = process.env.DIRECTORY_LOGO_MIGRATION_TOKEN;
  if (!token || request.headers.get('x-directory-migration-token') !== token) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const db = getSupabaseAdminClient();
    const storage = db.storage.from('business-catalog');
    const rows: Array<{ business_id: string; kind: 'logo'; storage_path: string; position: number }> = [];

    for (const [businessId, assetPath, contentType] of assets) {
      const asset = await fetch(new URL(assetPath, request.url), { cache: 'no-store' });
      if (!asset.ok) throw new Error(`No se pudo leer el recurso ${businessId}.`);
      const storagePath = `business-media/${businessId}/logo.${contentType === 'image/png' ? 'png' : 'jpg'}`;
      const upload = await storage.upload(storagePath, Buffer.from(await asset.arrayBuffer()), {
        contentType,
        cacheControl: '31536000',
        upsert: true
      });
      if (upload.error) throw new Error(`No se pudo guardar el recurso ${businessId}.`);
      rows.push({ business_id: businessId, kind: 'logo', storage_path: storagePath, position: 0 });
    }

    const relation = await db.from('directory_business_media').upsert(rows, { onConflict: 'business_id,storage_path' });
    if (relation.error) throw new Error('Los archivos subieron, pero no se pudieron relacionar con las fichas.');
    return NextResponse.json({ uploaded: rows.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo completar la carga.' }, { status: 500 });
  }
}
