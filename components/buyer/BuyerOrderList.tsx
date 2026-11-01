'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, RefreshCw, X } from 'lucide-react';
import CustomerOrderCard from '@/components/CustomerOrderCard';
import { customerOrderProgress, type CustomerOrder } from '@/lib/customer-order-status';
import { latestChange } from '@/lib/order-changes-model';
import CustomerPushOptIn from '@/components/CustomerPushOptIn';

const money=(value:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
export default function BuyerOrderList({orders,error='',updatedAt='',onRefresh}:{orders:CustomerOrder[];error?:string;updatedAt?:string;onRefresh?:()=>void}){
  const [selectedId,setSelectedId]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement|null>(null);
  const openedFromLink=useRef('');
  const selected=orders.find(order=>order.public_id===selectedId);
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('pedido');if(id&&openedFromLink.current!==id&&orders.some(order=>order.public_id===id)){openedFromLink.current=id;setSelectedId(id);}},[orders]);
  useEffect(()=>{
    if(selected&&!dialog.current?.open)dialog.current?.showModal();
    else if(!selected&&dialog.current?.open)dialog.current.close();
  },[selected]);
  function close(){dialog.current?.close();setSelectedId('');requestAnimationFrame(()=>trigger.current?.focus());}
  return <>
    {orders.some(order=>order.changes!==undefined)&&<CustomerPushOptIn/>}
    <div className="buyer-order-list">{orders.map(order=>{
      const progress=customerOrderProgress(order),quantity=order.lines.reduce((sum,line)=>sum+line.quantity,0);
      const label=order.status==='rejected'?'El negocio no pudo aceptar tu pedido':progress.label;
      return <article className="buyer-order-summary" key={order.public_id} aria-label={`Pedido ${order.public_id}`}>
        <button type="button" aria-label={`Ver detalle del pedido ${order.public_id}`} onClick={event=>{trigger.current=event.currentTarget;setSelectedId(order.public_id);}}>
          <span className="buyer-order-summary-name">{order.restaurant_name||`Pedido ${order.public_id}`}</span>
          <span className="buyer-order-summary-meta">{order.public_id} · {new Date(order.created_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</span>
          <span className="buyer-order-summary-state">{latestChange(order.changes)?.status==='pending'?'El negocio propone un cambio · Revisa y responde':label}</span>
          <span className="buyer-order-summary-products">{quantity} producto{quantity===1?'':'s'} · {order.lines.map(line=>line.name).join(', ')}</span>
          <span className="buyer-order-summary-footer"><strong>{money(order.subtotal+order.delivery_fee)}</strong><span>Ver detalle<ChevronRight size={17} aria-hidden="true"/></span></span>
        </button>
      </article>;
    })}</div>
    <dialog ref={dialog} className="buyer-order-dialog" aria-labelledby="buyer-order-detail-title" onCancel={event=>{event.preventDefault();close();}} onClose={()=>{setSelectedId('');requestAnimationFrame(()=>trigger.current?.focus());}}>
      <div className="buyer-order-dialog-heading"><h2 id="buyer-order-detail-title">Detalle del pedido</h2><button type="button" onClick={close} aria-label="Cerrar detalle del pedido"><X size={23}/></button></div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        {updatedAt&&<p role="status">Última actualización: {new Date(updatedAt).toLocaleTimeString('es-CO',{timeZone:'America/Bogota'})}</p>}
        {onRefresh&&<button type="button" onClick={onRefresh} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 font-bold"><RefreshCw size={17} aria-hidden="true"/>Actualizar estado</button>}
        {error&&<p role="alert" className="w-full text-[#B91C1C]">{error}</p>}
      </div>
      {selected&&<CustomerOrderCard order={selected} visual/>}
    </dialog>
  </>;
}
