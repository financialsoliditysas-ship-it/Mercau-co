import { photoAttachments,photoFieldId,validatePhoto,safeAttachmentUrl } from './business-photo';
import { getSupabaseAdminClient } from './supabase-admin';
import { AccountError } from './account-server';

export const galleryLimit=8;
const bucket='business-catalog';
export type GalleryPhoto={id:string;kind:'cover'|'gallery';url:string;hidden:boolean};

async function hiddenIds(businessId:string) {
  const settings=await getSupabaseAdminClient().from('business_account_settings').select('data').eq('business_id',businessId).maybeSingle();
  if(settings.error)throw Error('Gallery configuration unavailable');
  return Array.isArray(settings.data?.data?.galleryHiddenIds)?settings.data.data.galleryHiddenIds:[];
}

async function legacyGallery(businessId:string,hidden:string[]):Promise<GalleryPhoto[]> {
  const key=process.env.AIRTABLE_API_KEY,base=process.env.AIRTABLE_BASE_ID,table=process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  if(!key||!base||!table)return [];
  const record=await fetch(`https://api.airtable.com/v0/${base}/${table}/${businessId}?returnFieldsByFieldId=true`,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
  if(!record.ok)return [];
  const {fields}=await record.json();
  return photoAttachments(fields?.[photoFieldId]).filter(item=>/^mercau-(galeria|portada)-/.test(item.filename)&&safeAttachmentUrl(item.url)).map(item=>({id:item.id,kind:item.filename.startsWith('mercau-portada-')?'cover':'gallery',url:`/api/negocios/${businessId}/foto?image=${item.id}`,hidden:hidden.includes(item.id)}));
}

export async function businessGallery(businessId:string,owner=false):Promise<GalleryPhoto[]> {
  const db=getSupabaseAdminClient();
  const [media,hidden]=await Promise.all([
    db.from('directory_business_media').select('id,kind,storage_path,position,created_at').eq('business_id',businessId).in('kind',['cover','gallery']).order('position').order('created_at'),
    hiddenIds(businessId)
  ]);
  if(media.error)throw Error('Gallery unavailable');
  const stored=(media.data||[]).map(row=>({id:row.id,kind:row.kind as 'cover'|'gallery',url:`/api/negocios/${businessId}/foto?source=supabase&image=${row.id}`,hidden:hidden.includes(row.id)}));
  const photos=[...stored,...await legacyGallery(businessId,hidden)];
  if(owner)return photos;
  const visible=photos.filter(photo=>!photo.hidden),cover=visible.filter(photo=>photo.kind==='cover').at(-1);
  return [...(cover?[cover]:[]),...visible.filter(photo=>photo.kind==='gallery').slice(0,galleryLimit)];
}

export async function addGalleryPhoto(businessId:string,body:Record<string,unknown>) {
  const kind=String(body.kind);
  if(!['cover','gallery'].includes(kind))throw new AccountError('Selecciona portada o galería.');
  let upload:ReturnType<typeof validatePhoto>;
  try{upload=validatePhoto({...body,kind:'photo'});}catch{throw new AccountError('Selecciona una imagen JPG, PNG o WebP de hasta 2 MB.');}
  const photos=await businessGallery(businessId,true);
  if(kind==='gallery'&&photos.filter(photo=>photo.kind==='gallery'&&!photo.hidden).length>=galleryLimit)throw new AccountError(`Puedes mostrar hasta ${galleryLimit} fotos en la galería. Oculta una antes de agregar otra.`);
  upload.filename=upload.filename.replace('mercau-foto-',kind==='cover'?'mercau-portada-':'mercau-galeria-');
  const db=getSupabaseAdminClient(),storage=db.storage.from(bucket),path=`businesses/${businessId}/${kind}/${upload.filename}`,bytes=Buffer.from(upload.file,'base64');
  const saved=await storage.upload(path,bytes,{contentType:upload.contentType,upsert:false});
  if(saved.error){const existing=await storage.download(path);if(existing.error||!existing.data||!Buffer.from(await existing.data.arrayBuffer()).equals(bytes))throw new AccountError('No se pudo subir la foto. Conserva el archivo e intenta nuevamente.',503);}
  const duplicate=await db.from('directory_business_media').select('id').eq('business_id',businessId).eq('storage_path',path).maybeSingle();
  if(duplicate.error)throw new AccountError('No se pudo confirmar la foto.',503);
  if(!duplicate.data){
    const inserted=await db.from('directory_business_media').insert({business_id:businessId,kind,storage_path:path,alt_text:kind==='cover'?'Portada del negocio':'Foto de galería',position:Math.min(photos.length,10000)});
    if(inserted.error)throw new AccountError('No se pudo confirmar la foto.',503);
  }
  return businessGallery(businessId,true);
}
