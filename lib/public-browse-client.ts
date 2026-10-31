'use client';
const prefix='mercau:public-browse:v1:';
const saved=new Map<string,{at:number;data:any}>(),pending=new Map<string,Promise<{data:any;stale:boolean}>>();
const maxEntries=24,maxBytes=250000,staleMs=15*60*1000;
function allowed(path:string){
  const url=new URL(path,'https://www.mercau.co');
  return url.origin==='https://www.mercau.co'&&(url.pathname==='/api/comprador/negocios'||url.pathname==='/api/comprar/platos'||
    (url.pathname==='/api/piloto/restaurante'&&url.searchParams.get('mode')==='menu'&&/^rec[A-Za-z0-9]{14}$/.test(url.searchParams.get('restaurant')||'')));
}
function stored(path:string){
  let entry=saved.get(path);
  if(!entry){try{entry=JSON.parse(sessionStorage.getItem(prefix+path)||'null');}catch{/* Storage may be disabled. */}}
  return entry&&typeof entry.at==='number'&&Date.now()-entry.at>=0&&Date.now()-entry.at<staleMs?entry:null;
}
function remember(path:string,data:any){
  const entry={at:Date.now(),data},encoded=JSON.stringify(entry);if(encoded.length>maxBytes)return;
  saved.delete(path);while(saved.size>=maxEntries)saved.delete(saved.keys().next().value as string);saved.set(path,entry);
  try{
    const keys=Object.keys(sessionStorage).filter(key=>key.startsWith(prefix));
    while(keys.length>=maxEntries){const key=keys.shift();if(key)sessionStorage.removeItem(key);}
    sessionStorage.setItem(prefix+path,encoded);
  }catch{/* In-memory browsing still works when storage is full. */}
}
export function recentPublicBrowse(path:string){if(!allowed(path))return null;return stored(path)?.data || null;}
export async function publicBrowse(path:string,freshMs=10000):Promise<{data:any;stale:boolean}> {
  if(!allowed(path))throw Error('Esta consulta no admite almacenamiento local.');
  const entry=stored(path);
  if(navigator.onLine===false){if(entry)return {data:entry.data,stale:true};throw Error('Sin conexión. No hay información guardada para esta consulta.');}
  if(entry&&Date.now()-entry.at<freshMs)return {data:entry.data,stale:false};
  const active=pending.get(path);if(active)return active;
  const work=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(path,{cache:'no-store',signal:controller.signal});
      if(!response.ok){
        if(response.status<500){saved.delete(path);try{sessionStorage.removeItem(prefix+path);}catch{}throw Object.assign(Error('Este contenido ya no está disponible. Vuelve a actualizar.'),{noFallback:true});}
        throw Error('No pudimos actualizar la información. Intenta nuevamente.');
      }
      const data=await response.json();remember(path,data);return {data,stale:false};
    }catch(error){
      if(entry&&!(error as {noFallback?:boolean}).noFallback)return {data:entry.data,stale:true};
      if((error as {noFallback?:boolean}).noFallback)throw error;
      throw Error('No pudimos cargar la información. Revisa tu conexión e intenta nuevamente.');
    }finally{clearTimeout(timer);}
  })().finally(()=>pending.delete(path));
  pending.set(path,work);return work;
}
