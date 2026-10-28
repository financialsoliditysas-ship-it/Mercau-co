"use client";
import { ReactNode,useEffect,useState } from 'react';
export default function BusinessImage({name,photoUrl,photoKind,className='',fallback=null}:{name:string;photoUrl?:string;photoKind?:'photo'|'logo';className?:string;fallback?:ReactNode}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[photoUrl]);
  return photoUrl && !failed ? <img src={photoUrl} alt={`${photoKind==='logo'?'Logo':'Foto principal'} de ${name}`} loading="lazy" className={`${className} ${photoKind==='logo'?'object-contain bg-white p-2':'object-cover'}`} onError={()=>setFailed(true)} /> : <>{fallback}</>;
}
