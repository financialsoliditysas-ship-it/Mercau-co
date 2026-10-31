import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { loadPublicBusiness } from '@/lib/public-business';
import { publicCatalog } from '@/lib/business-catalog';
import { isFoodBusiness } from '@/lib/catalog-validation';
import { menuCover } from '@/lib/menu-cover';
import { GET as productPhoto } from '../[productId]/foto/route';
import { GET as businessPreview } from '../../og/route';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:{businessId:string}}) {
  const business=await loadPublicBusiness(params.businessId);
  if(!business)return new Response('Negocio no encontrado',{status:404});
  if(isFoodBusiness(business.category)) {
    try {
      const cover=menuCover(business,(await publicCatalog(business.id))?.products || []);
      const url=cover.imageUrl?new URL(cover.imageUrl,new URL(request.url).origin):null;
      const match=url?.pathname.match(/^\/api\/negocios\/(rec[A-Za-z0-9]{14})\/catalogo\/([a-f0-9-]{36})\/foto$/i);
      if(url&&match&&match[1]===business.id) {
        url.searchParams.set('w','960');
        const photo=await productPhoto(new NextRequest(url),{params:{businessId:business.id,productId:match[2]}});
        if(photo.ok) {
          const bytes=await sharp(Buffer.from(await photo.arrayBuffer())).rotate().resize(1200,630,{fit:'cover',position:'centre'}).jpeg({quality:85}).toBuffer();
          return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=60, s-maxage=300','X-Content-Type-Options':'nosniff'}});
        }
      }
    }catch{/* Use the existing public business image when a menu photograph cannot be read. */}
  }
  return businessPreview(request,{params:{businessId:business.id}});
}
