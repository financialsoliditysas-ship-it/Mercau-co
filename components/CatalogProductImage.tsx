"use client";
import { useEffect,useState } from 'react';
export default function CatalogProductImage({name,imageUrl,contain=false}:{name:string;imageUrl?:string;contain?:boolean}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[imageUrl]);
  return imageUrl && !failed?<img src={imageUrl} alt={`Foto de ${name}`} loading="lazy" className={`h-full w-full ${contain?'object-contain':'object-cover'}`} onError={()=>setFailed(true)} />:<span className="grid h-full place-items-center text-sm text-gray-500">Sin foto</span>;
}
