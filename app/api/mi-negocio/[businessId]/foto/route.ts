import { NextRequest,NextResponse } from 'next/server';
import { GET as authorizedDetails } from '../route';
import { photoAttachments,photoDetails,photoFieldId,photoVersion,validatePhoto } from '@/lib/business-photo';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,context:{params:{businessId:string}}) {
  try {
    const access=await authorizedDetails(request,context);
    if (!access.ok) return access;
    const {business}=await access.json();
    const raw=await request.text();
    if (raw.length>2900000) return NextResponse.json({error:'La imagen es demasiado grande.'},{status:413});
    let body:Record<string,unknown>,upload:ReturnType<typeof validatePhoto>;
    try {body=JSON.parse(raw);upload=validatePhoto(body);}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Imagen inválida.'},{status:400});}
    const key=process.env.AIRTABLE_API_KEY,base=process.env.AIRTABLE_BASE_ID,table=process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
    if (!key || !base || !table) throw new Error('Configuration unavailable');
    const recordUrl=`https://api.airtable.com/v0/${base}/${table}/${business.id}?returnFieldsByFieldId=true`;
    const beforeResponse=await fetch(recordUrl,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
    if (!beforeResponse.ok) throw new Error('Record unavailable');
    const before=photoAttachments((await beforeResponse.json()).fields?.[photoFieldId]);
    let added=before.find(item=>item.filename===upload.filename);
    const withoutSelf=added ? before.filter(item=>item.id!==added?.id) : before;
    if (added && before[0]?.id===added.id) return NextResponse.json({ok:true,...photoDetails(business.id,before)});
    if (body.photoVersion!==photoVersion(withoutSelf)) return NextResponse.json({error:'La imagen cambió desde que abriste la ficha. Recarga antes de subir otra.'},{status:409});
    if (!added) {
      const response=await fetch(`https://content.airtable.com/v0/${base}/${business.id}/${photoFieldId}/uploadAttachment`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(upload)});
      if (!response.ok) throw new Error('Upload failed');
      added=photoAttachments((await response.json()).fields?.[photoFieldId]).find(item=>item.filename===upload.filename);
      if (!added) throw new Error('Upload not confirmed');
    }
    // Re-read to preserve attachments added since the first snapshot.
    const latestResponse=await fetch(recordUrl,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
    if (!latestResponse.ok) throw new Error('Upload not confirmed');
    const latest=photoAttachments((await latestResponse.json()).fields?.[photoFieldId]);
    const ordered=[added,...latest.filter(item=>item.id!==added?.id)];
    const reorder=await fetch(recordUrl,{method:'PATCH',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({fields:{[photoFieldId]:ordered.map(item=>({id:item.id}))}})});
    if (!reorder.ok) throw new Error('Primary image not confirmed');
    return NextResponse.json({ok:true,...photoDetails(business.id,ordered)});
  }catch{return NextResponse.json({error:'No se pudo confirmar la imagen. Recarga la ficha antes de reintentar; no se borraron las imágenes anteriores.'},{status:503});}
}
