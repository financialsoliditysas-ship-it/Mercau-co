"use client";
import { ChangeEvent,useEffect,useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import BusinessImage from './BusinessImage';
import { prepareImage } from '@/lib/prepare-image';
type Photo={photoUrl?:string;photoKind?:'photo'|'logo';photoVersion?:string};
export default function BusinessPhotoUploader({businessId,name,photo,onUploaded}:{businessId:string;name:string;photo:Photo;onUploaded:(photo:Photo)=>void}) {
  const [kind,setKind]=useState<'photo'|'logo'>(photo.photoKind || 'photo');
  const [data,setData]=useState('');const [requestId,setRequestId]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
  useEffect(()=>setKind(photo.photoKind || 'photo'),[photo.photoKind]);
  async function choose(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];setData('');setNotice('');if(!file)return;
    setBusy(true);
    try {setData(await prepareImage(file));setRequestId(crypto.randomUUID());}catch(error){setNotice(error instanceof Error?error.message:'No se pudo preparar la imagen. Selecciona otra.');}finally{setBusy(false);}
  }
  async function save() {
    setBusy(true);setNotice('Subiendo imagen...');
    try {
      const client=getSupabaseBrowserClient();const session=client?(await client.auth.getSession()).data.session:null;
      if(!session)throw new Error('Entra nuevamente a tu cuenta.');
      const response=await fetch(`/api/mi-negocio/${businessId}/foto`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({kind,file:data.split(',')[1],requestId,photoVersion:photo.photoVersion})});
      const result=await response.json();if(!response.ok)throw new Error(result.error || 'No se pudo subir la imagen.');
      onUploaded(result);setData('');setNotice('Imagen principal guardada. Ya aparece en tu ficha pública.');
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo confirmar la carga. Recarga la ficha antes de reintentar.');}finally{setBusy(false);}
  }
  return <fieldset className="mt-4 grid min-w-0 gap-3 border-b border-gray-200 pb-5"><legend className="font-bold">Foto principal o logo</legend>
    <div className="h-40 w-full max-w-sm overflow-hidden rounded-md border border-gray-200 bg-white">{data?<img src={data} alt="Vista previa de la imagen seleccionada" className={`h-full w-full ${kind==='logo'?'object-contain p-2':'object-cover'}`} />:<BusinessImage name={name} {...photo} className="h-full w-full" fallback={<p className="p-4 text-sm text-gray-500">Sin imagen principal</p>} />}</div>
    <div className="flex flex-wrap gap-4 text-sm"><label className="flex min-h-11 items-center gap-2"><input type="radio" name={`photo-kind-${businessId}`} checked={kind==='photo'} disabled={busy} onChange={()=>setKind('photo')} />Foto</label><label className="flex min-h-11 items-center gap-2"><input type="radio" name={`photo-kind-${businessId}`} checked={kind==='logo'} disabled={busy} onChange={()=>setKind('logo')} />Logo</label></div>
    <label className="grid min-w-0 gap-2 text-sm font-semibold">Seleccionar imagen<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={choose} className="min-h-11 min-w-0 w-full max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2" /></label>
    <button type="button" disabled={busy || !data} onClick={save} className="min-h-11 w-fit rounded-md bg-[#D82016] px-4 font-bold text-white disabled:opacity-60">{busy?'Procesando...':'Guardar imagen'}</button>
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </fieldset>;
}
