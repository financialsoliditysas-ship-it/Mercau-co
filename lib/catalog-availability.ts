import { getSupabaseAdminClient } from './supabase-admin';
export type CatalogAvailability = {count:number;searchTerms:string[];coverImageUrl?:string};

export async function catalogBusinessAvailability(businessIds:string[]) {
  const found=new Map<string,CatalogAvailability>();
  if(!businessIds.length)return found;
  try {
    const db=getSupabaseAdminClient();
    for(let start=0;;start+=1000) {
      const {data,error}=await db.from('business_catalog_products').select('id,business_id,name,description,section,image_path,version,position').in('business_id',businessIds).eq('status','published').order('position').order('created_at').range(start,start+999);
      if(error)return found;
      for(const row of data || []) {
        const current=found.get(row.business_id) || {count:0,searchTerms:[]};
        current.count+=1;
        current.searchTerms.push(row.name,row.section,row.description);
        if(!current.coverImageUrl && row.image_path?.startsWith(`${row.business_id}/${row.id}/`))current.coverImageUrl=`/api/negocios/${row.business_id}/catalogo/${row.id}/foto?v=${row.version}`;
        found.set(row.business_id,current);
      }
      if(!data || data.length<1000)break;
    }
    for(const [businessId,value] of found)found.set(businessId,{count:value.count,searchTerms:Array.from(new Set(value.searchTerms.map(term=>String(term || '').trim()).filter(Boolean))).slice(0,120),coverImageUrl:value.coverImageUrl});
  }catch{return found;}
  return found;
}
export async function catalogBusinessIds(businessIds:string[]) {
  return new Set((await catalogBusinessAvailability(businessIds)).keys());
}
