"use client";
import { FormEvent, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { BusinessEdit } from '@/lib/business-edit';
import BusinessPhotoUploader from './BusinessPhotoUploader';
import { directoryCategories,directoryMunicipalities } from '@/data/directory';
import { ExternalLink, LocateFixed, RotateCcw } from 'lucide-react';

const initial: BusinessEdit = {description:'',neighborhood:'',hours:'',deliveries:'Consultar',instagram:'',facebook:'',mapsUrl:'',name:'',municipality:'',category:'',subcategory:'',secondaryCategories:[],tags:[],whatsapp:''};
export default function BusinessEditor({ businessId, onSaved, onSaveAndContinue, onCancel, onPhotoUpdated, section }: { businessId:string; onSaved:()=>void; onSaveAndContinue?:()=>void; onCancel:()=>void; onPhotoUpdated?:()=>void; section?:'information'|'photos'|'hours'|'contact'|'deliveries'|'categories' }) {
  const [photo,setPhoto] = useState<{photoUrl?:string;photoKind?:'photo'|'logo';photoVersion?:string}>({});
  const [values,setValues] = useState(initial);
  const [name,setName] = useState('');
  const [phone,setPhone] = useState('');
  const [version,setVersion] = useState('');
  const [requestId,setRequestId] = useState('');
  const [ready,setReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [locating,setLocating] = useState(false);
  const [locationStatus,setLocationStatus] = useState('');
  const [notice,setNotice] = useState('');
  const [loaded,setLoaded] = useState(0);
  const continueAfterSave=useRef(false);
  useEffect(() => {
    let active = true;
    setReady(false);setNotice('Cargando ficha...');
    async function load() {
      const client = getSupabaseBrowserClient();
      const session = client ? (await client.auth.getSession()).data.session : null;
      if (!session) throw new Error('Entra a tu cuenta para editar.');
      const response = await fetch(`/api/mi-negocio/${businessId}`,{cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`}});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar la ficha.');
      if (!active) return;
      setPhoto({photoUrl:result.business.photoUrl,photoKind:result.business.photoKind,photoVersion:result.business.photoVersion});
      setValues(Object.fromEntries(Object.entries(initial).map(([key,fallback]) => [key, result.business[key] ?? fallback])) as BusinessEdit);
      setName(result.business.name);setPhone(result.business.whatsapp);setVersion(result.version);setRequestId(crypto.randomUUID());setReady(true);setNotice('');
    }
    load().catch(error=>{if(active)setNotice(error.message);});
    return ()=>{active=false;};
  },[businessId,loaded]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setNotice('Guardando cambios...');
    try {
      const client = getSupabaseBrowserClient();
      const session = client ? (await client.auth.getSession()).data.session : null;
      if (!session) throw new Error('Tu sesión terminó. Entra nuevamente.');
      const response = await fetch(`/api/mi-negocio/${businessId}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({changes:values,version,requestId})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar.');
      onSaved();
      if(continueAfterSave.current)onSaveAndContinue?.();
    } catch(error) { setNotice(error instanceof Error ? error.message : 'No se pudo confirmar el guardado. Conserva los datos e intenta nuevamente.'); }
    finally { continueAfterSave.current=false;setBusy(false); }
  }
  function change(key:keyof BusinessEdit,value:string|string[]) { setValues(current=>({...current,[key]:value}));setRequestId(crypto.randomUUID()); }
  function captureBusinessLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Este navegador no permite obtener la ubicación. Puedes pegar el enlace de Google Maps manualmente.');
      return;
    }
    setLocating(true);setLocationStatus('Buscando la ubicación actual del negocio...');
    navigator.geolocation.getCurrentPosition(({coords}) => {
      const latitude = Number(coords.latitude.toFixed(7));
      const longitude = Number(coords.longitude.toFixed(7));
      change('mapsUrl',`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`);
      setLocationStatus(coords.accuracy > 50
        ? `Ubicación guardada con una precisión aproximada de ${Math.round(coords.accuracy)} metros. Revisa el punto antes de guardar.`
        : 'Ubicación guardada. Revisa el punto antes de guardar los cambios.');
      setLocating(false);
    }, error => {
      const messages:Record<number,string> = {
        1:'No autorizaste el acceso a la ubicación. Puedes pegar el enlace de Google Maps manualmente.',
        2:'El teléfono no pudo determinar la ubicación. Intenta nuevamente en un lugar abierto.',
        3:'La ubicación tardó demasiado. Intenta nuevamente.'
      };
      setLocationStatus(messages[error.code] || 'No se pudo obtener la ubicación. Intenta nuevamente o pega el enlace de Google Maps.');
      setLocating(false);
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
  function clearBusinessLocation() {
    change('mapsUrl','');setLocationStatus('Ubicación eliminada. Guarda los cambios para actualizar la ficha.');
  }
  const field = 'min-h-12 min-w-0 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#D82016]';
  return <div className="mt-5 border-t border-gray-200 pt-5">
    <h3 className="text-xl font-bold">Editar ficha{name ? `: ${name}` : ''}</h3>
    {ready && <><p className="mt-2 text-sm text-gray-600">WhatsApp principal: {phone}. Los cambios de propietario o administrador requieren revisión de Mercáu.</p>
    {(!section||section==='photos')&&<BusinessPhotoUploader businessId={businessId} name={name} photo={photo} onUploaded={updated=>{setPhoto(updated);onPhotoUpdated?.();}} />}
    {section!=='photos'&&<form onSubmit={save} className="mt-4 grid gap-4">
      {(!section||section==='information')&&<><label className="grid gap-2 text-sm font-semibold">Nombre comercial<input required maxLength={120} value={values.name||''} onChange={e=>change('name',e.target.value)} className={field}/></label><label className="grid gap-2 text-sm font-semibold">Municipio<select value={values.municipality||''} onChange={e=>change('municipality',e.target.value)} className={field}>{directoryMunicipalities.map(m=><option key={m}>{m}</option>)}</select></label><div className="grid gap-2 text-sm font-semibold"><label htmlFor={`edit-description-${businessId}`}>Descripción del negocio</label><textarea id={`edit-description-${businessId}`} required rows={4} maxLength={700} value={values.description} onChange={e=>change('description',e.target.value)} className={field} /></div>
      <label className="grid gap-2 text-sm font-semibold">Dirección o referencia del negocio<input required maxLength={120} value={values.neighborhood} onChange={e=>change('neighborhood',e.target.value)} className={field} /></label>
      <section aria-labelledby={`business-location-${businessId}`} className="rounded-md border border-gray-200 bg-gray-50 p-4">
        <h4 id={`business-location-${businessId}`} className="font-bold">Ubicación exacta del negocio</h4>
        <p className="mt-1 text-sm text-gray-600">Párate en el negocio y usa la ubicación del celular. Mercáu guardará el punto para mostrarlo en la ficha.</p>
        {values.mapsUrl ? <div className="mt-3 grid gap-3"><p className="font-bold text-emerald-700">Ubicación agregada</p><div className="flex flex-wrap gap-2"><a href={values.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#D82016] px-4 font-bold text-white"><ExternalLink className="h-4 w-4" aria-hidden="true" />Revisar en Google Maps</a><button type="button" onClick={captureBusinessLocation} disabled={locating} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 font-bold"><RotateCcw className="h-4 w-4" aria-hidden="true" />Volver a tomar</button><button type="button" onClick={clearBusinessLocation} className="min-h-11 px-2 font-semibold text-[#D82016] underline">Quitar ubicación</button></div></div> : <button type="button" onClick={captureBusinessLocation} disabled={locating} className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#D82016] px-4 font-bold text-white disabled:opacity-60"><LocateFixed className="h-5 w-5" aria-hidden="true" />{locating?'Obteniendo ubicación...':'Usar ubicación actual del negocio'}</button>}
        {locationStatus&&<p role="status" className="mt-3 text-sm font-semibold text-gray-700">{locationStatus}</p>}
      </section></>}
      {(!section||section==='hours')&&<label className="grid gap-2 text-sm font-semibold">Horario<input maxLength={100} value={values.hours} onChange={e=>change('hours',e.target.value)} className={field} /></label>}
      {section==='categories'&&<><label>Categoría principal<select value={values.category||''} onChange={e=>{change('category',e.target.value);change('subcategory','');change('secondaryCategories',(values.secondaryCategories||[]).filter(c=>c!==e.target.value));}} className={field}>{directoryCategories.map(c=><option key={c.name}>{c.name}</option>)}</select></label><label>Subcategoría<select value={values.subcategory||''} onChange={e=>change('subcategory',e.target.value)} className={field}><option value="">Sin subcategoría</option>{directoryCategories.find(c=>c.name===values.category)?.subcategories.map(c=><option key={c}>{c}</option>)}<option>Otra actividad</option></select></label><fieldset><legend>Categorías secundarias</legend>{directoryCategories.filter(c=>c.name!==values.category).map(c=><label key={c.name} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={values.secondaryCategories?.includes(c.name)||false} onChange={e=>change('secondaryCategories',e.target.checked?[...(values.secondaryCategories||[]),c.name]:(values.secondaryCategories||[]).filter(v=>v!==c.name))}/>{c.name}</label>)}</fieldset><label>Etiquetas y servicios separados por coma<input maxLength={1000} value={values.tags?.join(', ')||''} onChange={e=>change('tags',e.target.value.split(',').map(v=>v.trim()))} className={field}/></label></>}
      {section==='contact'&&<label>WhatsApp principal<input required type="tel" maxLength={30} value={values.whatsapp||''} onChange={e=>change('whatsapp',e.target.value)} className={field}/></label>}
      {(!section||section==='deliveries')&&<div className="grid gap-2 text-sm font-semibold"><label htmlFor={`edit-deliveries-${businessId}`}>Domicilios</label><select id={`edit-deliveries-${businessId}`} value={values.deliveries === 'Sí' ? 'Si' : values.deliveries} onChange={e=>change('deliveries',e.target.value)} className={field}><option>Consultar</option><option value="Si">Sí</option><option>No</option></select></div>}
      {(!section||section==='contact')&&([['instagram','Instagram',180],['facebook','Facebook',180],['mapsUrl','Google Maps',240]] as const).map(([key,label,max])=><label key={key} className="grid gap-2 text-sm font-semibold">{label}<input type={key === 'mapsUrl' ? 'url' : 'text'} maxLength={max} value={values[key]} onChange={e=>change(key,e.target.value)} className={field} /></label>)}
      <div className="flex flex-wrap gap-3"><button disabled={busy} type="submit" onClick={()=>{continueAfterSave.current=false;}} className="min-h-12 rounded-md bg-[#D82016] px-5 font-bold text-white disabled:opacity-60">{busy ? 'Guardando...' : 'Guardar cambios'}</button>{onSaveAndContinue&&<button disabled={busy} type="submit" onClick={()=>{continueAfterSave.current=true;}} className="min-h-12 rounded-md border border-[#D82016] px-5 font-bold text-[#D82016] disabled:opacity-60">Guardar y continuar</button>}<button disabled={busy} type="button" onClick={onCancel} className="min-h-12 rounded-md border border-gray-300 px-4 font-semibold">Cancelar</button></div>
    </form>}</>}
    {notice && <p role="status" className="mt-3 rounded-md bg-[#FFF1F0] p-3 text-sm">{notice}</p>}
    <button disabled={busy} type="button" onClick={()=>setLoaded(value=>value+1)} className="mt-3 min-h-11 text-sm font-semibold text-[#D82016] underline">Recargar ficha</button>
  </div>;
}
