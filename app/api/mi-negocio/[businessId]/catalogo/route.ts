import { NextRequest,NextResponse } from 'next/server';
import { catalogOwner,createCatalogProduct,ownerProducts,CatalogError } from '@/lib/business-catalog';
import { catalogBody,catalogFailure } from '@/lib/catalog-http';
import { catalogFields,validProductId } from '@/lib/catalog-validation';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { catalogSubcategories } from '@/lib/catalog-templates';
import { catalogProductLimit } from '@/lib/catalog-plan-limits';
export const dynamic='force-dynamic';
type Context={params: Promise<{businessId:string}>};
function permitted(fields:ReturnType<typeof catalogFields>,business:{category:string;secondaryCategories?:string[]}){const allowed=[business.category,...(business.secondaryCategories||[])];if(fields.category&&!allowed.includes(fields.category))throw new CatalogError('La categoría no está habilitada para este negocio.');if(fields.subcategory&&!catalogSubcategories(fields.category||business.category).includes(fields.subcategory))throw new CatalogError('La subcategoría no pertenece a la categoría elegida.');}
export async function GET(request:NextRequest, props:Context) {
  const params = await props.params;
  try {
    const business=await catalogOwner(request,params.businessId);
    const config=await getSupabaseAdminClient().from('pilot_restaurants').select('enabled,delivery_mode,commission_rate_bps,customer_markup_bps').eq('directory_business_id',business.id).maybeSingle();
    if(config.error)throw new CatalogError('No se pudo consultar la configuración comercial.',503);
    return NextResponse.json({business:{id:business.id,name:business.name,category:business.category,subcategory:business.subcategory||'',secondaryCategories:business.secondaryCategories||[]},products:await ownerProducts(business.id),orderConfig:config.data||null},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return catalogFailure(error);}
}
export async function POST(request:NextRequest, props:Context) {
  const params = await props.params;
  try {
    const business=await catalogOwner(request,params.businessId);
    const body=await catalogBody(request);
    if(!validProductId(body.id))throw new CatalogError('Identificador de producto inválido.');
    let fields;
    try{fields=catalogFields(body.fields);}catch(error){throw new CatalogError(error instanceof Error?error.message:'Revisa el producto.');}
    permitted(fields,business);
    const limit=catalogProductLimit(business.category,business.commercePlan);
    if(limit!==null){
      const count=await getSupabaseAdminClient().from('business_catalog_products').select('id',{count:'exact',head:true}).eq('business_id',business.id).neq('id',body.id);
      if(count.error)throw new CatalogError('No se pudo comprobar el límite del catálogo.',503);
      if((count.count||0)>=limit)throw new CatalogError(`El plan Presencia permite hasta ${limit} publicaciones. Elige otro plan para ampliar el catálogo.`,403);
    }
    return NextResponse.json({product:await createCatalogProduct(params.businessId,body.id,fields)},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(error){return catalogFailure(error);}
}
