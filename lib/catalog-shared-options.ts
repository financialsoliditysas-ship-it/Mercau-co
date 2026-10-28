import { getSupabaseAdminClient } from './supabase-admin';
import { catalogOptionGroups, type CatalogOptionGroup } from './catalog-validation';
import { CatalogError } from './business-catalog';

export type SharedOptionGroup = CatalogOptionGroup & {version:number;active:boolean;productIds:string[]};

function validatedGroup(value:unknown,forcedId?:string) {
  const input=value as CatalogOptionGroup;
  return catalogOptionGroups([{...input,id:forcedId || input?.id}])[0];
}

export function mergeSharedGroup(groups:CatalogOptionGroup[],group:CatalogOptionGroup) {
  const index=groups.findIndex(item=>item.id===group.id);
  if(index<0) return [...groups,group];
  return groups.map(item=>item.id===group.id?group:item);
}

export function removeSharedGroup(groups:CatalogOptionGroup[],groupId:string) {
  return groups.filter(group=>group.id!==groupId);
}

async function syncGroup(businessId:string,group:CatalogOptionGroup) {
  const db=getSupabaseAdminClient();
  const {data:links,error:linksError}=await db.from('business_catalog_product_option_groups').select('product_id').eq('business_id',businessId).eq('group_id',group.id);
  if(linksError)throw new CatalogError('No se pudieron cargar los productos vinculados.',503);
  for(const link of links || []) {
    const {data:product,error}=await db.from('business_catalog_products').select('id,option_groups').eq('business_id',businessId).eq('id',link.product_id).maybeSingle();
    if(error)throw new CatalogError('No se pudo sincronizar una opción compartida.',503);
    if(product) {
      const groups=mergeSharedGroup(catalogOptionGroups(product.option_groups || []),group);
      const {error:updateError}=await db.from('business_catalog_products').update({option_groups:groups}).eq('business_id',businessId).eq('id',product.id);
      if(updateError)throw new CatalogError('No se pudo sincronizar una opción compartida.',503);
    }
  }
}

export async function listSharedGroups(businessId:string):Promise<SharedOptionGroup[]> {
  const db=getSupabaseAdminClient();
  const [{data:rows,error},{data:links,error:linkError}]=await Promise.all([
    db.from('business_catalog_option_groups').select('id,name,group_data,version,active').eq('business_id',businessId).eq('active',true).order('created_at'),
    db.from('business_catalog_product_option_groups').select('group_id,product_id').eq('business_id',businessId)
  ]);
  if(error || linkError)throw new CatalogError('No se pudo cargar la biblioteca de opciones.',503);
  return (rows || []).map(row=>{
    const group=validatedGroup(row.group_data,row.id);
    return {...group,name:row.name,version:row.version,active:row.active,productIds:(links || []).filter(link=>link.group_id===row.id).map(link=>link.product_id)};
  });
}

export async function createSharedGroup(businessId:string,value:unknown) {
  const group=validatedGroup(value);
  const db=getSupabaseAdminClient();
  const {data,error}=await db.from('business_catalog_option_groups').insert({id:group.id,business_id:businessId,name:group.name,group_data:group}).select('id,name,group_data,version,active').single();
  if(error?.code==='23505')throw new CatalogError('Ya existe un grupo compartido con ese nombre.',409);
  if(error)throw new CatalogError('No se pudo crear el grupo compartido.',503);
  return {...validatedGroup(data.group_data,data.id),name:data.name,version:data.version,active:data.active,productIds:[]};
}

export async function updateSharedGroup(businessId:string,id:string,version:number,value:unknown) {
  const group=validatedGroup(value,id);const db=getSupabaseAdminClient();
  const {data,error}=await db.from('business_catalog_option_groups').update({name:group.name,group_data:group,version:version+1,updated_at:new Date().toISOString()}).eq('business_id',businessId).eq('id',id).eq('version',version).eq('active',true).select('version').maybeSingle();
  if(error?.code==='23505')throw new CatalogError('Ya existe un grupo compartido con ese nombre.',409);
  if(error)throw new CatalogError('No se pudo actualizar el grupo compartido.',503);
  if(!data)throw new CatalogError('El grupo cambió. Actualiza la biblioteca antes de guardarlo.',409);
  await syncGroup(businessId,group);
  return listSharedGroups(businessId);
}

export async function setSharedGroupLink(businessId:string,productId:string,groupId:string,linked:boolean) {
  const db=getSupabaseAdminClient();
  const [{data:product,error:productError},{data:row,error:groupError}]=await Promise.all([
    db.from('business_catalog_products').select('id,option_groups').eq('business_id',businessId).eq('id',productId).maybeSingle(),
    db.from('business_catalog_option_groups').select('id,name,group_data').eq('business_id',businessId).eq('id',groupId).eq('active',true).maybeSingle()
  ]);
  if(productError || groupError)throw new CatalogError('No se pudo validar la asignación.',503);
  if(!product || !row)throw new CatalogError('Producto o grupo compartido no encontrado.',404);
  const current=catalogOptionGroups(product.option_groups || []);
  if(linked && !current.some(item=>item.id===groupId) && current.length>=8)throw new CatalogError('Este producto ya tiene 8 grupos de opciones.',409);
  const next=linked?mergeSharedGroup(current,validatedGroup(row.group_data,row.id)):removeSharedGroup(current,groupId);
  const {error:updateError}=await db.from('business_catalog_products').update({option_groups:next}).eq('business_id',businessId).eq('id',productId);
  if(updateError)throw new CatalogError('No se pudo actualizar el producto.',503);
  if(linked) {
    const {error:linkError}=await db.from('business_catalog_product_option_groups').upsert({business_id:businessId,product_id:productId,group_id:groupId},{onConflict:'product_id,group_id'});
    if(linkError)throw new CatalogError('El producto cambió, pero no se pudo guardar el vínculo.',503);
  } else {
    const {error:unlinkError}=await db.from('business_catalog_product_option_groups').delete().eq('business_id',businessId).eq('product_id',productId).eq('group_id',groupId);
    if(unlinkError)throw new CatalogError('El producto cambió, pero no se pudo retirar el vínculo.',503);
  }
  return listSharedGroups(businessId);
}
