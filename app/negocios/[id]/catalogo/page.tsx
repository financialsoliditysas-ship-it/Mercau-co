import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { loadPublicBusiness } from '@/lib/public-business';
import { businessCatalogPath, businessPath } from '@/lib/business-public-url';
import { publicCatalog } from '@/lib/business-catalog';
import PublicCatalog from '@/components/PublicCatalog';
import PilotBusinessNotice from '@/components/PilotBusinessNotice';
import BackToMyCatalog from '@/components/BackToMyCatalog';
import RestaurantPilot from '@/components/RestaurantPilot';
import { pilotRestaurant } from '@/lib/restaurant-pilot';
import { catalogNoun, isFoodBusiness } from '@/lib/catalog-validation';
import BusinessImage from '@/components/BusinessImage';
import CatalogShareActions from '@/components/CatalogShareActions';
import { Clock3, MapPin, Truck } from 'lucide-react';
import InstallMercau from '@/components/InstallMercau';
import {businessSiteUrl} from '@/lib/business-public-url';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:{id:string}}) {
  const business=await loadPublicBusiness(params.id);
  const description=business?.description || (business ? `Consulta ${catalogNoun(business.category).toLocaleLowerCase('es-CO')} de ${business.name} en Mercáu.` : 'Catálogo en Mercáu');
  const path=business ? businessCatalogPath(business) : '/';
  const image=business?new URL(`/api/negocios/${business.id}/og?v=${business.photoVersion||'1'}`,businessSiteUrl).href:new URL('/og-mercau.jpg',businessSiteUrl).href;
  return {title:business?`${business.name} | ${catalogNoun(business.category)} | Mercáu`:'Catálogo | Mercáu',description,
    ...(business?{alternates:{canonical:path},openGraph:{type:'website',locale:'es_CO',url:path,siteName:'Mercáu',title:`${business.name} en Mercáu`,description,images:[{url:image,width:1200,height:630,alt:`${catalogNoun(business.category)} de ${business.name} en Mercáu`}]},twitter:{card:'summary_large_image',title:`${business.name} en Mercáu`,description,images:[image]}}:{})};
}
export default async function BusinessCatalogPage({params}:{params:{id:string}}) {
  const business=await loadPublicBusiness(params.id);if(!business)notFound();
  if(business.publicSlug && params.id!==business.publicSlug)permanentRedirect(businessCatalogPath(business));
  let catalog,unavailable=false;
  try{catalog=await publicCatalog(business.id);}catch{unavailable=true;}
  let liveOrders = false;
  try { const restaurant = await pilotRestaurant(business.id); liveOrders = restaurant.is_live === true; } catch { /* Keep the catalog available when ordering is not configured. */ }
  const catalogPath=businessCatalogPath(business);
  const catalogUrl=`https://www.mercau.co${catalogPath}`;
  return <main className="min-h-screen bg-[#FCFBF9] text-[#1F2937]">
    <header className="border-b border-gray-200 bg-white px-4 py-3"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3"><Link href="/" className="flex items-center gap-2"><img src="/logo-mercau.png" alt="Mercáu" className="h-11 w-11 object-contain" /><span className="text-2xl font-black text-[#D82016]">Mercáu</span></Link><nav aria-label="Volver desde el catálogo" className="flex flex-wrap gap-2"><BackToMyCatalog businessId={business.id} /><Link href={businessPath(business)} className="inline-flex min-h-11 items-center rounded-md border border-gray-300 px-3 text-sm font-semibold">Volver a la ficha</Link></nav></div></header>
    <div className="mx-auto max-w-5xl px-4 py-5 sm:py-6"><section className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-4 border-b border-slate-200 pb-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-x-5 sm:pb-6">
      <div className="grid aspect-square w-[5.5rem] place-items-center overflow-hidden rounded-md border border-slate-200 bg-white sm:w-32"><BusinessImage name={business.name} photoUrl={business.photoUrl} photoKind={business.photoKind} className="h-full w-full" fallback={<span className="text-2xl font-black text-[#D82016] sm:text-3xl">{business.name.slice(0,2).toUpperCase()}</span>} /></div>
      <div className="min-w-0 self-center"><p className="text-xs font-bold text-[#D82016] sm:text-sm">{catalogNoun(business.category)}</p><h1 className="mt-1 break-words text-xl font-black leading-tight sm:text-3xl">{business.name}</h1>
        <p className="mt-1.5 line-clamp-3 max-w-3xl text-xs leading-5 text-slate-600 sm:mt-2 sm:text-sm sm:leading-6">{business.description || `Conoce la oferta de ${business.name} y consulta sus productos en Mercáu.`}</p>
      </div>
      <div className="col-span-2 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-700 sm:col-start-2 sm:mt-[-.5rem]"><span className="inline-flex items-center gap-2"><MapPin size={17} className="shrink-0 text-[#D82016]" />{business.neighborhood}, {business.municipality}</span>{business.hours&&<span className="inline-flex items-center gap-2"><Clock3 size={17} className="shrink-0 text-[#D82016]" />{business.hours}</span>}{business.deliveries&&<span className="inline-flex items-center gap-2"><Truck size={17} className="shrink-0 text-[#D82016]" />Domicilios: {business.deliveries}</span>}</div>
      <div className="col-span-2 flex flex-wrap gap-2 sm:col-start-2"><CatalogShareActions businessName={business.name} catalogUrl={catalogUrl} noun={catalogNoun(business.category)} /><InstallMercau prominent /></div>
    </section>
      {business.pilotRestaurant && <PilotBusinessNotice />}
      {liveOrders ? <RestaurantPilot embedded restaurantId={business.id} businessName={business.name} returnPath={catalogPath} /> : unavailable?<p role="status" className="mt-6 rounded-md bg-[#FFF1F0] p-4">No se pudo cargar el catálogo. Intenta nuevamente o consulta desde la ficha del negocio.</p>:<PublicCatalog products={catalog?.products || []} phone={business.whatsapp} businessId={business.id} businessName={business.name} catalogPath={catalogPath} productLinksEnabled={!isFoodBusiness(business.category)} />}
    </div>
  </main>;
}
