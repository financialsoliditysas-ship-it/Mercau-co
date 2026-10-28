import { loadPublicBusiness } from '@/lib/public-business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supportedImage = /^image\/(jpeg|png|webp)$/i;

async function loadImage(url: string) {
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    const contentType = response.headers.get('content-type')?.split(';')[0] || '';
    if (!response.ok || !supportedImage.test(contentType)) return null;
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) return null;
    return { bytes, contentType };
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: { businessId: string } }) {
  const business = await loadPublicBusiness(params.businessId);
  if (!business) return new Response('Negocio no encontrado', { status: 404 });

  const origin = new URL(request.url).origin;
  const businessLogo = business.photoUrl
    ? await loadImage(new URL(business.photoUrl, origin).href)
    : null;
  const image = businessLogo || await loadImage(new URL('/og-mercau.jpg', origin).href);
  if (!image) return new Response('Imagen no disponible', { status: 404 });

  return new Response(image.bytes, {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'Content-Disposition': `inline; filename="${business.id}-mercau"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
