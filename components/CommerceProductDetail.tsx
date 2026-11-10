'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import CatalogProductImage from './CatalogProductImage';
import type {PublicCatalogProduct} from '@/lib/business-catalog';
import {readCommerceCart,writeCommerceCart} from '@/lib/commerce-cart';

const money=(value:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
export default function CommerceProductDetail({product,related,businessId,businessName,phone,url,catalogPath,commercePlan}:{product:PublicCatalogProduct;related:PublicCatalogProduct[];businessId:string;businessName:string;phone:string;url:string;catalogPath:string;commercePlan?:string}){
  const [variantId,setVariantId]=useState('');
  const [photo,setPhoto]=useState(product.imageUrl||product.galleryUrls[0]);
  const variant=product.variants.find(item=>item.id===variantId);
  const price=variant?.price??product.price;
  const canContact=product.available&&(!product.variants.length||Boolean(variant?.available));
  const message=useMemo(()=>`Hola, vi este ${product.publicationType==='service'?'servicio':'producto'} en el catálogo de ${businessName} en Mercáu:\n\n${product.name}${variant?`\nOpción: ${variant.label}`:''}\n${product.priceMode==='quote'?'Precio por cotizar':money(price)}\n\n${url}\n\nQuiero consultar su disponibilidad.`,[businessName,price,product,variant,url]);
  function add(){if(!canContact)return;const current=readCommerceCart().filter(item=>item.businessId===businessId);const key=(item:typeof current[number])=>item.productId===product.id&&item.variantId===variant?.id;const existing=current.find(key);writeCommerceCart([...current.filter(item=>!key(item)),{businessId,businessName,productId:product.id,name:product.name,variantId:variant?.id,variantLabel:variant?.label,unitPrice:price,quantity:(existing?.quantity||0)+1,imageUrl:product.imageUrl}]);}
  return <>
    <article className="mt-6 grid overflow-hidden rounded-md border bg-white md:grid-cols-[1.15fr_.85fr]">
      <div><div className="grid aspect-[4/3] place-items-center overflow-hidden bg-gray-100"><CatalogProductImage name={product.name} imageUrl={photo} original priority/></div>{product.galleryUrls.length>0&&<div className="flex gap-2 overflow-x-auto p-3">{[product.imageUrl,...product.galleryUrls].filter((item):item is string=>Boolean(item)).map((url,index)=><button key={url} onClick={()=>setPhoto(url)} aria-label={`Ver foto ${index+1} de ${product.name}`} className="h-16 w-20 shrink-0 overflow-hidden rounded-md border"><CatalogProductImage name={`${product.name} ${index+1}`} imageUrl={url}/></button>)}</div>}</div>
      <div className="flex flex-col p-5 sm:p-7"><p className="text-sm font-bold text-[#E21412]">{businessName}</p><h1 className="mt-2 break-words text-3xl font-black">{product.name}</h1><p className="mt-2 text-sm font-semibold text-slate-600">{product.subcategory||product.category||product.section}</p><p className="mt-5 text-3xl font-black">{product.priceMode==='quote'?'Cotizar':`${product.priceMode==='from'?'Desde ':''}${money(price)}`}</p><p className={`mt-2 text-sm font-bold ${canContact?'text-emerald-700':'text-slate-500'}`}>{canContact?'Disponible':'No disponible'}</p>
        {product.variants.length>0&&<label className="mt-5 grid gap-2 text-sm font-bold">Elige una opción<select className="min-h-12 rounded-md border px-3" value={variantId} onChange={e=>setVariantId(e.target.value)}><option value="">Selecciona</option>{product.variants.map(item=><option key={item.id} value={item.id} disabled={!item.available}>{item.label}{!item.available?' (agotado)':''}</option>)}</select></label>}
        {product.attributes.length>0&&<section className="mt-5"><h2 className="font-black">Características</h2><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{product.attributes.map(item=><div key={item.key} className="border-t py-2"><dt className="text-slate-500">{item.label}</dt><dd className="font-semibold">{item.value}</dd></div>)}</dl></section>}
        {product.description&&<section className="mt-5"><h2 className="font-black">Descripción</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{product.description}</p></section>}
        {['ventas','ventas_plus'].includes(commercePlan||'')?<button disabled={!canContact} onClick={add} className="mt-6 min-h-12 rounded-md bg-[#E21412] px-5 font-black text-white disabled:bg-slate-400">Agregar al carrito</button>:phone&&<a aria-disabled={!canContact} href={canContact?`https://wa.me/${phone}?text=${encodeURIComponent(message)}`:undefined} target="_blank" rel="noopener noreferrer" className={`mt-6 inline-flex min-h-12 items-center justify-center rounded-md px-5 text-center font-black text-white ${canContact?'bg-[#E21412]':'cursor-not-allowed bg-slate-400'}`}>Consultar por WhatsApp</a>}
      </div>
    </article>
    {related.length>0&&<section className="mt-8"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Más de {businessName}</h2><Link href={catalogPath} className="min-h-11 content-center font-bold text-[#E21412]">Ver todo</Link></div><div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-3">{related.map(item=><Link key={item.id} href={`${catalogPath}/${item.id}`} className="w-[calc(50%-6px)] shrink-0 snap-start overflow-hidden rounded-md border bg-white sm:w-48"><div className="aspect-[4/3] bg-slate-100"><CatalogProductImage name={item.name} imageUrl={item.imageUrl}/></div><div className="p-3"><h3 className="line-clamp-2 text-sm font-bold">{item.name}</h3><p className="mt-1 text-sm font-bold">{item.priceMode==='quote'?'Cotizar':money(item.price)}</p></div></Link>)}</div></section>}
  </>;
}
