import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { loadDirectoryBusiness, loadDirectoryBusinesses } from '@/lib/airtable-directory';
import { createCatalogProduct, updateCatalogProduct } from '@/lib/business-catalog';
import { draftRows } from '@/lib/admin-catalog-support';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const password = process.env.ADMIN_METRICS_PASSWORD;
  return Boolean(password && request.headers.get('x-admin-password') === password);
}

function importedProductId(businessId:string,productCode:string){
  const code=productCode.trim().toUpperCase();
  if(!/^[A-Z0-9_-]{1,40}$/.test(code))throw new Error(`El código ${productCode||'vacío'} no es válido.`);
  const hex=createHash('sha256').update(`${businessId}:${code}`).digest('hex').slice(0,32).split('');
  hex[12]='4';hex[16]=['8','9','a','b'][parseInt(hex[16],16)%4];
  return `${hex.slice(0,8).join('')}-${hex.slice(8,12).join('')}-${hex.slice(12,16).join('')}-${hex.slice(16,20).join('')}-${hex.slice(20).join('')}`;
}
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es-CO');

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    const businesses = await loadDirectoryBusinesses();
    const db = getSupabaseAdminClient();
    const [productsResult, ownersResult] = await Promise.all([
      db.from('business_catalog_products').select('business_id,status'),
      db.from('business_admins').select('business_id,status').eq('status', 'Activo')
    ]);
    if (productsResult.error || ownersResult.error) throw new Error('No se pudo consultar el estado de los catálogos.');
    const productCounts = new Map<string, { draft: number; published: number }>();
    for (const product of productsResult.data || []) {
      const counts = productCounts.get(product.business_id) || { draft: 0, published: 0 };
      if (product.status === 'draft') counts.draft += 1;
      if (product.status === 'published') counts.published += 1;
      productCounts.set(product.business_id, counts);
    }
    const owners = new Set((ownersResult.data || []).map(row => row.business_id));
    return NextResponse.json({ businesses: businesses.map(business => ({
      id: business.id,
      name: business.name,
      category: business.category,
      municipality: business.municipality,
      claimed: owners.has(business.id),
      ...(productCounts.get(business.id) || { draft: 0, published: 0 })
    })).sort((a, b) => a.name.localeCompare(b.name, 'es')) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron cargar los negocios.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    const body = await request.json();
    const businessId = String(body.businessId || '');
    const mode=body.mode==='update'?'update':'create';
    const business = await loadDirectoryBusiness(businessId);
    if (!business) return NextResponse.json({ error: 'El negocio seleccionado no existe o no está publicado.' }, { status: 404 });
    const db = getSupabaseAdminClient();
    const existing = await db.from('business_catalog_products').select('id,name,description,section,price,available,status,position,option_groups,version').eq('business_id', businessId).order('position', { ascending: true });
    if (existing.error) throw new Error('No se pudo consultar el catálogo actual.');
    const start = Math.max(-1,...(existing.data||[]).map(row=>Number(row.position))) + 1;
    const rawProducts=Array.isArray(body.products)?body.products:[];
    const rows = draftRows(rawProducts.map((row:Record<string,unknown>)=>({...row,id:importedProductId(businessId,String(row.productCode||''))})), start);
    const byId=new Map((existing.data||[]).map(row=>[row.id,row]));
    const byName=new Map<string,NonNullable<typeof existing.data>>();
    for(const product of existing.data||[]){const key=normalized(product.name);byName.set(key,[...(byName.get(key)||[]),product]);}
    let created=0,updated=0,unchanged=0;
    for (const row of rows){
      if(mode==='create'){await createCatalogProduct(businessId,row.id,row.fields);created+=1;continue;}
      const matches=byName.get(normalized(row.fields.name))||[];
      const current=byId.get(row.id)||(matches.length===1?matches[0]:null);
      if(matches.length>1&&!byId.has(row.id))throw new Error(`Hay más de un producto llamado ${row.fields.name}. Actualízalo individualmente.`);
      if(!current){await createCatalogProduct(businessId,row.id,row.fields);created+=1;continue;}
      const fields={...row.fields,status:current.status,position:current.position};
      const result=await updateCatalogProduct(businessId,current.id,current.version,fields);
      if(result.version===current.version)unchanged+=1;else updated+=1;
    }
    return NextResponse.json({ created,updated,unchanged,mode,business: { id: business.id, name: business.name } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron crear los borradores.' }, { status: 400 });
  }
}

