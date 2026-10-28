import { NextRequest,NextResponse } from 'next/server';
import { catalogOwner,createCatalogProduct,ownerProducts,CatalogError } from '@/lib/business-catalog';
import { catalogBody,catalogFailure } from '@/lib/catalog-http';
import { catalogFields,validProductId } from '@/lib/catalog-validation';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
export const dynamic='force-dynamic';
type Context={params:{businessId:string}};
export async function GET(request:NextRequest,{params}:Context) {
  try {
    const business=await catalogOwner(request,params.businessId);
    const config=await getSupabaseAdminClient().from('pilot_restaurants').select('enabled,delivery_mode,commission_rate_bps,customer_markup_bps').eq('directory_business_id',business.id).maybeSingle();
    if(config.error)throw new CatalogError('No se pudo consultar la configuración comercial.',503);
    return NextResponse.json({business:{id:business.id,name:business.name,category:business.category},products:await ownerProducts(business.id),orderConfig:config.data||null},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return catalogFailure(error);}
}
export async function POST(request:NextRequest,{params}:Context) {
  try {
    await catalogOwner(request,params.businessId);
    const body=await catalogBody(request);
    if(!validProductId(body.id))throw new CatalogError('Identificador de producto inválido.');
    let fields;
    try{fields=catalogFields(body.fields);}catch(error){throw new CatalogError(error instanceof Error?error.message:'Revisa el producto.');}
    return NextResponse.json({product:await createCatalogProduct(params.businessId,body.id,fields)},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(error){return catalogFailure(error);}
}
