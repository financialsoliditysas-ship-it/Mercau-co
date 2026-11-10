import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import CommerceProductDetail from '@/components/CommerceProductDetail';
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
  return product && catalog ? { business, product, related:catalog.products.filter(item=>item.id!==product.id&&item.available).sort((a,b)=>Number(b.subcategory===product.subcategory)-Number(a.subcategory===product.subcategory)||Number(b.category===product.category)-Number(a.category===product.category)).slice(0,8) } : null;
}

export async function generateMetadata({params}:{params:{id:string;productId:string}}):Promise<Metadata> {
  const data = await productData(params.id, params.productId);
  if (!data) return { title: 'Producto no disponible | Mercáu', robots: { index: false, follow: false } };
  const { business, product, related } = data;
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
  const { business, product, related } = data;
  if (business.publicSlug && params.id !== business.publicSlug) permanentRedirect(`${businessCatalogPath(business)}/${product.id}`);
  const digits = business.whatsapp.replace(/\D/g,'');
  const phone = digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
  const url = `${siteUrl}${businessCatalogPath(business)}/${product.id}`;
  return <main className="min-h-screen bg-[#FCFBF9] px-4 py-6 text-[#1F2937]">
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="flex items-center gap-2 font-black text-[#D82016]"><img src="/logo-mercau.png" alt="Mercáu" className="h-11 w-11 object-contain"/>Mercáu</Link><Link href={businessCatalogPath(business)} className="inline-flex min-h-11 items-center rounded-md border px-4 font-bold">Volver al catálogo</Link></header>
      <CommerceProductDetail product={product} related={related} businessName={business.name} phone={phone} url={url} catalogPath={businessCatalogPath(business)}/>
      <Link href={businessPath(business)} className="mt-5 block text-center text-sm font-bold text-[#D82016]">Ver página del negocio</Link>
    </div>
  </main>;
}
