"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import { Library,Plus } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { CatalogOptionGroup,CatalogProduct } from '@/lib/catalog-validation';
import type { SharedOptionGroup } from '@/lib/catalog-shared-options';
import CatalogOptionGroupsEditor from './CatalogOptionGroupsEditor';

const primary='min-h-11 rounded-md bg-[#D82016] px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const secondary='min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
function blankGroup():CatalogOptionGroup{return {id:crypto.randomUUID(),name:'',type:'multiple',required:false,minSelections:0,maxSelections:1,choices:[{id:crypto.randomUUID(),name:'',priceDelta:0,defaultSelected:false}]};}

export default function CatalogSharedOptions({businessId,products,onProductsChanged}:{businessId:string;products:CatalogProduct[];onProductsChanged:()=>void}) {
  const [groups,setGroups]=useState<SharedOptionGroup[]>([]),[selected,setSelected]=useState<string>('');
  const [draft,setDraft]=useState<CatalogOptionGroup|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const editorRef=useRef<HTMLElement|null>(null);
  const draftId=draft?.id;
  const api=useCallback(async(method='GET',body?:unknown)=>{
    const client=getSupabaseBrowserClient();const session=client?(await client.auth.getSession()).data.session:null;
    if(!session)throw new Error('Entra a Mi cuenta para administrar estas opciones.');
    const response=await fetch(`/api/mi-negocio/${businessId}/opciones`,{method,cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok)throw new Error(result.error || 'No se pudo completar la operación.');return result;
  },[businessId]);
  const load=useCallback(()=>api().then(result=>setGroups(result.groups)).catch(error=>setNotice(error.message)),[api]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(draftId)requestAnimationFrame(()=>editorRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));},[draftId]);
  const current=groups.find(group=>group.id===selected);
  function edit(group?:SharedOptionGroup){setSelected(group?.id || '');setDraft(group?{id:group.id,name:group.name,type:group.type,required:group.required,minSelections:group.minSelections,maxSelections:group.maxSelections,choices:group.choices}:blankGroup());setNotice('');}
  async function save(){if(!draft)return;setBusy(true);setNotice('Guardando grupo compartido...');try{const result=current?await api('PATCH',{id:current.id,version:current.version,group:draft}):await api('POST',{group:draft});if(result.groups)setGroups(result.groups);else{setGroups(value=>[...value,result.group]);setSelected(result.group.id);}setNotice(current?'Grupo actualizado en todos los productos vinculados.':'Grupo compartido creado. Ya puedes asignarlo a productos.');setDraft(null);onProductsChanged();}catch(error){setNotice(error instanceof Error?error.message:'No se pudo guardar.');}finally{setBusy(false);}}
  async function link(productId:string,linked:boolean){if(!current)return;setBusy(true);setNotice(linked?'Asignando opción...':'Retirando opción...');try{const result=await api('POST',{action:'link',productId,groupId:current.id,linked});setGroups(result.groups);setNotice(linked?'Opción asignada al producto.':'Opción retirada del producto.');onProductsChanged();}catch(error){setNotice(error instanceof Error?error.message:'No se pudo cambiar la asignación.');}finally{setBusy(false);}}
  return <section className="mt-5 rounded-md border border-gray-200 bg-white p-4" aria-labelledby="shared-options-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="shared-options-title" className="flex items-center gap-2 text-xl font-black"><Library size={21}/>Biblioteca de opciones</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">Crea una adición, salsa o grupo una sola vez y asígnalo a varios productos. Al cambiar su precio aquí, se actualiza en todos los productos vinculados.</p></div><button type="button" disabled={busy} onClick={()=>edit()} className={primary}><Plus className="inline" size={17}/> Crear grupo</button></div>
    {notice&&<p role="status" className="mt-3 rounded-md bg-[#FFF1F0] p-3 text-sm">{notice}</p>}
    {!groups.length&&!draft&&<p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-600">Todavía no hay opciones compartidas. Puedes crear, por ejemplo, “Adiciones” y asignarla a hamburguesas, salchipapas y patacones.</p>}
    {groups.length>0&&<div className="mt-4 grid gap-2 sm:grid-cols-2">{groups.map(group=><button type="button" key={group.id} onClick={()=>{setSelected(group.id);setDraft(null);}} className={`min-h-16 rounded-md border p-3 text-left ${selected===group.id?'border-[#D82016] bg-[#FFF1F0]':'border-gray-200'}`}><strong>{group.name}</strong><span className="mt-1 block text-xs text-gray-600">{group.choices.length} opciones · {group.productIds.length} productos vinculados</span></button>)}</div>}
    {current&&!draft&&<div className="mt-4 border-t border-gray-200 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Asignar “{current.name}”</h3><p className="text-sm text-gray-600">Marca cada producto que debe utilizar este grupo.</p></div><button type="button" disabled={busy} onClick={()=>edit(current)} className={secondary}>Editar nombres y precios</button></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{products.filter(product=>product.status!=='archived').map(product=><label key={product.id} className="flex min-h-12 items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold"><input type="checkbox" disabled={busy} checked={current.productIds.includes(product.id)} onChange={event=>link(product.id,event.target.checked)} className="h-5 w-5 accent-[#D82016]"/>{product.name}</label>)}</div></div>}
    {draft&&<section ref={editorRef} tabIndex={-1} className="mt-4 scroll-mt-24 border-t border-gray-200 pt-4 outline-none"><h3 className="text-lg font-black">{current?'Editar grupo compartido':'Nuevo grupo compartido'}</h3><CatalogOptionGroupsEditor value={[draft]} onChange={value=>value[0]&&setDraft(value[0])} disabled={busy}/><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={save} className={primary}>Guardar grupo</button><button type="button" disabled={busy} onClick={()=>setDraft(null)} className={secondary}>Cancelar</button></div></section>}
  </section>;
}
