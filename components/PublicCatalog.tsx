"use client";
import { useEffect,useRef,useState } from 'react';
import type { CatalogFields } from '@/lib/catalog-validation';
import CatalogProductImage from './CatalogProductImage';
import { trackCommerceEvent } from '@/lib/commerce-tracking';
type Product=CatalogFields & {id:string;imageUrl?:string};
export default function PublicCatalog({products,phone,businessId,businessName,catalogPath,productLinksEnabled}:{products:Product[];phone:string;businessId:string;businessName:string;catalogPath:string;productLinksEnabled:boolean}) {
  const [section,setSection]=useState('');
  const viewed=useRef(false);
  useEffect(()=>{if(viewed.current)return;viewed.current=true;trackCommerceEvent('Menu visto','ViewContent',{businessId,businessName});},[businessId,businessName]);
  const sections=Array.from(new Set(products.map(p=>p.section).filter(Boolean)));
  const digits=phone.replace(/\D/g,'');const normalized=digits.length===10 && digits.startsWith('3')?`57${digits}`:digits;
  const visible=products.filter(product=>!section || product.section===section);
  const money=(price:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(price);
  return <section className="py-6">
    {sections.length>0 && <nav aria-label="Secciones del catálogo" className="mb-5 flex flex-wrap gap-2">{['',...sections].map(value=><button key={value} onClick={()=>setSection(value)} aria-pressed={section===value} className={`min-h-11 max-w-full break-words rounded-md border px-4 py-2 text-sm font-semibold ${section===value?'border-[#D82016] bg-[#FFF1F0] text-[#D82016]':'border-gray-300 bg-white'}`}>{value || 'Todo'}</button>)}</nav>}
    {!products.length && <p className="py-6 text-gray-600">Este negocio aún no ha publicado productos en su catálogo. Puedes consultar su oferta desde la ficha.</p>}
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map(product=><article key={product.id} className="min-w-0 overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden bg-gray-100"><CatalogProductImage name={product.name} imageUrl={product.imageUrl} /></div>
      <div className="p-4"><p className="text-xs text-gray-600">{product.section}</p><h2 className="mt-1 break-words text-xl font-bold">{product.name}</h2><p className="mt-2 break-words text-sm leading-6 text-gray-600">{product.description}</p><p className="mt-3 text-lg font-bold">{money(product.price)}</p>
        {!product.available?<p className="mt-3 min-h-11 content-center text-sm font-semibold text-gray-500">Agotado</p>:normalized && <a onClick={()=>trackCommerceEvent('Producto visto','ViewContent',{businessId,businessName,productId:product.id,productName:product.name,value:product.price})} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${normalized}?text=${encodeURIComponent(productLinksEnabled
          ? `Hola, vi este producto en el catálogo de ${businessName} en Mercáu:\n\n${product.name}\n${money(product.price)}\n\nhttps://www.mercau.co${catalogPath}/${product.id}\n\nQuiero consultar su disponibilidad.`
          : `Hola, vi ${product.name} (${money(product.price)}) en el catálogo de ${businessName} en Mercáu. Quiero consultar su disponibilidad.`)}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#D82016] px-3 py-2 text-center text-sm font-bold text-white">Consultar por WhatsApp</a>}
      </div>
    </article>)}</div>
  </section>;
}
