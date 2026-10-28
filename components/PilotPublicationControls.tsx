"use client";
import { useCallback,useEffect,useState } from 'react';
type Publication={businessId:string|null;initialized:boolean;visible:boolean;enabled:boolean};
export default function PilotPublicationControls({accessToken}:{accessToken:string}) {
  const [state,setState]=useState<Publication|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const api=useCallback(async(method='GET',body?:unknown)=>{
    const response=await fetch('/api/piloto/restaurante/publicacion',{method,cache:'no-store',headers:{Authorization:`Bearer ${accessToken}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok)throw new Error(result.error || 'No se pudo comprobar la publicación.');return result;
  },[accessToken]);
  useEffect(()=>{let active=true;api().then(result=>{if(active)setState(result);}).catch(error=>{if(active)setNotice(error.message);});return()=>{active=false;};},[api]);
  async function change(initialize=false) {
    setBusy(true);setNotice(initialize?'Preparando ficha, menú y fotos...':'Actualizando visibilidad...');
    try {
      const result=initialize?await api('POST'):await api('PATCH',{visible:!state?.visible});setState(result);
      setNotice(initialize?'Ficha de prueba preparada y publicada. No se creó ningún pedido.':result.visible?'Ficha de prueba visible.':'Ficha de prueba oculta y pedidos de prueba pausados.');
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo confirmar el cambio. Actualiza antes de reintentar.');}finally{setBusy(false);}
  }
  return <section className="pilot-orders" aria-label="Publicación de la prueba"><h2>Restaurante de prueba en el directorio</h2>
    {state && <><p>{state.initialized?(state.visible?'Visible en el directorio':'Oculto del directorio'):'Ficha del directorio pendiente de preparar'}</p>
      <button disabled={busy} className="pilot-primary" onClick={()=>change(!state.initialized)}>{busy?'Procesando...':!state.initialized?'Preparar y publicar restaurante de prueba':state.visible?'Ocultar prueba del directorio':'Mostrar prueba en el directorio'}</button>
      {state.initialized && state.businessId && <div className="mt-3 flex flex-wrap gap-3"><a className="inline-flex min-h-11 items-center font-bold text-[#D82016] underline" href={`/negocios/${state.businessId}`}>Ver ficha</a><a className="inline-flex min-h-11 items-center font-bold text-[#D82016] underline" href={`/negocios/${state.businessId}/catalogo`}>Ver menú</a><a className="inline-flex min-h-11 items-center font-bold text-[#D82016] underline" href={`/mi-negocio/${state.businessId}/catalogo`}>Mi catálogo</a></div>}
    </>}
    {notice && <p role="status" className="pilot-notice">{notice}</p>}
  </section>;
}
