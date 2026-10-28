"use client";
import { ChangeEvent,FormEvent,useCallback,useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import BackToAccount from './BackToAccount';
import CatalogProductImage from './CatalogProductImage';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { CatalogFields,CatalogProduct,catalogKeys,parseCatalogPrice,formatCatalogPrice,catalogNoun,catalogLabel } from '@/lib/catalog-validation';
import { prepareImage } from '@/lib/prepare-image';
import CatalogPhotoHelp from './CatalogPhotoHelp';
import CatalogOptionGroupsEditor from './CatalogOptionGroupsEditor';
import CatalogShareActions from './CatalogShareActions';
import CatalogSharedOptions from './CatalogSharedOptions';

const empty:CatalogFields={name:'',description:'',section:'',price:0,available:true,status:'draft',position:0,optionGroups:[]};
const field='min-h-12 min-w-0 w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#D82016]';
const primary='min-h-11 rounded-md bg-[#D82016] px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const secondary='min-h-11 max-w-full break-words rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
const money=(price:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(price);
const statusLabel={draft:'Borrador',published:'Publicado',archived:'Archivado'};
export default function CatalogManager({businessId}:{businessId:string}) {
  const [business,setBusiness]=useState<{name:string;category:string}|null>(null);
  const [orderConfig,setOrderConfig]=useState<{enabled:boolean;delivery_mode:'MERCAU'|'OWN';commission_rate_bps:number;customer_markup_bps:number}|null>(null);
  const [products,setProducts]=useState<CatalogProduct[]>([]);
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('Cargando catálogo...');
  const [filter,setFilter]=useState('all');
  const [editing,setEditing]=useState<CatalogProduct|null>(null);
  const [showForm,setShowForm]=useState(false),[newId,setNewId]=useState('');
  const [values,setValues]=useState<CatalogFields>(empty);
  const [priceText,setPriceText]=useState('0');
  const [photo,setPhoto]=useState(''),[photoId,setPhotoId]=useState('');
  const [reload,setReload]=useState(0);
  const [showBulkPrice,setShowBulkPrice]=useState(false),[bulkPercent,setBulkPercent]=useState(''),[bulkSection,setBulkSection]=useState('all'),[bulkRounding,setBulkRounding]=useState(500);
  const editorRef=useRef<HTMLElement|null>(null);
  const api=useCallback(async(path='',method='GET',body?:unknown)=>{
    const client=getSupabaseBrowserClient();const session=client?(await client.auth.getSession()).data.session:null;
    if(!session)throw new Error('Entra a Mi cuenta para administrar este catálogo.');
    const response=await fetch(`/api/mi-negocio/${businessId}/catalogo${path}`,{method,cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok)throw new Error(result.error || 'No se pudo completar la operación.');return result;
  },[businessId]);
  useEffect(()=>{
    let active=true;setReady(false);setNotice('Cargando catálogo...');
    api().then(result=>{if(active){setBusiness(result.business);setProducts(result.products);setOrderConfig(result.orderConfig);setReady(true);setNotice('');}}).catch(error=>{if(active)setNotice(error.message);});
    return()=>{active=false;};
  },[api,reload]);
  useEffect(()=>{
    if(!showForm)return;
    const frame=window.requestAnimationFrame(()=>{
      editorRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
      window.setTimeout(()=>editorRef.current?.focus({preventScroll:true}),350);
    });
    return()=>window.cancelAnimationFrame(frame);
  },[showForm,editing?.id,newId]);
  function replace(product:CatalogProduct) {setProducts(current=>current.some(p=>p.id===product.id)?current.map(p=>p.id===product.id?product:p):[...current,product]);}
  function open(product?:CatalogProduct) {
    setNotice('');setPhoto('');setEditing(product || null);setShowForm(true);setNewId(product?.id || crypto.randomUUID());
    setValues(product?Object.fromEntries(catalogKeys.map(key=>[key,product[key]])) as CatalogFields:{...empty});
    setPriceText(formatCatalogPrice(product?.price ?? 0));
  }
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setNotice('Guardando producto...');
    let productSaved=false;
    try {
      const fields={...values,price:parseCatalogPrice(priceText)};
      const result=editing?await api(`/${editing.id}`,'PATCH',{version:editing.version,fields}):await api('','POST',{id:newId,fields});
      replace(result.product);setEditing(result.product);productSaved=true;
      setValues(Object.fromEntries(catalogKeys.map(key=>[key,result.product[key]])) as CatalogFields);
      setPriceText(formatCatalogPrice(result.product.price));
      if(photo) {
        setNotice('Producto guardado. Subiendo foto...');
        const updated=await savePhoto(result.product);replace(updated);setEditing(updated);setPhoto('');
        setNotice('Producto y foto guardados.');
      }else setNotice('Producto guardado.');
    }catch(error){setNotice(`${productSaved?'El producto quedó guardado, pero la foto no se pudo confirmar. ':''}${error instanceof Error?error.message:'No se pudo guardar.'}`);}finally{setBusy(false);}
  }
  async function update(product:CatalogProduct,changes:Partial<CatalogFields>) {
    setBusy(true);setNotice('Guardando...');
    replace({...product,...changes});
    try {
      const fields={...Object.fromEntries(catalogKeys.map(key=>[key,product[key]])),...changes};
      const result=await api(`/${product.id}`,'PATCH',{version:product.version,fields});replace(result.product);
      if(editing?.id===product.id){setEditing(result.product);setValues(fields as CatalogFields);}
      setNotice('Producto actualizado.');
    }catch(error){replace(product);setNotice(error instanceof Error?error.message:'No se pudo guardar.');}finally{setBusy(false);}
  }
  function adjustedPrice(price:number){const percent=Number(bulkPercent);return Math.round((price*(1+percent/100))/bulkRounding)*bulkRounding;}
  async function applyBulkPrices(){
    const percent=Number(bulkPercent);const targets=products.filter(product=>product.status!=='archived'&&(bulkSection==='all'||product.section===bulkSection));
    if(!Number.isFinite(percent)||percent<=0||percent>100)return setNotice('Escribe un porcentaje mayor que 0 y máximo 100.');
    if(!targets.length)return setNotice('No hay productos activos en la selección.');
    if(!window.confirm(`Se actualizarán ${targets.length} productos en ${bulkSection==='all'?'todo el catálogo':bulkSection}. Las fotos y opciones se conservarán. ¿Continuar?`))return;
    setBusy(true);setNotice(`Actualizando ${targets.length} precios...`);let completed=0;
    try{for(const product of targets){const fields=Object.fromEntries(catalogKeys.map(key=>[key,product[key]])) as CatalogFields;fields.price=adjustedPrice(product.price);const result=await api(`/${product.id}`,'PATCH',{version:product.version,fields});replace(result.product);completed+=1;}setNotice(`${completed} precios actualizados. Fotos, opciones y estados conservados.`);setShowBulkPrice(false);}catch(error){setNotice(`${completed} precios actualizados antes del error. ${error instanceof Error?error.message:'No se pudo completar.'}`);setReload(value=>value+1);}finally{setBusy(false);}
  }
  async function choosePhoto(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];setPhoto('');if(!file)return;setBusy(true);setNotice('Preparando foto...');
    try{setPhoto(await prepareImage(file));setPhotoId(crypto.randomUUID());setNotice('');}catch(error){setNotice(error instanceof Error?error.message:'No se pudo preparar la foto.');}finally{event.target.value='';setBusy(false);}
  }
  async function savePhoto(product:CatalogProduct):Promise<CatalogProduct> {
    const result=await api(`/${product.id}/foto`,'POST',{version:product.version,requestId:photoId,file:photo.split(',')[1]});
    return result.product;
  }
  async function uploadPhoto() {
    if(!editing)return;setBusy(true);setNotice('Subiendo foto...');
    try {
      const product=await savePhoto(editing);
      replace(product);setEditing(product);setPhoto('');setNotice('Foto guardada.');
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo subir la foto.');}finally{setBusy(false);}
  }
  const visible=products.filter(p=>filter==='all'?p.status!=='archived':p.status===filter).sort((a,b)=>a.position-b.position || a.name.localeCompare(b.name,'es'));
  const sections=Array.from(new Set(products.map(p=>p.section).filter(Boolean)));
  const publishedCount=products.filter(product=>product.status==='published').length;
  return <main className="min-h-screen bg-[#FCFBF9] text-[#1F2937]">
    <header className="border-b border-gray-200 bg-white px-4 py-4"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3"><Link href="/mi-negocio" className="min-h-11 content-center font-semibold text-[#D82016]">Panel de mi negocio</Link><BackToAccount /></div></header>
    <section className="mx-auto max-w-5xl px-4 py-6">
      <p className="text-sm font-bold text-[#D82016]">{business?.name || 'Panel de mi negocio'}</p><h1 className="mt-1 text-3xl font-black">Mi {business?catalogNoun(business.category).toLocaleLowerCase('es-CO'):'catálogo'}</h1>
      {orderConfig&&<section className="mt-4 rounded-md border border-red-200 bg-[#FFF1F0] p-4"><p className="font-black">Condiciones comerciales de pedidos</p><p className="mt-1 text-sm">Comisión total acordada: {(orderConfig.commission_rate_bps/100).toLocaleString('es-CO')} %. Referencia comercial para ajustar tus precios en Mercáu: {(orderConfig.customer_markup_bps/100).toLocaleString('es-CO')} %. Esta referencia no se cobra por separado ni reduce la comisión. Tú decides y guardas el precio final publicado.</p><p className="mt-2 text-sm font-bold">Pedidos {orderConfig.enabled?'activos':'pausados'} · {orderConfig.delivery_mode==='OWN'?'entrega con tu domiciliario':'entrega con domiciliario Mercáu'}</p></section>}
      <div className="mt-5 flex flex-wrap gap-3">{ready && <button disabled={busy} onClick={()=>open()} className={primary}>Agregar producto</button>}{ready&&products.length>0&&<button disabled={busy} onClick={()=>setShowBulkPrice(value=>!value)} className={secondary}>Ajustar precios</button>}<Link href={`/negocios/${businessId}/catalogo`} className={secondary}>{business?`${catalogLabel(business.category)} público`:'Ver catálogo público'}</Link><button disabled={busy} onClick={()=>setReload(value=>value+1)} className={secondary}>Actualizar lista</button></div>
      {business&&<div className="mt-3"><CatalogShareActions businessName={business.name} catalogUrl={`https://www.mercau.co/negocios/${businessId}/catalogo`} noun={catalogNoun(business.category)} /></div>}
      {notice && <p role="status" className="mt-4 rounded-md bg-[#FFF1F0] p-3 text-sm">{notice}</p>}
      {ready&&publishedCount===0&&<section className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4" aria-label="Tarea pendiente del catálogo"><p className="font-black text-slate-950">Tu negocio todavía no tiene {business?.category==='Comidas y bebidas'?'un menú':'un catálogo'} publicado.</p><p className="mt-1 text-sm text-slate-700">Agrega el primer producto o publica uno de tus borradores para que los clientes puedan verlo.</p><button type="button" disabled={busy} onClick={()=>open()} className={`${primary} mt-3`}>Agregar primer producto</button></section>}
      {ready&&<CatalogSharedOptions businessId={businessId} products={products} onProductsChanged={()=>setReload(value=>value+1)}/>} 
      {showBulkPrice&&<section className="mt-5 rounded-md border border-red-200 bg-white p-4"><h2 className="text-xl font-black">Ajustar precios del catálogo</h2><p className="mt-1 text-sm text-slate-600">Aplica un porcentaje a los productos activos. Mercáu muestra la vista previa y conserva fotos, ingredientes, salsas, adiciones y estado.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="grid gap-2 text-sm font-bold">Porcentaje de aumento<input type="number" min="0.01" max="100" step="0.01" value={bulkPercent} onChange={e=>setBulkPercent(e.target.value)} className={field}/></label><label className="grid gap-2 text-sm font-bold">Aplicar a<select value={bulkSection} onChange={e=>setBulkSection(e.target.value)} className={field}><option value="all">Todo el catálogo</option>{sections.map(section=><option key={section}>{section}</option>)}</select></label><label className="grid gap-2 text-sm font-bold">Redondear a<select value={bulkRounding} onChange={e=>setBulkRounding(Number(e.target.value))} className={field}><option value={100}>$100</option><option value={500}>$500</option><option value={1000}>$1.000</option></select></label></div>{products.find(product=>product.status!=='archived'&&(bulkSection==='all'||product.section===bulkSection))&&<p className="mt-4 rounded-md bg-slate-50 p-3 text-sm"><strong>Ejemplo:</strong> {money(products.find(product=>product.status!=='archived'&&(bulkSection==='all'||product.section===bulkSection))!.price)} pasa a {money(adjustedPrice(products.find(product=>product.status!=='archived'&&(bulkSection==='all'||product.section===bulkSection))!.price))}.</p>}<div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy||!bulkPercent} onClick={applyBulkPrices} className={primary}>Confirmar ajuste</button><button type="button" disabled={busy} onClick={()=>setShowBulkPrice(false)} className={secondary}>Cancelar</button></div></section>}
      {ready && <>
        {showForm && <section ref={editorRef} tabIndex={-1} className="mt-6 min-w-0 scroll-mt-4 border-y border-gray-200 py-5 outline-none" aria-label={editing?`Editar ${editing.name}`:'Agregar producto'}>
          <h2 className="text-xl font-bold">{editing?'Editar producto':'Nuevo producto'}</h2>
          <form onSubmit={save} className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
            <label className="grid min-w-0 gap-2 text-sm font-semibold">Nombre del producto<input required maxLength={120} value={values.name} onChange={e=>setValues(v=>({...v,name:e.target.value}))} className={field} /></label>
            <label className="grid min-w-0 gap-2 text-sm font-semibold">Precio (COP)<input required type="text" inputMode="numeric" maxLength={16} value={priceText} onChange={e=>setPriceText(e.target.value)} onBlur={()=>{try{setPriceText(formatCatalogPrice(parseCatalogPrice(priceText)));}catch{}}} className={field} /></label>
            <label className="grid min-w-0 gap-2 text-sm font-semibold">Sección<input list="catalog-sections" maxLength={80} value={values.section} onChange={e=>setValues(v=>({...v,section:e.target.value}))} placeholder="Ej: Bebidas o accesorios" className={field} /><datalist id="catalog-sections">{sections.map(section=><option key={section} value={section} />)}</datalist></label>
            <label className="grid min-w-0 gap-2 text-sm font-semibold">Orden<input type="number" min={0} max={10000} step={1} required value={values.position} onChange={e=>setValues(v=>({...v,position:Number(e.target.value)}))} className={field} /></label>
            <label className="grid min-w-0 gap-2 text-sm font-semibold md:col-span-2">Descripción del producto<textarea rows={3} maxLength={600} value={values.description} onChange={e=>setValues(v=>({...v,description:e.target.value}))} className={field} /></label>
            <div className="grid min-w-0 gap-2 text-sm font-semibold"><label htmlFor="catalog-product-status">Estado</label><select id="catalog-product-status" value={values.status} onChange={e=>setValues(v=>({...v,status:e.target.value as CatalogFields['status']}))} className={field}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></div>
            <label className="flex min-h-12 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={values.available} onChange={e=>setValues(v=>({...v,available:e.target.checked}))} className="h-5 w-5 accent-[#D82016]" />Disponible</label>
            <CatalogOptionGroupsEditor value={values.optionGroups} onChange={optionGroups=>setValues(v=>({...v,optionGroups}))} disabled={busy}/>
          <fieldset className="grid min-w-0 gap-3 md:col-span-2"><legend className="font-bold">Foto del producto</legend>
            <CatalogPhotoHelp />
            {(photo || editing?.imageUrl) && <div className="h-48 w-full max-w-sm overflow-hidden rounded-md bg-white"><CatalogProductImage name={values.name || 'producto'} imageUrl={photo || editing?.imageUrl} contain /></div>}
            <label className="grid min-w-0 gap-2 text-sm font-semibold">Seleccionar foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={busy} className="min-h-11 min-w-0 w-full max-w-full text-sm" /></label>
            {editing && <button type="button" disabled={busy || !photo} onClick={uploadPhoto} className={`${primary} w-fit`}>Guardar foto</button>}
          </fieldset>
            <div className="flex flex-wrap gap-3 md:col-span-2"><button disabled={busy} className={primary}>Guardar producto</button><button type="button" disabled={busy} onClick={()=>{setShowForm(false);setEditing(null);setPhoto('');}} className={secondary}>Cerrar edición</button></div>
          </form>
        </section>}
        <nav aria-label="Estado de productos" className="mt-6 flex flex-wrap gap-2">{([['all','Todos'],['published','Publicados'],['draft','Borradores'],['archived','Archivados']] as const).map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)} className={`${secondary} ${filter===key?'border-[#D82016] bg-[#FFF1F0] text-[#D82016]':''}`}>{label}</button>)}</nav>
        {!visible.length && <p className="py-8 text-gray-600">{products.length?'No hay productos en este estado.':'Aún no tienes productos. Agrega el primero cuando esté listo.'}</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-2">{visible.map(product=><article key={product.id} className="min-w-0 rounded-md border border-gray-200 bg-white p-4">
          <div className="flex min-w-0 gap-3"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100"><CatalogProductImage name={product.name} imageUrl={product.imageUrl} /></div><div className="min-w-0"><h2 className="break-words text-lg font-bold">{product.name}</h2><p className="text-sm text-gray-600">{product.section || 'Sin sección'}</p><p className="font-bold">{money(product.price)}</p><p className="text-xs text-gray-600">{statusLabel[product.status]} · {product.available?'Disponible':'Agotado'}</p></div></div>
          {product.optionGroups.length>0 && <p className="mt-3 text-sm font-semibold text-[#D82016]">{product.optionGroups.length} grupo{product.optionGroups.length===1?'':'s'} de personalización</p>}
          <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>open(product)} className={secondary}>Editar {product.name}</button>
            <button disabled={busy} onClick={()=>update(product,{status:product.status==='archived'?'draft':'archived'})} className={secondary}>{product.status==='archived'?'Restaurar borrador':'Archivar'}</button>
            {product.status!=='archived' && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={product.available} disabled={busy} onChange={e=>update(product,{available:e.target.checked})} className="h-5 w-5 accent-[#D82016]" />Disponible: {product.name}</label>}
          </div>
        </article>)}</div>
      </>}
    </section>
  </main>;
}
