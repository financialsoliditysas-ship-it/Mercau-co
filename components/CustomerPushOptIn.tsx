'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import './order-changes.css';

export default function CustomerPushOptIn() {
  const [key,setKey]=useState(''),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const working=useRef(false);
  const [unsupported,setUnsupported]=useState(false);
  const api=useCallback(async (options:RequestInit={})=>{
    const client=getSupabaseBrowserClient(),session=client?(await client.auth.getSession()).data.session:null;
    if(!session)throw new Error('Entra nuevamente con tu cuenta.');
    const response=await fetch('/api/push/comprador',{...options,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`}});
    const body=await response.json();if(!response.ok)throw new Error(body.error||'No se pudo configurar el aviso.');return body;
  },[]);
  useEffect(()=>{
    let active=true;
    if(!window.isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){setUnsupported(true);return;}
    api().then(async config=>{
      if(!active||!config.available)return;setKey(config.publicKey);
      const registration=await navigator.serviceWorker.getRegistration('/'),subscription=await registration?.pushManager.getSubscription();
      if(subscription&&Notification.permission==='granted') {
        const status=await api({method:'POST',body:JSON.stringify({action:'status',endpoint:subscription.endpoint})});
        if(active)setEnabled(status.subscribed===true);
      }
    }).catch(()=>undefined);
    return()=>{active=false;};
  },[api]);
  async function toggle() {
    if(working.current)return;
    working.current=true;setBusy(true);setMessage('');
    try {
      // Permission must follow the tap, before asynchronous network work.
      const permission=enabled?Notification.permission:await Notification.requestPermission();
      if(permission!=='granted')throw new Error('Puedes consultar los cambios en Mis pedidos. Para recibir avisos, permite las notificaciones desde los ajustes del sitio.');
      const registration=await navigator.serviceWorker.register('/mercau-sw.js',{scope:'/'});
      const existing=await registration.pushManager.getSubscription();
      if(enabled) {
        if(existing)await api({method:'DELETE',body:JSON.stringify({endpoint:existing.endpoint})});
        // Restaurant notifications can share the same browser subscription.
        setEnabled(false);setMessage('Avisos de comprador desactivados en este dispositivo.');return;
      }
      const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4));
      const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});
      await api({method:'POST',body:JSON.stringify(subscription.toJSON())});setEnabled(true);setMessage('Avisos de tus pedidos activados en este dispositivo.');
    }catch(error){setMessage(error instanceof Error?error.message:'No se pudo activar el aviso. Consulta Mis pedidos.');}
    finally{setBusy(false);working.current=false;}
  }
  if(unsupported)return <aside className="customer-push-optin"><p>Consulta las novedades en Mis pedidos. En iPhone, agrega Mercáu a la pantalla de inicio y ábrelo desde su icono para activar los avisos en una versión compatible de iOS.</p><a href="/instalar">Cómo instalar Mercáu</a></aside>;
  if(!key)return null;
  return <aside className="customer-push-optin" aria-label="Avisos de tus pedidos"><strong>Recibe novedades de tu pedido</strong><p>Te avisaremos si el negocio propone un cambio. También lo encontrarás en Mis pedidos.</p><button type="button" disabled={busy} aria-pressed={enabled} onClick={toggle}>{busy?'Configurando...':enabled?'Desactivar avisos de comprador':'Activar notificaciones'}</button>{message&&<p role="status">{message}</p>}</aside>;
}
