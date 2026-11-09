import { createHash } from 'crypto';
import { NextRequest,NextResponse } from 'next/server';
import { GET as authorizedDetails } from '../route';
import { validatePhoto } from '@/lib/business-photo';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic='force-dynamic';
const bucket='business-catalog';

function version(rows:{id:string;storage_path:string}[]) {
  return createHash('sha256').update(JSON.stringify(rows.map(row=>[row.id,row.storage_path]))).digest('hex');
}

export async function POST(request:NextRequest,context:{params:{businessId:string}}) {
  try {
    const access=await authorizedDetails(request,context);
    if (!access.ok) return access;
    const {business}=await access.json();
    const raw=await request.text();
    if (raw.length>2900000) return NextResponse.json({error:'La imagen es demasiado grande.'},{status:413});
    let body:Record<string,unknown>,upload:ReturnType<typeof validatePhoto>;
    try {body=JSON.parse(raw);upload=validatePhoto(body);}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Imagen inválida.'},{status:400});}

    const db=getSupabaseAdminClient();
    const current=await db.from('directory_business_media').select('id,storage_path').eq('business_id',business.id).eq('kind','logo').order('created_at');
    if(current.error)throw new Error('Media unavailable');
    if(current.data?.length&&body.photoVersion&&body.photoVersion!==version(current.data))return NextResponse.json({error:'La imagen cambió desde que abriste la ficha. Recarga antes de subir otra.'},{status:409});

    const bytes=Buffer.from(upload.file,'base64');
    const path=`businesses/${business.id}/logo/${upload.filename}`;
    const storage=db.storage.from(bucket);
    const saved=await storage.upload(path,bytes,{contentType:upload.contentType,upsert:false});
    if(saved.error){
      const existing=await storage.download(path);
      if(existing.error||!existing.data||!Buffer.from(await existing.data.arrayBuffer()).equals(bytes))throw new Error('Upload failed');
    }
    const repeated=current.data?.find(row=>row.storage_path===path);
    if(repeated)return NextResponse.json({ok:true,photoUrl:`/api/negocios/${business.id}/foto?source=supabase&v=${repeated.id}`,photoKind:body.kind==='logo'?'logo':'photo',photoVersion:version(current.data)});

    const demoted=await db.from('directory_business_media').update({position:1}).eq('business_id',business.id).eq('kind','logo');
    if(demoted.error)throw new Error('Media update failed');
    const inserted=await db.from('directory_business_media').insert({business_id:business.id,kind:'logo',storage_path:path,alt_text:`${body.kind==='logo'?'Logo':'Foto principal'} de ${business.name}`,position:0}).select('id,storage_path').single();
    if(inserted.error)throw new Error('Media confirmation failed');

    const obsolete=(current.data||[]).filter(row=>row.storage_path!==path);
    if(obsolete.length){
      await db.from('directory_business_media').delete().in('id',obsolete.map(row=>row.id));
      await storage.remove(obsolete.map(row=>row.storage_path));
    }
    return NextResponse.json({ok:true,photoUrl:`/api/negocios/${business.id}/foto?source=supabase&v=${inserted.data.id}`,photoKind:body.kind==='logo'?'logo':'photo',photoVersion:version([inserted.data])});
  }catch{return NextResponse.json({error:'No se pudo guardar la imagen en Supabase. Conserva el archivo e intenta nuevamente.'},{status:503});}
}
