import { NextRequest,NextResponse } from 'next/server';
import { publicCatalog } from '@/lib/business-catalog';
import { catalogFailure } from '@/lib/catalog-http';
export const dynamic='force-dynamic';
export async function GET(_request:NextRequest,{params}:{params:{businessId:string}}) {
  try {
    const catalog=await publicCatalog(params.businessId);
    if(!catalog)return NextResponse.json({error:'Negocio no encontrado.'},{status:404});
    return NextResponse.json({products:catalog.products},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return catalogFailure(error);}
}
