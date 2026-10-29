import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import CatalogProductImage from '@/components/CatalogProductImage';
import { publicCatalog } from '@/lib/business-catalog';
import { businessCatalogPath, businessPath } from '@/lib/business-public-url';
import { isFoodBusiness, validProductId } from '@/lib/catalog-validation';
import { loadPublicBusiness } from '@/lib/public-business';

export const dynamic = 'force-dynamic';
const siteUrl = 'https://www.mercau.co';
const money = (price:number) => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(price);

async function productData(id:string, productId:string) {
  if (!validProductId(productId)) return null;
  const business = await loadPublicBusiness(id);
  if (!business || isFoodBusiness(business.category)) return null;
  const catalog = await publicCatalog(business.id);
  const product = catalog?.products.find(item => item.id === productId && item.available);
  return product ? { business, product } : null;
}

export async function generateMetadata({params}:{params:{id:string;productId:string}}):Promise<Metadata> {
  const data = await productData(params.id, params.productId);
  if (!data) return { title: 'Producto no disponible | Mercáu', robots: { index: false, follow: false } };
  const { business, product } = data;
  const path = `${businessCatalogPath(business)}/${product.id}`;
  const description = `${product.name} por ${money(product.price)} en el catálogo de ${business.name} en Mercáu.`;
  const image = product.imageUrl ? new URL(product.imageUrl, siteUrl).toString() : new URL('/og-mercau.jpg', siteUrl).toString();
  return {
    title: `${product.name} | ${business.name} | Mercáu`, description,
    alternates: { canonical: path },
    openGraph: { type: 'website', locale: 'es_CO', siteName: 'Mercáu', title: product.name, description, url: path, images: [{ url: image, alt: product.name }] },
    twitter: { card: 'summary_large_image', title: product.name, description, images: [image] }
  };
}

export default async function CatalogProductPage({params}:{params:{id:string;productId:string}}) {
  const data = await productData(params.id, params.productId);
  if (!data) notFound();
  const { business, product } = data;
  if (business.publicSlug && params.id !== business.publicSlug) permanentRedirect(`${businessCatalogPath(business)}/${product.id}`);
  const digits = business.whatsapp.replace(/\D/g,'');
  const phone = digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
  const url = `${siteUrl}${businessCatalogPath(business)}/${product.id}`;
  const message = `Hola, vi este producto en el catálogo de ${business.name} en Mercáu:\n\n${product.name}\n${money(product.price)}\n\n${url}\n\nQuiero consultar su disponibilidad.`;
  return <main className="min-h-screen bg-[#FCFBF9] px-4 py-6 text-[#1F2937]">
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="flex items-center gap-2 font-black text-[#D82016]"><img src="/logo-mercau.png" alt="Mercáu" className="h-11 w-11 object-contain"/>Mercáu</Link><Link href={businessCatalogPath(business)} className="inline-flex min-h-11 items-center rounded-md border px-4 font-bold">Volver al catálogo</Link></header>
      <article className="mt-6 grid overflow-hidden rounded-lg border bg-white md:grid-cols-2">
        <div className="grid aspect-square place-items-center overflow-hidden bg-gray-100"><CatalogProductImage name={product.name} imageUrl={product.imageUrl} original priority/></div>
        <div className="flex flex-col p-5 sm:p-7"><p className="text-sm font-bold text-[#D82016]">{business.name}</p><h1 className="mt-2 break-words text-3xl font-black">{product.name}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{product.description}</p><p className="mt-5 text-3xl font-black">{money(product.price)}</p><p className="mt-2 text-sm text-slate-500">{product.section}</p>
          {phone && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-[#D82016] px-5 text-center font-black text-white">Consultar por WhatsApp</a>}
          <Link href={businessPath(business)} className="mt-3 text-center text-sm font-bold text-[#D82016]">Ver página del negocio</Link>
        </div>
      </article>
    </div>
  </main>;
}
