import { NextRequest } from 'next/server';
import { GET as authorizedBusinessDetails } from '@/app/api/mi-negocio/[businessId]/route';
import { getSupabaseAdminClient } from './supabase-admin';
import { loadDirectoryBusiness } from './airtable-directory';
import { CatalogFields, CatalogProduct, catalogOptionGroups, sameCatalogFields } from './catalog-validation';

export const catalogBucket='business-catalog';
const columns='id,business_id,name,description,section,price,available,status,position,option_groups,version,image_path,updated_at';
type CatalogRow=Omit<CatalogFields,'optionGroups'> & {option_groups:CatalogFields['optionGroups'];id:string;business_id:string;version:number;image_path:string|null;updated_at:string};
export type PublicCatalogProduct=CatalogFields & {id:string;imageUrl?:string};
export class CatalogError extends Error { constructor(message:string,public status=400){super(message);} }
export async function catalogOwner(request:NextRequest,businessId:string) {
  const response=await authorizedBusinessDetails(request,{params:{businessId}});
  const result=await response.json();
  if(!response.ok)throw new CatalogError(result.error || 'No tienes acceso a este catálogo.',response.status);
  return result.business;
}
function databaseError() { return new CatalogError('No se pudo cargar o guardar el catálogo. Intenta nuevamente; si persiste, contacta a Mercáu.',503); }
export async function catalogProduct(businessId:string,id:string) {
  const {data,error}=await getSupabaseAdminClient().from('business_catalog_products').select(columns).eq('business_id',businessId).eq('id',id).maybeSingle();
  if(error)throw databaseError();
  if(!data)throw new CatalogError('Producto no encontrado.',404);
  return data;
}
export function publicProduct(row:CatalogRow):PublicCatalogProduct {
  const {name,description,section,price,available,status,position,id}=row;
  return {name,description,section,price,available,status,position,optionGroups:row.option_groups || [],id,imageUrl:row.image_path ? `/api/negocios/${row.business_id}/catalogo/${row.id}/foto?v=${row.version}` : undefined};
}
export async function ownerProduct(row:CatalogRow):Promise<CatalogProduct> {
  let imageUrl;
  if(row.image_path) {
    const {data,error}=await getSupabaseAdminClient().storage.from(catalogBucket).createSignedUrl(row.image_path,600);
    if(error)throw new CatalogError('El producto está guardado, pero no se pudo cargar su foto. Actualiza la lista.',503);
    imageUrl=data?.signedUrl;
  }
  return {...publicProduct({...row,image_path:null}),version:row.version,updated_at:row.updated_at,imageUrl};
}
export async function ownerProducts(businessId:string) {
  const rows=await catalogRows(businessId,false);
  const paths=rows.map(row=>row.image_path).filter((path):path is string=>Boolean(path));
  const urls=new Map<string,string>();
  if(paths.length) {
    const {data,error}=await getSupabaseAdminClient().storage.from(catalogBucket).createSignedUrls(paths,600);
    if(error)throw new CatalogError('No se pudieron cargar las fotos del catálogo. Intenta nuevamente.',503);
    (data || []).forEach(item=>{if(item.path && item.signedUrl)urls.set(item.path,item.signedUrl);});
  }
  return rows.map(row=>({...publicProduct({...row,image_path:null}),version:row.version,updated_at:row.updated_at,imageUrl:urls.get(row.image_path || '')}));
}
async function catalogRows(businessId:string,published:boolean) {
  const rows:CatalogRow[]=[];
  const db=getSupabaseAdminClient();
  for(let start=0;;start+=200) {
    let query=db.from('business_catalog_products').select(columns).eq('business_id',businessId);
    if(published)query=query.eq('status','published');
    const {data,error}=await query.order('position').order('created_at').range(start,start+199);
    if(error)throw databaseError();
    rows.push(...(data || []));
    if(!data || data.length<200)break;
  }
  return rows;
}
export async function publicCatalog(businessId:string) {
  const business=await loadDirectoryBusiness(businessId);
  if(!business)return null;
  return {business,products:(await catalogRows(businessId,true)).map(publicProduct)};
}
export async function createCatalogProduct(businessId:string,id:string,fields:CatalogFields) {
  const db=getSupabaseAdminClient();
  const {optionGroups,...plain}=fields;
  const {data,error}=await db.from('business_catalog_products').insert({id,business_id:businessId,...plain,option_groups:optionGroups}).select(columns).single();
  if(error?.code==='23505') {
    const existing=await catalogProduct(businessId,id);
    if(sameCatalogFields({...existing,optionGroups:existing.option_groups},fields))return ownerProduct(existing);
    throw new CatalogError('Este producto ya se guardó con otros datos. Recarga el catálogo.',409);
  }
  if(error)throw databaseError();
  return ownerProduct(data);
}
export async function updateCatalogProduct(businessId:string,id:string,version:number,fields:CatalogFields) {
  const existing=await catalogProduct(businessId,id);
  if(sameCatalogFields({...existing,optionGroups:existing.option_groups},fields))return ownerProduct(existing);
  const db=getSupabaseAdminClient();
  const {data:links,error:linksError}=await db.from('business_catalog_product_option_groups').select('group_id').eq('business_id',businessId).eq('product_id',id);
  if(linksError)throw databaseError();
  if(links?.length) {
    const linkedIds=links.map(link=>link.group_id);
    const {data:shared,error:sharedError}=await db.from('business_catalog_option_groups').select('id,group_data').eq('business_id',businessId).in('id',linkedIds).eq('active',true);
    if(sharedError)throw databaseError();
    const submitted=new Map(fields.optionGroups.map(group=>[group.id,group]));
    for(const row of shared || []) {
      const canonical=catalogOptionGroups([{...(row.group_data as object),id:row.id}])[0];
      if(JSON.stringify(submitted.get(row.id))!==JSON.stringify(canonical))throw new CatalogError('Este producto usa opciones compartidas. Edita sus nombres y precios desde la Biblioteca de opciones.',409);
    }
  }
  const {optionGroups,...plain}=fields;
  const {data,error}=await db.from('business_catalog_products').update({...plain,option_groups:optionGroups}).eq('business_id',businessId).eq('id',id).eq('version',version).select(columns).maybeSingle();
  if(error)throw databaseError();
  if(!data)throw new CatalogError('El producto cambió. Recarga antes de editarlo nuevamente.',409);
  return ownerProduct(data);
}
export async function setCatalogImage(businessId:string,id:string,version:number,path:string) {
  const {data,error}=await getSupabaseAdminClient().from('business_catalog_products').update({image_path:path}).eq('business_id',businessId).eq('id',id).eq('version',version).select(columns).maybeSingle();
  if(error)throw databaseError();
  if(!data)throw new CatalogError('El producto cambió. Recarga antes de guardar su foto.',409);
  return ownerProduct(data);
}
