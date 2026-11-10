import { NextRequest,NextResponse } from 'next/server';
import { catalogBucket,catalogProduct } from '@/lib/business-catalog';
import { catalogBusinessPublic } from '@/lib/catalog-business-public';
import { validProductId } from '@/lib/catalog-validation';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { catalogImage,catalogImageWidth,catalogImageTag,imageTagMatches } from '@/lib/catalog-image';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(_request:NextRequest,{params}:{params:{businessId:string;productId:string}}) {
  try {
    if(!/^rec[A-Za-z0-9]{14}$/.test(params.businessId)||!validProductId(params.productId))return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
    const width=catalogImageWidth(_request.nextUrl.searchParams.get('w'));
    if(Number.isNaN(width))return new NextResponse(null,{status:400,headers:{'Cache-Control':'no-store'}});
    const [product,published]=await Promise.all([catalogProduct(params.businessId,params.productId),catalogBusinessPublic(params.businessId)]);
    const slot=Number(_request.nextUrl.searchParams.get('slot')||0);const gallery=Array.isArray(product.gallery)?product.gallery.filter((item):item is string=>typeof item==='string'):[];const path=slot>0?gallery[slot-1]:product.image_path;
    if(product.status!=='published' || !path?.startsWith(`${params.businessId}/${params.productId}/`))return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
    if(!published)return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
    const webp=Boolean(width&&_request.headers.get('accept')?.includes('image/webp'));
    const etag=catalogImageTag(params.businessId,params.productId,path,product.version,width,webp);
    const headers={'Cache-Control':'private, max-age=0, must-revalidate','ETag':etag,'Vary':'Accept','X-Content-Type-Options':'nosniff'};
    if(imageTagMatches(_request.headers.get('if-none-match'),etag))return new NextResponse(null,{status:304,headers});
    const image=await catalogImage(etag,async()=>{
      const {data,error}=await getSupabaseAdminClient().storage.from(catalogBucket).download(path);
      if(error || !data)throw new Error('Photo unavailable');
      return {bytes:Buffer.from(await data.arrayBuffer()),type:data.type || 'image/jpeg'};
    },width,webp);
    return new NextResponse(new Uint8Array(image.bytes),{headers:{...headers,'Content-Type':image.type}});
  }catch{return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});}
}
