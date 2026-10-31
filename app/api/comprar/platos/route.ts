import { NextResponse } from 'next/server';
import { discoverDishes } from '@/lib/dish-discovery';
import { directoryMunicipalities } from '@/data/directory';
import { publicReadCache } from '@/lib/public-read-cache';
const cached=publicReadCache<Awaited<ReturnType<typeof discoverDishes>>>(10000);
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const municipality = params.get('municipio') || '';
  const query = (params.get('q') || '').trim(), section = params.get('categoria') || '', cursor = params.get('cursor') || '';
  if (!directoryMunicipalities.some(value => value === municipality) || query.length > 80 || section.length > 120 || cursor.length > 1500)
    return NextResponse.json({ error: 'Revisa el municipio y la búsqueda.' }, { status: 400 });
  try { return NextResponse.json(await cached(JSON.stringify([municipality,query,section,cursor]),()=>discoverDishes({ municipality, query, section, cursor })), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'No pudimos cargar los platos. Intenta nuevamente.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
