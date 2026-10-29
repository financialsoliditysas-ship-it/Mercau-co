'use client';
import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { Home, ReceiptText, Search, UserRound } from 'lucide-react';
import './buyer.css';

export function BuyerHeader(){
  return <header className="buyer-header"><Link href="/comprar" aria-label="Mercáu Inicio"><img src="/logo-mercau.png" alt="" width="42" height="42"/><strong>Mercáu</strong></Link><Link href="/comprar/cuenta" aria-label="Mi cuenta"><UserRound size={24}/></Link></header>;
}
export const BuyerNavigation=forwardRef<HTMLElement,{section:string}>(function BuyerNavigation({section},ref){
  const links=[
    {href:'/comprar',name:'Inicio',icon:Home,active:section==='inicio'},
    {href:'/comprar/explorar',name:'Explorar',icon:Search,active:['explorar','restaurantes','comercios','favoritos'].includes(section)},
    {href:'/comprar/pedidos',name:'Mis pedidos',icon:ReceiptText,active:section==='pedidos'},
    {href:'/comprar/cuenta',name:'Mi cuenta',icon:UserRound,active:section==='cuenta'},
  ];
  return <nav ref={ref} className="buyer-bottom" aria-label="Navegación del comprador">{links.map(item=><Link key={item.href} href={item.href} aria-current={item.active?'page':undefined}><item.icon size={23}/><span>{item.name}</span></Link>)}</nav>;
});
export function BuyerProfileFrame({children}:{children:ReactNode}){
  const bottom=useRef<HTMLElement>(null);
  useEffect(()=>{
    const nav=bottom.current;if(!nav)return;
    const observer=new ResizeObserver(()=>nav.closest<HTMLElement>('.buyer-app')?.style.setProperty('--buyer-nav-height',`${nav.getBoundingClientRect().height}px`));
    observer.observe(nav);return()=>observer.disconnect();
  },[]);
  return <div className="buyer-app ma buyer-profile-shell"><BuyerHeader/><main className="buyer-content buyer-profile-content">{children}</main><BuyerNavigation ref={bottom} section="cuenta"/></div>;
}
