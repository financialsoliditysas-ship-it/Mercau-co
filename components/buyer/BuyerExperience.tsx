'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Heart, Home, LocateFixed, MapPin, Search, ShoppingBag, Store, UserRound, Utensils, X, ReceiptText } from 'lucide-react';
import { directoryCategories, directoryMunicipalities, type DirectoryBusiness } from '@/data/directory';
import { businessCatalogPath, businessPath } from '@/lib/business-public-url';
import { isFoodBusiness } from '@/lib/catalog-validation';
import { buyerDestinationKey, parseBuyerDestination, type BuyerDestination } from '@/lib/buyer-destination';
import { useFavorites } from '@/components/account/useFavorites';
import { useAccount } from '@/components/account/AccountSession';
import CustomerOrderCard from '@/components/CustomerOrderCard';
import type { CustomerOrder } from '@/lib/customer-order-status';

export default function BuyerExperience({section}:{section:string}) {
  const account=useAccount();
  const favorites=useFavorites(account.session?.user.id);
  const [businesses,setBusinesses]=useState<DirectoryBusiness[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[preview,setPreview]=useState(false);
  const [query,setQuery]=useState(''),[category,setCategory]=useState('');
  const [destination,setDestination]=useState<BuyerDestination|null>(null),[locationOpen,setLocationOpen]=useState(false),[locationMessage,setLocationMessage]=useState(''),[locating,setLocating]=useState(false);
  const physical=useRef<{latitude:number;longitude:number;accuracy:number}|null>(null);
  const resultsRef=useRef<HTMLElement>(null),dialogRef=useRef<HTMLDialogElement>(null),locationTrigger=useRef<HTMLButtonElement>(null);
  const [orders,setOrders]=useState<CustomerOrder[]>([]),[orderError,setOrderError]=useState(''),[ordersLoading,setOrdersLoading]=useState(false);
  useEffect(()=>{try{setDestination(parseBuyerDestination(localStorage.getItem(buyerDestinationKey)));}catch{}},[]);
  useEffect(()=>{setQuery('');setCategory('');},[section]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    fetch('/api/comprador/negocios',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!controller.signal.aborted){setBusinesses(data.businesses || []);setPreview(data.preview===true);}}).catch(()=>{if(!controller.signal.aborted)setError('No pudimos cargar los negocios. Intenta nuevamente.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[retry]);
  useEffect(()=>{
    if(locationOpen)dialogRef.current?.showModal();else dialogRef.current?.close();
  },[locationOpen]);
  useEffect(()=>{
    setOrders([]);setOrderError('');
    if(section!=='pedidos'||!account.session)return;
    let active=true;const controller=new AbortController();setOrdersLoading(true);
    account.request('/api/mi-cuenta/pedidos',{signal:controller.signal}).then(data=>{if(active)setOrders(data.orders || []);}).catch(()=>{if(active)setOrderError('No pudimos consultar tus pedidos. Intenta nuevamente.');}).finally(()=>{if(active)setOrdersLoading(false);});
    return()=>{active=false;controller.abort();};
  },[section,account.session,account.request]);
  function closeLocation(){setLocationOpen(false);locationTrigger.current?.focus();}
  function chooseMunicipality(municipality:BuyerDestination['municipality']){
    const selected:BuyerDestination={municipality,source:'manual'};setDestination(selected);
    try{localStorage.setItem(buyerDestinationKey,JSON.stringify(selected));}catch{setLocationMessage('El destino se conservará solo durante esta visita.');}
    closeLocation();
  }
  function locate(){
    if(!navigator.geolocation){setLocationMessage('No pudimos obtener tu ubicación. Elige un municipio y continúa.');return;}
    setLocating(true);setLocationMessage('Buscando tu ubicación...');
    navigator.geolocation.getCurrentPosition(({coords})=>{
      physical.current={latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy};setLocating(false);
      setLocationMessage('Ubicación obtenida. Elige dónde quieres explorar; tu destino no cambia con el GPS.');
    },()=>{setLocating(false);setLocationMessage('No pudimos obtener tu ubicación. Puedes elegir el municipio sin activar el GPS.');},{timeout:12000,maximumAge:60000});
  }
  const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const visible=businesses.filter(b=>{
    if(destination&&b.municipality!==destination.municipality)return false;
    if(section==='restaurantes'&&!isFoodBusiness(b.category))return false;
    if(section==='comercios'&&isFoodBusiness(b.category))return false;
    if(section==='favoritos'&&!favorites.ids.includes(b.id))return false;
    if(!['explorar','favoritos'].includes(section)&&!b.hasCatalog)return false;
    return (!category||b.category===category)&&(!query||normalized([b.name,b.description,b.category,...(b.commercialSearchTerms||[])].join(' ')).includes(normalized(query)));
  });
  const listing=!['pedidos','cuenta'].includes(section);
  function search(event:FormEvent<HTMLFormElement>){event.preventDefault();(document.activeElement as HTMLElement)?.blur();resultsRef.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
  const title=section==='inicio'?'¿Qué quieres pedir hoy?':section==='restaurantes'?'Restaurantes':section==='comercios'?'Comercios':section==='favoritos'?'Tus favoritos':'Explora tu territorio';
  return <div className="buyer-app">
    <header className="buyer-header"><Link href="/comprar" aria-label="Mercáu Inicio"><img src="/logo-mercau.png" alt="" width="42" height="42"/><strong>Mercáu</strong></Link><Link href="/comprar/cuenta" aria-label="Mi cuenta"><UserRound size={24}/></Link></header>
    <div className="buyer-content">
      {preview&&<p className="buyer-preview" role="status">Vista de prueba · Negocios ficticios · Sin pedidos ni despachos</p>}
      <button ref={locationTrigger} className="buyer-destination" onClick={()=>setLocationOpen(true)}><MapPin size={20}/><span><strong>{destination?.municipality || 'Elige dónde explorar'}</strong><small>Entrega según cobertura del negocio</small></span><span>Cambiar</span></button>
      {listing&&<>
        <div className="buyer-title">{section!=='inicio'&&<Link href="/comprar" aria-label="Volver al inicio"><ArrowLeft size={24}/></Link>}<h1>{title}</h1></div>
        <form className="buyer-search" onSubmit={search} role="search"><Search size={20}/><input aria-label="Busca un negocio o producto" placeholder="Busca un negocio o producto" value={query} onChange={e=>setQuery(e.target.value)} enterKeyHint="search"/>{query&&<button type="button" aria-label="Borrar búsqueda" onClick={()=>setQuery('')}><X size={18}/></button>}<button type="submit" aria-label="Buscar"><ArrowRight size={21}/></button></form>
        {section==='inicio'&&<div className="buyer-gateways"><Link href="/comprar/restaurantes"><div className="buyer-gateway-image"><img src="/demo-burger.jpg" alt=""/></div><span><Utensils size={19}/><strong>Restaurantes</strong></span><p>Comidas y bebidas</p></Link><Link href="/comprar/comercios"><div className="buyer-gateway-store"><Store size={56}/><ShoppingBag size={32}/></div><span><ShoppingBag size={19}/><strong>Comercios</strong></span><p>Productos y servicios</p></Link></div>}
        <section className="buyer-categories" aria-label="Categorías"><div><h2>Explora por categoría</h2>{category&&<button onClick={()=>setCategory('')} aria-label="Quitar filtro de categoría"><X size={17}/>Quitar filtro</button>}</div><div className="buyer-category-options">{directoryCategories.filter(c=>section!=='restaurantes'||isFoodBusiness(c.name)).filter(c=>section!=='comercios'||!isFoodBusiness(c.name)).map(c=><button key={c.name} aria-pressed={category===c.name} onClick={()=>setCategory(category===c.name?'':c.name)}>{c.name}{category===c.name&&<X size={14}/>}</button>)}</div></section>
        <section className="buyer-results" ref={resultsRef} aria-label="Negocios"><div className="buyer-section-heading"><h2>{section==='inicio'?'Descubre dónde pedir':'Elige un negocio'}</h2><Link href="/comprar/favoritos" aria-label="Ver favoritos"><Heart size={20}/></Link></div>
          {loading?<p role="status">Buscando negocios...</p>:error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(r=>r+1)}>Intentar nuevamente</button></div>:<><p className="buyer-count" aria-live="polite">{visible.length} negocio{visible.length===1?'':'s'}{destination?` en ${destination.municipality}`:''}</p>
          {!visible.length&&<div className="buyer-empty"><Store size={32}/><h3>No encontramos negocios con estos filtros</h3><p>Prueba otra búsqueda o cambia el municipio.</p><button onClick={()=>{setQuery('');setCategory('');}}>Limpiar búsqueda</button><button onClick={()=>setLocationOpen(true)}>Elegir municipio</button></div>}
          <div className="buyer-business-grid">{visible.map(b=><article className="buyer-business" key={b.id}><div className="buyer-business-media"><Link href={preview?'/comprar/explorar':businessPath(b)} aria-label={`Información de ${b.name}`}>{b.photoUrl?<img src={b.photoUrl} alt="" className={b.photoKind==='logo'?'is-logo':''}/>:<Store size={44} aria-hidden="true"/>}</Link><button aria-label={`${favorites.ids.includes(b.id)?'Quitar de':'Guardar en'} favoritos: ${b.name}`} aria-pressed={favorites.ids.includes(b.id)} onClick={()=>favorites.toggle(b.id)}><Heart size={20} fill={favorites.ids.includes(b.id)?'currentColor':'none'}/></button></div><div className="buyer-business-body"><Link href={preview?'/comprar/explorar':businessPath(b)} className="buyer-business-name">{b.name}</Link><p>{b.category}</p><span className="buyer-business-location"><MapPin size={13}/>{b.municipality}</span>{b.hasCatalog&&(preview?<span className="buyer-commercial-preview">{isFoodBusiness(b.category)?'Ver menú':'Ver catálogo'}</span>:<Link className="buyer-commercial" href={businessCatalogPath(b)}>{isFoodBusiness(b.category)?'Ver menú':'Ver catálogo'}</Link>)}{!b.hasCatalog&&<span className="buyer-basic">Información y contacto</span>}</div></article>)}</div></>}
          {favorites.notice&&<p role="status">{favorites.notice}</p>}
        </section>
      </>}
      {section==='pedidos'&&<section className="buyer-orders"><h1>Mis pedidos</h1>{!account.ready?<p role="status">Cargando tu cuenta...</p>:!account.session?<div className="buyer-empty"><ReceiptText size={36}/><h2>Tus pedidos, en un solo lugar</h2><p>Entra con tu cuenta para consultar su estado.</p><Link href="/mi-cuenta">Entrar a mi cuenta</Link></div>:<>{ordersLoading&&<p role="status">Consultando pedidos...</p>}{orderError&&<p role="alert">{orderError}</p>}{!ordersLoading&&!orderError&&!orders.length&&<div className="buyer-empty"><h2>Aún no tienes pedidos</h2><Link href="/comprar/restaurantes">Explorar restaurantes</Link></div>}{orders.map(o=><CustomerOrderCard key={o.public_id} order={o}/>)}</>}</section>}
      {section==='cuenta'&&<section className="buyer-account"><h1>Mi cuenta</h1><UserRound size={40}/><h2>{account.data?.profile.name || 'Tu espacio en Mercáu'}</h2><p>{account.session?'Gestiona tu perfil y consulta tu actividad.':'Puedes explorar sin cuenta. Entra o regístrate cuando quieras hacer un pedido.'}</p><Link href="/mi-cuenta">{account.session?'Ver mi perfil':'Entrar o crear mi cuenta'}<ArrowRight size={18}/></Link><Link href="/comprar/favoritos">Mis favoritos<Heart size={18}/></Link><Link href="/comprar/pedidos">Mis pedidos<ReceiptText size={18}/></Link>{account.data?.businesses.length? <Link href="/mi-cuenta/negocio">Administrar mi negocio<Store size={18}/></Link>:null}<Link href="/contacto">Ayuda y contacto<ArrowRight size={18}/></Link></section>}
    </div>
    <nav className="buyer-bottom" aria-label="Navegación del comprador">{[{href:'/comprar',name:'Inicio',icon:Home,active:section==='inicio'},{href:'/comprar/explorar',name:'Explorar',icon:Search,active:['explorar','restaurantes','comercios','favoritos'].includes(section)},{href:'/comprar/pedidos',name:'Mis pedidos',icon:ReceiptText,active:section==='pedidos'},{href:'/comprar/cuenta',name:'Mi cuenta',icon:UserRound,active:section==='cuenta'}].map(item=><Link key={item.href} href={item.href} aria-current={item.active?'page':undefined}><item.icon size={23}/><span>{item.name}</span></Link>)}</nav>
    <dialog ref={dialogRef} className="buyer-location-dialog" onCancel={e=>{e.preventDefault();closeLocation();}} aria-labelledby="buyer-location-title"><div className="buyer-dialog-heading"><MapPin size={26}/><button onClick={closeLocation} aria-label="Cerrar selección de destino"><X size={23}/></button></div><h2 id="buyer-location-title">Encuentra negocios cerca de ti</h2><p>Usa tu ubicación para encontrar restaurantes y comercios cercanos.</p><button className="buyer-locate" onClick={locate} disabled={locating}><LocateFixed size={20}/>{locating?'Obteniendo ubicación...':'Usar mi ubicación'}</button><p role="status">{locationMessage || 'También puedes pedir para otra persona eligiendo su municipio.'}</p><h3>Elegir municipio</h3><div className="buyer-municipalities">{directoryMunicipalities.map(m=><button key={m} onClick={()=>chooseMunicipality(m)} aria-pressed={destination?.municipality===m}>{m}</button>)}</div><small>La dirección exacta se confirma al hacer el pedido.</small></dialog>
  </div>;
}
