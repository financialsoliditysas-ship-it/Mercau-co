import { NextResponse } from 'next/server';
import { GET as directory } from '@/app/api/negocios/route';
import { buyerPreviewBusinesses } from '@/data/buyer-preview';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (process.env.NODE_ENV === 'development' && process.env.MERCAU_BUYER_PREVIEW === '1') {
    return NextResponse.json({ businesses: buyerPreviewBusinesses, preview: true }, {headers:{'Cache-Control':'no-store'}});
  }
  return directory();
}
