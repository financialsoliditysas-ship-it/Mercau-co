const pending=new Map<string,{until:number;result:Promise<boolean>}>();
export async function catalogBusinessPublic(businessId:string) {
  if(!/^rec[A-Za-z0-9]{14}$/.test(businessId))return false;
  const existing=pending.get(businessId);
  if(existing && existing.until>Date.now())return existing.result;
  const entry={until:Date.now()+10000,result:readPublication(businessId)};
  pending.set(businessId,entry);
  if(pending.size>128)pending.delete(pending.keys().next().value as string);
  return entry.result;
}
async function readPublication(businessId:string) {
  const key=process.env.AIRTABLE_API_KEY,base=process.env.AIRTABLE_BASE_ID,table=process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  if(!key || !base || !table)return false;
  try {
    const response=await fetch(`https://api.airtable.com/v0/${base}/${table}/${businessId}?returnFieldsByFieldId=true`,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
    if(!response.ok)return false;
    return ['Publicado','Verificado','Destacado'].includes((await response.json()).fields?.fldyyLYvoyMdiK13C);
  }catch{return false;}
}
