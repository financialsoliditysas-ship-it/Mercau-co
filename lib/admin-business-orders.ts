import { getSupabaseAdminClient } from './supabase-admin';
import { loadDirectoryBusiness,loadDirectoryBusinesses } from './airtable-directory';

export type BusinessOrderConfig={
  id:string;name:string;directory_business_id:string|null;enabled:boolean;is_live:boolean;
  delivery_mode:'MERCAU'|'OWN';delivery_fee:number;commission_rate_bps:number;customer_markup_bps:number;
  pickup_address:string;pickup_phone:string;directory_initialized:boolean;published_products:number;
};

export async function listBusinessOrderConfigs():Promise<BusinessOrderConfig[]> {
  const db=getSupabaseAdminClient();
  const restaurants=await db.from('pilot_restaurants').select('id,name,directory_business_id,enabled,is_live,delivery_mode,delivery_fee,commission_rate_bps,customer_markup_bps,pickup_address,pickup_phone,directory_initialized').order('name');
  if(restaurants.error)throw new Error('No se pudieron cargar los negocios con pedidos.');
  const ids=(restaurants.data||[]).map(row=>row.directory_business_id).filter(Boolean);
  const products=ids.length?await db.from('business_catalog_products').select('business_id').in('business_id',ids).eq('status','published').eq('available',true):{data:[],error:null};
  if(products.error)throw new Error('No se pudo comprobar el catálogo de los negocios.');
  const counts=new Map<string,number>();
  for(const product of products.data||[])counts.set(product.business_id,(counts.get(product.business_id)||0)+1);
  return (restaurants.data||[]).map(row=>({...row,published_products:counts.get(row.directory_business_id||'')||0})) as BusinessOrderConfig[];
}

export async function listPendingBusinessOrderConfigs(){
  const db=getSupabaseAdminClient();
  const [directory,configured]=await Promise.all([loadDirectoryBusinesses(),db.from('pilot_restaurants').select('directory_business_id')]);
  if(configured.error)throw new Error('No se pudo comprobar la configuración de pedidos.');
  const ids=new Set((configured.data||[]).map(row=>row.directory_business_id).filter(Boolean));
  return directory.filter(business=>!ids.has(business.id)).map(business=>({id:business.id,name:business.name,category:business.category,municipality:business.municipality,phone:business.whatsapp||''}));
}

export async function createBusinessOrderConfig(businessId:string){
  if(!/^rec[a-zA-Z0-9]{14}$/.test(businessId))throw new Error('Negocio inválido.');
  const business=await loadDirectoryBusiness(businessId);if(!business)throw new Error('La ficha no existe o no está publicada.');
  const db=getSupabaseAdminClient();
  const existing=await db.from('pilot_restaurants').select('id').eq('directory_business_id',businessId).maybeSingle();
  if(existing.error)throw new Error('No se pudo comprobar el negocio.');
  if(existing.data)return {id:existing.data.id,created:false};
  const created=await db.from('pilot_restaurants').insert({id:businessId,name:business.name,pickup_address:'',pickup_phone:business.whatsapp||'',enabled:false,is_live:true,directory_business_id:businessId,directory_initialized:true,delivery_mode:'MERCAU',delivery_fee:5000,commission_rate_bps:1500,customer_markup_bps:0,menu:[]}).select('id').single();
  if(created.error)throw new Error('No se pudo preparar el negocio para pedidos.');
  return {id:created.data.id,created:true};
}

function integer(value:unknown,min:number,max:number,label:string){
  const parsed=Number(value);if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new Error(`Revisa ${label}.`);return parsed;
}

export async function updateBusinessOrderConfig(id:string,input:Record<string,unknown>) {
  if(id!=='restaurante-mercado'&&!/^rec[a-zA-Z0-9]{14}$/.test(id))throw new Error('Negocio inválido.');
  const deliveryMode=String(input.delivery_mode||'');
  if(!['MERCAU','OWN'].includes(deliveryMode))throw new Error('Selecciona quién realiza la entrega.');
  const deliveryFee=integer(input.delivery_fee,0,100000,'el valor del domicilio');
  const commissionRate=integer(input.commission_rate_bps,0,3000,'la comisión total');
  const customerMarkup=integer(input.customer_markup_bps,0,commissionRate,'la parte asumida por el comprador');
  const pickupAddress=String(input.pickup_address||'').trim().slice(0,300);
  const pickupPhone=String(input.pickup_phone||'').replace(/[^\d+]/g,'').slice(0,24);
  if(typeof input.enabled!=='boolean')throw new Error('Revisa el estado de los pedidos.');
  const db=getSupabaseAdminClient();
  const current=await db.from('pilot_restaurants').select('id,directory_initialized,pickup_address,pickup_phone,directory_business_id').eq('id',id).maybeSingle();
  if(current.error||!current.data)throw new Error('Negocio no encontrado.');
  if(input.enabled){
    if(!current.data.directory_initialized||!current.data.directory_business_id)throw new Error('Primero vincula y publica la ficha del negocio.');
    if(!pickupPhone)throw new Error('Falta el teléfono operativo del negocio.');
    if(deliveryMode==='MERCAU'&&!pickupAddress)throw new Error('Falta la dirección de recogida para Mercáu.');
    const catalog=await db.from('business_catalog_products').select('id',{count:'exact',head:true}).eq('business_id',current.data.directory_business_id).eq('status','published').eq('available',true);
    if(catalog.error||!catalog.count)throw new Error('Publica al menos un producto disponible antes de abrir pedidos.');
  }
  const updated=await db.from('pilot_restaurants').update({enabled:input.enabled,delivery_mode:deliveryMode,delivery_fee:deliveryFee,
    commission_rate_bps:commissionRate,customer_markup_bps:customerMarkup,pickup_address:pickupAddress,pickup_phone:pickupPhone}).eq('id',id).select('id').single();
  if(updated.error)throw new Error('No se pudo guardar la configuración.');
  return {ok:true};
}
