"use client";
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function BackToMyCatalog({businessId}:{businessId:string}) {
  const [allowed,setAllowed]=useState(false);
  useEffect(()=>{
    const client=getSupabaseBrowserClient();
    if(!client)return;
    let active=true,revision=0;
    async function verify(token?:string) {
      const current=++revision;setAllowed(false);
      if(!token)return;
      try {
        const response=await fetch(`/api/mi-negocio/${businessId}`,{cache:'no-store',headers:{Authorization:`Bearer ${token}`}});
        if(active && current===revision)setAllowed(response.ok);
      }catch{if(active && current===revision)setAllowed(false);}
    }
    const {data}=client.auth.onAuthStateChange((_event,session)=>{void verify(session?.access_token);});
    return()=>{active=false;data.subscription.unsubscribe();};
  },[businessId]);
  if(!allowed)return null;
  return <Link href={`/mi-negocio/${businessId}/catalogo`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#D82016] bg-white px-3 py-2 text-center text-sm font-semibold text-[#D82016] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D82016]">Volver a mi catálogo</Link>;
}
