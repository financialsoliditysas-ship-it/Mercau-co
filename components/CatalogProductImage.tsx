"use client";
import { useEffect,useState } from 'react';
import { catalogImageSources } from '@/lib/catalog-image-url';
export default function CatalogProductImage({name,imageUrl,contain=false,priority=false,original=false,sizes='(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw'}:{name:string;imageUrl?:string;contain?:boolean;priority?:boolean;original?:boolean;sizes?:string}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[imageUrl]);
  const sources=catalogImageSources(imageUrl,original);
  return imageUrl && !failed?<img {...sources} sizes={sources.srcSet?sizes:undefined} alt={`Foto de ${name}`} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" className={`h-full w-full ${contain?'object-contain':'object-cover'}`} onError={()=>setFailed(true)} />:<span className="grid h-full place-items-center text-sm text-gray-500">Sin foto</span>;
}
