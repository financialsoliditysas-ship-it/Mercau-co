import { NextRequest,NextResponse } from 'next/server';
import { photoAttachments, photoFieldId, safeAttachmentUrl } from '@/lib/business-photo';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
export const dynamic='force-dynamic';
export async function GET(_request:NextRequest,{params}:{params:{businessId:string}}) {
  if (!/^rec[A-Za-z0-9]{14}$/.test(params.businessId)) return new NextResponse(null,{status:404});
  try {
    if (_request.nextUrl.searchParams.get('source') === 'supabase') {
      const db = getSupabaseAdminClient();
      const business = await db.from('directory_businesses').select('status').eq('id', params.businessId).maybeSingle();
      if (business.error || !business.data || !['Destacado','Verificado','Publicado'].includes(business.data.status)) return new NextResponse(null,{status:404});
      const media = await db.from('directory_business_media').select('storage_path').eq('business_id', params.businessId).eq('kind', 'logo').order('position').order('created_at').limit(1).maybeSingle();
      if (media.error || !media.data?.storage_path) return new NextResponse(null,{status:404});
      const downloaded = await db.storage.from('business-catalog').download(media.data.storage_path);
      if (downloaded.error || !downloaded.data) return new NextResponse(null,{status:404});
      const contentType = downloaded.data.type || 'application/octet-stream';
      return new NextResponse(await downloaded.data.arrayBuffer(), { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' } });
    }

    const key=process.env.AIRTABLE_API_KEY,base=process.env.AIRTABLE_BASE_ID,table=process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
    if (!key || !base || !table) return new NextResponse(null,{status:503});
    const response=await fetch(`https://api.airtable.com/v0/${base}/${table}/${params.businessId}?returnFieldsByFieldId=true`,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
    if (!response.ok) return new NextResponse(null,{status:404});
    const {fields}=await response.json();
    if (!['Destacado','Verificado','Publicado'].includes(fields?.fldyyLYvoyMdiK13C)) return new NextResponse(null,{status:404});
    const requested=_request.nextUrl.searchParams.get('image');
    if(requested && !/^att[A-Za-z0-9]+$/.test(requested))return new NextResponse(null,{status:404});
    if(requested){const settings=await getSupabaseAdminClient().from('business_account_settings').select('data').eq('business_id',params.businessId).maybeSingle();if(settings.error)return new NextResponse(null,{status:503});if(settings.data?.data?.galleryHiddenIds?.includes(requested))return new NextResponse(null,{status:404});}
    const image=photoAttachments(fields?.[photoFieldId]).find(item=>(requested?item.id===requested:!/^mercau-(galeria|portada)-/.test(item.filename))&&/^image\/(jpeg|png|webp)$/i.test(item.type || ''));
    const url=image && safeAttachmentUrl(image.url);
    if (!url) return new NextResponse(null,{status:404});
    const redirect=NextResponse.redirect(url,302);
    redirect.headers.set('Cache-Control',requested?'no-store':'public, max-age=60');
    return redirect;
  }catch{return new NextResponse(null,{status:503});}
}
