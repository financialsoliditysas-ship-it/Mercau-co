import { NextResponse } from 'next/server';
import { GET as directory } from '@/app/api/negocios/route';
import { buyerPreviewBusinesses } from '@/data/buyer-preview';
import { publicReadCache } from '@/lib/public-read-cache';
const cached=publicReadCache<unknown>(10000,1);
export const dynamic = 'force-dynamic';
export async function GET() {
  if (process.env.NODE_ENV === 'development' && process.env.MERCAU_BUYER_PREVIEW === '1') {
    return NextResponse.json({ businesses: buyerPreviewBusinesses, preview: true }, {headers:{'Cache-Control':'no-store'}});
  }
  try {
    const data=await cached('public-directory',async()=>{const response=await directory();if(!response.ok)throw Error('Directory unavailable');return response.json();});
    return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'No se pudo cargar el directorio.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
