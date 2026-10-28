import { randomBytes,randomUUID } from 'crypto';
import { getSupabaseAdminClient } from './supabase-admin';
import { pilotId,pilotMember,pilotRestaurant,pilotUser,PilotError,PilotProduct } from './restaurant-pilot';
import { catalogFields } from './catalog-validation';
import { catalogBucket } from './business-catalog';
import { isPilotBusinessNote,pilotBusinessName,pilotImageAllowed,pilotMarker,pilotProductUuid } from './pilot-directory-data';
import { validatePhoto } from './business-photo';

const field={name:'fldZAuId3Z7tmNg1y',status:'fldyyLYvoyMdiK13C',notes:'fldrZ1LUWRcvKklVQ',token:'fldSXi5dNYP1WaWKq'};
function config() {
  const key=process.env.AIRTABLE_API_KEY,base=process.env.AIRTABLE_BASE_ID,table=process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  if(!key || !base || !table)throw new PilotError('La publicación no está configurada.',503);
  return {url:`https://api.airtable.com/v0/${base}/${table}`,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}};
}
async function record(id:string) {
  const c=config();const response=await fetch(`${c.url}/${id}?returnFieldsByFieldId=true`,{headers:c.headers,cache:'no-store'});
  if(!response.ok)throw new PilotError('No se pudo consultar la ficha de prueba.',503);
  const data=await response.json();
  if(!isPilotBusinessNote(data.fields?.[field.notes]))throw new PilotError('Esta ficha no pertenece al piloto.',409);
  return data;
}
async function setPublished(id:string,visible:boolean) {
  await record(id);const c=config();
  const response=await fetch(`${c.url}/${id}`,{method:'PATCH',headers:c.headers,body:JSON.stringify({fields:{[field.status]:visible?'Publicado':'Inactivo'},typecast:true})});
  if(!response.ok)throw new PilotError('No se pudo cambiar la visibilidad de la ficha de prueba.',503);
}
export async function publicationManager(request:Request) {
  const user=await pilotUser(request);await pilotMember(user.id,true);
  if(!user.email_confirmed_at)throw new PilotError('Confirma tu correo para administrar la prueba.',401);
  return user;
}
export async function publicationStatus() {
  const r=await pilotRestaurant();
  const business=r.directory_business_id?await record(r.directory_business_id):null;
  return {businessId:r.directory_business_id || null,initialized:!!r.directory_initialized,visible:business?.fields?.[field.status]==='Publicado',enabled:r.enabled};
}
async function draftBusiness() {
  const c=config();
  const params=new URLSearchParams({returnFieldsByFieldId:'true',filterByFormula:`{Nombre del negocio} = '${pilotBusinessName}'`,pageSize:'100'});
  const search=await fetch(`${c.url}?${params}`,{headers:c.headers,cache:'no-store'});
  if(!search.ok)throw new PilotError('No se pudo comprobar la ficha existente.',503);
  const matches=(await search.json()).records?.filter((row:any)=>isPilotBusinessNote(row.fields?.[field.notes])) || [];
  if(matches.length>1)throw new PilotError('Hay más de una ficha de prueba. Revisa antes de publicar.',409);
  if(matches[0])return matches[0];
  const token=randomBytes(24).toString('base64url');
  const response=await fetch(c.url,{method:'POST',headers:c.headers,body:JSON.stringify({records:[{fields:{
    [field.name]:pilotBusinessName,[field.status]:'Pendiente',[field.notes]:JSON.stringify(pilotMarker),[field.token]:token,
    fldINHrjgKw2AATkZ:`https://www.mercau.co/actualizar/${token}`,
    fldnTNuAH1PTyItul:'Administración del piloto Mercáu',fldyp3od5rTBa74il:'Comida',fldovZfFsNdoL2007:'Comidas y bebidas',fldIoDN2fV4Fbo3di:'Comidas rápidas',
    fldAziT6B2rW6HcyT:'Nechí',fldzy7nwjlebys4w0:'Casco urbano · prueba coordinada',
    fldlAXHZlQY2PLtvX:'Restaurante ficticio para probar Mercáu. Hamburguesas, parrilla y malteadas con fotos y precios ilustrativos. No se prepara comida ni se cobra dinero. Los despachos de prueba con Shipday deben coordinarse.',
    fldGg2RLescrYR2Z6:'5:00 p. m. a 10:00 p. m. (referencia de prueba)',fldmIVPP97MTqrUfZ:'Consultar',fldOZnz4JnwxkLTYA:'Carga inicial demo'
  }}]})});
  if(!response.ok)throw new PilotError('No se pudo crear la ficha de prueba.',503);
  const created=(await response.json()).records?.[0];
  if(!created?.id)throw new PilotError('No se pudo confirmar la ficha de prueba. Actualiza antes de reintentar.',503);
  return record(created.id);
}
export async function initializePilotPublication(user:{id:string}) {
  const db=getSupabaseAdminClient(),key=randomUUID();
  const claim=await db.rpc('pilot_directory_claim',{p_key:key});
  if(claim.error)throw new PilotError('La preparación necesita el ajuste de base de datos.',503);
  if(!claim.data)throw new PilotError('La preparación está en curso. Espera y actualiza.',409);
  try {
    const r=await pilotRestaurant();
    if(r.directory_initialized)return publicationStatus();
    const business=r.directory_business_id?await record(r.directory_business_id):await draftBusiness();
    const businessId=business.id;
    const linked=await db.from('pilot_restaurants').update({directory_business_id:businessId}).eq('id',pilotId);
    if(linked.error)throw new PilotError('No se pudo asociar la ficha al piloto.',503);
    const access=await db.from('business_admins').upsert({user_id:user.id,business_id:businessId,business_name:pilotBusinessName,owner_name:'Administrador de prueba',owner_whatsapp:r.pickup_phone,status:'Activo',private_token:business.fields[field.token]},{onConflict:'user_id,business_id'});
    if(access.error)throw new PilotError('No se pudo asociar el panel a tu cuenta.',503);
    if(!Array.isArray(r.menu) || !r.menu.length)throw new PilotError('El menú de prueba está vacío.',409);
    const productIds:string[]=[];
    for(const product of r.menu as PilotProduct[]) {
      if(!pilotImageAllowed(product.image))throw new PilotError('Una foto del piloto necesita revisión.',409);
      const id=pilotProductUuid(businessId,product.id);productIds.push(id);
      const fields=catalogFields({name:product.name,description:'Producto de demostración. Foto y precio ilustrativos; no se prepara ni se cobra.',section:product.category,price:product.price,available:true,status:'draft',position:productIds.length-1});
      const insert=await db.from('business_catalog_products').insert({id,business_id:businessId,pilot_product_id:product.id,...fields});
      if(insert.error && insert.error.code!=='23505')throw new PilotError('No se pudo preparar el menú. Puedes reintentar.',503);
      const existing=await db.from('business_catalog_products').select('image_path,pilot_product_id').eq('id',id).eq('business_id',businessId).single();
      if(existing.error || existing.data?.pilot_product_id!==product.id)throw new PilotError('No se pudo comprobar el producto del piloto.',409);
      if(existing.data.image_path)continue;
      const image=await fetch(`https://www.mercau.co${product.image}`,{cache:'no-store'});
      if(!image.ok)throw new PilotError('No se pudo recuperar una foto del piloto. Puedes reintentar.',503);
      const bytes=Buffer.from(await image.arrayBuffer());
      const validated=validatePhoto({kind:'photo',requestId:id,file:bytes.toString('base64')});
      const path=`${businessId}/${id}/${validated.filename}`;
      const storage=db.storage.from(catalogBucket);
      const uploaded=await storage.upload(path,bytes,{contentType:validated.contentType,upsert:false});
      if(uploaded.error) {
        const prior=await storage.download(path);
        if(prior.error || !prior.data || !Buffer.from(await prior.data.arrayBuffer()).equals(bytes))throw new PilotError('No se pudo guardar una foto del piloto. Puedes reintentar.',503);
      }
      const attached=await db.from('business_catalog_products').update({image_path:path}).eq('id',id).eq('business_id',businessId).is('image_path',null);
      if(attached.error)throw new PilotError('No se pudo asociar una foto del piloto.',503);
    }
    const published=await db.from('business_catalog_products').update({status:'published'}).eq('business_id',businessId).in('id',productIds).eq('status','draft');
    if(published.error)throw new PilotError('No se pudo publicar el menú del piloto.',503);
    await setPublished(businessId,true);
    const completed=await db.from('pilot_restaurants').update({directory_initialized:true}).eq('id',pilotId);
    if(completed.error)throw new PilotError('La ficha está publicada, pero falta confirmar su preparación. Actualiza.',503);
    return publicationStatus();
  }finally {
    await db.from('pilot_restaurants').update({directory_setup_key:null,directory_setup_until:null}).eq('id',pilotId).eq('directory_setup_key',key);
  }
}
export async function setPilotVisibility(visible:boolean) {
  const r=await pilotRestaurant();
  if(!r.directory_initialized || !r.directory_business_id)throw new PilotError('Prepara primero la ficha de prueba.',409);
  // Stop new test requests before hiding. Showing does not dispatch any order.
  if(!visible) {
    const paused=await getSupabaseAdminClient().from('pilot_restaurants').update({enabled:false}).eq('id',pilotId);
    if(paused.error)throw new PilotError('No se pudo pausar la prueba.',503);
  }
  await setPublished(r.directory_business_id,visible);
  if(visible) {
    const resumed=await getSupabaseAdminClient().from('pilot_restaurants').update({enabled:true}).eq('id',pilotId);
    if(resumed.error)throw new PilotError('La ficha está visible, pero los pedidos siguen pausados.',503);
  }
  return publicationStatus();
}
