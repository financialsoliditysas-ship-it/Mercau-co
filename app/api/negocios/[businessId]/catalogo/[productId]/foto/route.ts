import { NextRequest,NextResponse } from 'next/server';
import { catalogBucket,catalogProduct } from '@/lib/business-catalog';
import { catalogBusinessPublic } from '@/lib/catalog-business-public';
import { validProductId } from '@/lib/catalog-validation';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
export const dynamic='force-dynamic';
export async function GET(_request:NextRequest,{params}:{params:{businessId:string;productId:string}}) {
  try {
    if(!validProductId(params.productId))return new NextResponse(null,{status:404});
    const product=await catalogProduct(params.businessId,params.productId);
    if(product.status!=='published' || !product.image_path?.startsWith(`${params.businessId}/${params.productId}/`))return new NextResponse(null,{status:404});
    if(!await catalogBusinessPublic(params.businessId))return new NextResponse(null,{status:404});
    const {data,error}=await getSupabaseAdminClient().storage.from(catalogBucket).download(product.image_path);
    if(error || !data)return new NextResponse(null,{status:404});
    return new NextResponse(await data.arrayBuffer(),{headers:{'Content-Type':data.type || 'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return new NextResponse(null,{status:404});}
}
