import { getSupabaseAdminClient } from './supabase-admin';
export type CatalogAvailability = {count:number;searchTerms:string[]};

export async function catalogBusinessAvailability(businessIds:string[]) {
  const found=new Map<string,CatalogAvailability>();
  if(!businessIds.length)return found;
  try {
    const db=getSupabaseAdminClient();
    for(let start=0;;start+=1000) {
      const {data,error}=await db.from('business_catalog_products').select('business_id,name,description,section').in('business_id',businessIds).eq('status','published').range(start,start+999);
      if(error)return found;
      for(const row of data || []) {
        const current=found.get(row.business_id) || {count:0,searchTerms:[]};
        current.count+=1;
        current.searchTerms.push(row.name,row.section,row.description);
        found.set(row.business_id,current);
      }
      if(!data || data.length<1000)break;
    }
    for(const [businessId,value] of found)found.set(businessId,{count:value.count,searchTerms:Array.from(new Set(value.searchTerms.map(term=>String(term || '').trim()).filter(Boolean))).slice(0,120)});
  }catch{return found;}
  return found;
}
export async function catalogBusinessIds(businessIds:string[]) {
  return new Set((await catalogBusinessAvailability(businessIds)).keys());
}
