'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, Heart, LocateFixed, MapPin, Search, ShoppingBag, ShoppingBasket, Pill, Wrench, Store, UserRound, Utensils, X, ReceiptText } from 'lucide-react';
import { directoryCategories, directoryMunicipalities } from '@/data/directory';
import { businessCatalogPath, businessPath } from '@/lib/business-public-url';
import { isFoodBusiness } from '@/lib/catalog-validation';
import { buyerDestinationKey, parseBuyerDestination, type BuyerDestination } from '@/lib/buyer-destination';
import { useFavorites } from '@/components/account/useFavorites';
import { useAccount } from '@/components/account/AccountSession';
import BuyerOrderList from './BuyerOrderList';
import { BuyerHeader, BuyerNavigation } from './BuyerChrome';
import CategoryIcon from './CategoryIcon';
import { recentBuyerDirectory, refreshBuyerDirectory } from '@/lib/buyer-directory-client';
import { compareDirectoryPresentation } from '@/lib/buyer-commercial';
import type { CustomerOrder } from '@/lib/customer-order-status';
import { startCustomerOrderPolling } from '@/lib/customer-order-polling';
import { commercialLabel, matchesQuickCategory, quickCategoryNames, type BuyerBusiness, type QuickCategory } from '@/lib/buyer-commercial';

const quickAccesses = [
  {key:'tiendas',name:'Tiendas',icon:Store}, {key:'mercados',name:'Mercados',icon:ShoppingBasket},
  {key:'farmacias',name:'Farmacias',icon:Pill}, {key:'servicios',name:'Servicios',icon:Wrench},
];
const RestaurantDishes=dynamic(()=>import('./RestaurantDishes'));
export default function BuyerExperience({section,quickFilter=''}:{section:string;quickFilter?:string}) {
  const account=useAccount();
  const favorites=useFavorites(account.session?.user.id);
  const [businesses,setBusinesses]=useState<BuyerBusiness[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[preview,setPreview]=useState(false);
  const [query,setQuery]=useState(''),[category,setCategory]=useState('');
  const [directoryStale,setDirectoryStale]=useState(false);
  const [destination,setDestination]=useState<BuyerDestination|null>(null),[locationOpen,setLocationOpen]=useState(false),[locationMessage,setLocationMessage]=useState(''),[locating,setLocating]=useState(false);
  const physical=useRef<{latitude:number;longitude:number;accuracy:number}|null>(null);
  const resultsRef=useRef<HTMLElement>(null),dialogRef=useRef<HTMLDialogElement>(null),locationTrigger=useRef<HTMLButtonElement>(null);
  const bottomRef=useRef<HTMLElement>(null);
  const activeQuick=Object.hasOwn(quickCategoryNames,quickFilter)?quickFilter as QuickCategory:'';
  const [orders,setOrders]=useState<CustomerOrder[]>([]),[orderError,setOrderError]=useState(''),[ordersLoading,setOrdersLoading]=useState(false);
  const [ordersUpdatedAt,setOrdersUpdatedAt]=useState('');
  const refreshOrders=useRef<()=>void>(()=>{});
  const orderUserId=account.session?.user.id;
  useEffect(()=>{try{setDestination(parseBuyerDestination(localStorage.getItem(buyerDestinationKey)));}catch{}},[]);
  useEffect(()=>{
    setQuery('');
    const requestedCategory=new URLSearchParams(window.location.search).get('categoria');
    setCategory(directoryCategories.find(c=>c.name===requestedCategory)?.name || '');
    const frame=requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));
    return()=>cancelAnimationFrame(frame);
  },[section,quickFilter]);
  useEffect(()=>{
    const nav=bottomRef.current;
    if(!nav)return;
    const observer=new ResizeObserver(()=>nav.closest<HTMLElement>('.buyer-app')?.style.setProperty('--buyer-nav-height',`${nav.getBoundingClientRect().height}px`));
    observer.observe(nav);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(['pedidos','cuenta'].includes(section))return;
    let active=true;const cached=recentBuyerDirectory();
    if(cached){setBusinesses(cached.businesses);setPreview(cached.preview===true);setDirectoryStale(cached.stale===true);}
    setLoading(!cached);setError('');
    refreshBuyerDirectory().then(data=>{if(active){setBusinesses(data.businesses);setPreview(data.preview===true);setDirectoryStale(data.stale===true);}}).catch(()=>{if(active)setError('No pudimos cargar los negocios. Intenta nuevamente.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[retry,section]);
  useEffect(()=>{
    if(locationOpen)dialogRef.current?.showModal();else dialogRef.current?.close();
  },[locationOpen]);
  useEffect(()=>{
    setOrders([]);setOrderError('');setOrdersUpdatedAt('');
    if(section!=='pedidos'||!orderUserId){setOrdersLoading(false);return;}
    setOrdersLoading(true);
    const polling=startCustomerOrderPolling<{orders:CustomerOrder[]}>({
      request:signal=>account.request('/api/mi-cuenta/pedidos',{signal}),
      onData:data=>{setOrders(data.orders||[]);setOrderError('');setOrdersLoading(false);setOrdersUpdatedAt(new Date().toISOString());},
      onError:()=>{setOrderError('No pudimos actualizar el estado. La información mostrada puede estar desactualizada.');setOrdersLoading(false);}
    });
    refreshOrders.current=polling.refresh;
    return()=>{refreshOrders.current=()=>{};polling.stop();};
  },[section,orderUserId,account.request]);
  function closeLocation(){setLocationOpen(false);requestAnimationFrame(()=>locationTrigger.current?.focus());}
  function chooseMunicipality(municipality:BuyerDestination['municipality']){
    const selected:BuyerDestination={municipality,source:'manual'};setDestination(selected);
    try{localStorage.setItem(buyerDestinationKey,JSON.stringify(selected));}catch{setLocationMessage('El destino se conservará solo durante esta visita.');}
    closeLocation();
  }
  function locate(){
    if(!window.isSecureContext){setLocationMessage('Esta prueba local no permite usar el GPS. Elige un municipio para continuar.');return;}
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
    if(!category&&!matchesQuickCategory(b,activeQuick))return false;
    if(!['explorar','favoritos'].includes(section)&&!b.hasCatalog)return false;
    return (!category||b.category===category)&&(!query||normalized([b.name,b.description,b.category,...(b.commercialSearchTerms||[])].join(' ')).includes(normalized(query)));
  });
  if(section==='explorar')visible.sort(compareDirectoryPresentation);
  const listing=!['pedidos','cuenta'].includes(section);
  function search(event:FormEvent<HTMLFormElement>){event.preventDefault();(document.activeElement as HTMLElement)?.blur();resultsRef.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
  const title=section==='inicio'?'¿Qué quieres pedir hoy?':section==='restaurantes'?'Restaurantes':section==='comercios'?'Comercios':section==='favoritos'?'Tus favoritos':'Explora tu territorio';
  return <div className={`buyer-app${section==='inicio'?' buyer-home':''}${section==='restaurantes'?' buyer-restaurants':''}`}>
    <BuyerHeader/>
    <div className="buyer-content">
      {preview&&<p className="buyer-preview" role="status">Vista de prueba · Datos ficticios</p>}
      {listing&&directoryStale&&<p role="status">Información guardada. Conéctate para actualizar los negocios y su disponibilidad.</p>}
      {listing&&(destination?<button ref={locationTrigger} className="buyer-destination" onClick={()=>setLocationOpen(true)}><MapPin size={20}/><span><strong>{destination.municipality}</strong><small>Entrega según cobertura del negocio</small></span><span>Cambiar</span></button>:<section className="buyer-location-entry" aria-label="Elegir ubicación o municipio"><div><MapPin size={18}/><strong>Encuentra negocios cerca de ti</strong></div><div className="buyer-location-actions"><button onClick={()=>{setLocationOpen(true);locate();}}><LocateFixed size={17}/>Usar mi ubicación</button><button ref={locationTrigger} onClick={()=>setLocationOpen(true)}><MapPin size={17}/>Elegir municipio</button></div></section>)}
      {listing&&<>
        {section!=='restaurantes'&&<><div className="buyer-title">{section!=='inicio'&&<Link href="/comprar" aria-label="Volver al inicio"><ArrowLeft size={24}/></Link>}<h1>{section==='inicio'?<>¿Qué quieres <span>pedir hoy</span>?</>:title}</h1></div>
        <form className="buyer-search" onSubmit={search} role="search"><Search size={20}/><input aria-label="Busca un negocio o producto" placeholder="Busca un negocio o producto" value={query} onChange={e=>setQuery(e.target.value)} enterKeyHint="search"/>{query&&<button type="button" aria-label="Borrar búsqueda" onClick={()=>setQuery('')}><X size={18}/></button>}<button type="submit" aria-label="Buscar"><ArrowRight size={21}/></button></form></>}
        {section==='inicio'&&<div className="buyer-gateways"><Link href="/comprar/restaurantes"><div className="buyer-gateway-image"><img src="/presentation/category-food.webp" alt=""/></div><span><Utensils size={19}/><strong>Restaurantes</strong><ArrowRight className="buyer-gateway-arrow" size={16} aria-hidden="true"/></span><p>Comidas y bebidas</p></Link><Link href="/comprar/comercios"><div className="buyer-gateway-image"><img src="/presentation/category-shops.webp" alt=""/></div><span><ShoppingBag size={19}/><strong>Comercios</strong><ArrowRight className="buyer-gateway-arrow" size={16} aria-hidden="true"/></span><p>Productos y servicios</p></Link></div>}
        {section==='inicio'?<section className="buyer-shortcuts" aria-label="Accesos por categoría"><h2>Explora por categoría</h2><div className="buyer-category-rail">{quickAccesses.map(item=><Link key={item.key} href={`/comprar/comercios?tipo=${item.key}`}><item.icon size={25} aria-hidden="true"/><span>{item.name}</span></Link>)}{directoryCategories.map(item=><Link key={item.name} href={`/comprar/explorar?categoria=${encodeURIComponent(item.name)}`}><CategoryIcon name={item.name}/><span>{item.name}</span></Link>)}</div></section>:section==='restaurantes'?null:section==='comercios'?<section className="buyer-category-options buyer-commerce-filters buyer-category-rail" aria-label="Tipos de comercio">
          <Link href="/comprar/comercios" onClick={()=>setCategory('')} aria-current={!activeQuick&&!category?'page':undefined}><ShoppingBag size={25} aria-hidden="true"/><span>Todos</span></Link>
          {quickAccesses.map(item=><Link key={item.key} href={`/comprar/comercios?tipo=${item.key}`} onClick={()=>setCategory('')} aria-current={!category&&activeQuick===item.key?'page':undefined}><item.icon size={25} aria-hidden="true"/><span>{item.name}</span></Link>)}
          {directoryCategories.filter(item=>!isFoodBusiness(item.name)).map(item=><button key={item.name} aria-pressed={category===item.name} onClick={()=>setCategory(category===item.name?'':item.name)}><CategoryIcon name={item.name}/><span>{item.name}</span>{category===item.name&&<X className="buyer-category-close" size={14}/>}</button>)}
        </section>:<section className="buyer-categories" aria-label="Categorías"><div><h2>{activeQuick?quickCategoryNames[activeQuick as Exclude<QuickCategory,''>]:'Categorías'}</h2>{activeQuick?<Link href="/comprar/comercios" className="buyer-clear-quick"><X size={17}/>Quitar filtro</Link>:category&&<button onClick={()=>setCategory('')} aria-label="Quitar filtro de categoría"><X size={17}/>Quitar filtro</button>}</div>{!activeQuick&&<div className="buyer-category-options buyer-category-rail">{directoryCategories.map(c=><button key={c.name} aria-pressed={category===c.name} onClick={()=>setCategory(category===c.name?'':c.name)}><CategoryIcon name={c.name}/><span>{c.name}</span>{category===c.name&&<X className="buyer-category-close" size={14}/>}</button>)}</div>}</section>}
        <RestaurantSection section={section} municipality={destination?.municipality} businesses={businesses} onQuery={setQuery}><section className="buyer-results" ref={resultsRef} aria-label="Negocios"><div className="buyer-section-heading"><h2>{section==='inicio'?'Descubre dónde pedir':'Elige un negocio'}</h2><Link href="/comprar/favoritos" className="buyer-favorites-link"><Heart size={18}/><span>Favoritos</span></Link></div>
          {loading?<p role="status">Buscando negocios...</p>:error&&!businesses.length?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(r=>r+1)}>Intentar nuevamente</button></div>:<><p className="buyer-count" aria-live="polite">{visible.length} negocio{visible.length===1?'':'s'}{destination?` en ${destination.municipality}`:''}</p>
          {!visible.length&&<div className="buyer-empty"><Store size={32}/><h3>No encontramos negocios con estos filtros</h3><p>Prueba otra búsqueda o cambia el municipio.</p><button onClick={()=>{setQuery('');setCategory('');}}>Limpiar búsqueda</button><button onClick={()=>setLocationOpen(true)}>Elegir municipio</button></div>}
          <div className="buyer-business-grid">{visible.map((b,index)=><article className={`buyer-business${b.photoUrl?'':' without-photo'}`} key={b.id} data-business-id={b.id}><div className="buyer-business-media"><Link href={preview?'/comprar/explorar':businessPath(b)} aria-label={`Información de ${b.name}`}>{b.photoUrl?<img src={b.photoUrl} alt="" loading={index<4?'eager':'lazy'} fetchPriority={index<2?'high':'auto'} decoding="async" className={b.photoKind==='logo'?'is-logo':''}/>:<Store size={30} aria-hidden="true"/>}</Link><button aria-label={`${favorites.ids.includes(b.id)?'Quitar de':'Guardar en'} favoritos: ${b.name}`} aria-pressed={favorites.ids.includes(b.id)} onClick={()=>favorites.toggle(b.id)}><Heart size={20} fill={favorites.ids.includes(b.id)?'currentColor':'none'}/></button></div><div className="buyer-business-body"><Link href={preview?'/comprar/explorar':businessPath(b)} className="buyer-business-name">{b.name}</Link><p>{b.category}</p><span className="buyer-business-location"><MapPin size={13}/>{b.municipality}</span>{commercialLabel(b)&&(preview?<span className="buyer-commercial-preview">{commercialLabel(b)}</span>:<Link className="buyer-commercial" href={businessCatalogPath(b)}>{commercialLabel(b)}</Link>)}{!b.hasCatalog&&<span className="buyer-basic">Información y contacto</span>}</div></article>)}</div></>}
          {favorites.notice&&<p role="status">{favorites.notice}</p>}
        </section></RestaurantSection>
      </>}
      {section==='pedidos'&&<section className="buyer-orders"><div className="buyer-page-heading"><ReceiptText size={25}/><h1>Mis pedidos</h1></div>{!account.ready?<p role="status">Cargando tu cuenta...</p>:!account.session?<div className="buyer-empty buyer-activity-empty"><ReceiptText size={36}/><h2>Tus pedidos, en un solo lugar</h2><p>Entra con tu cuenta para consultar su estado.</p><Link href="/mi-cuenta" className="buyer-primary-link">Entrar a mi cuenta<ArrowRight size={18}/></Link></div>:<>{ordersLoading&&<p role="status">Consultando pedidos...</p>}{orderError&&<p role="alert">{orderError}</p>}{!ordersLoading&&!orderError&&!orders.length&&<div className="buyer-empty buyer-activity-empty"><ShoppingBag size={36}/><h2>Aún no tienes pedidos</h2><Link href="/comprar/restaurantes" className="buyer-primary-link">Explorar restaurantes<ArrowRight size={18}/></Link></div>}<BuyerOrderList orders={orders} error={orderError} updatedAt={ordersUpdatedAt} onRefresh={()=>refreshOrders.current()}/></>}</section>}
      {section==='cuenta'&&<section className="buyer-account"><h1>Mi cuenta</h1><div className="buyer-account-identity"><span><UserRound size={32}/></span><h2>{account.data?.profile.name || 'Tu espacio en Mercáu'}</h2></div><p>{account.session?'Gestiona tu perfil y consulta tu actividad.':'Puedes explorar sin cuenta. Entra o regístrate cuando quieras hacer un pedido.'}</p><Link href={account.session?'/mi-cuenta/perfil':'/mi-cuenta'} className="buyer-primary-link">{account.session?'Ver mi perfil':'Entrar o crear mi cuenta'}<ArrowRight size={18}/></Link><Link href="/comprar/favoritos"><span><Heart size={21}/>Mis favoritos</span><ArrowRight size={18}/></Link><Link href="/comprar/pedidos"><span><ReceiptText size={21}/>Mis pedidos</span><ArrowRight size={18}/></Link>{account.data?.businesses.length? <Link href="/mi-cuenta/negocio"><span><Store size={21}/>Administrar mi negocio</span><ArrowRight size={18}/></Link>:null}<Link href="/contacto"><span><UserRound size={21}/>Ayuda y contacto</span><ArrowRight size={18}/></Link></section>}
    </div>
    <BuyerNavigation ref={bottomRef} section={section}/>
    <dialog ref={dialogRef} className="buyer-location-dialog" onCancel={e=>{e.preventDefault();closeLocation();}} aria-labelledby="buyer-location-title"><div className="buyer-dialog-heading"><MapPin size={26}/><button onClick={closeLocation} aria-label="Cerrar selección de destino"><X size={23}/></button></div><h2 id="buyer-location-title">Encuentra negocios cerca de ti</h2><p>Usa tu ubicación para encontrar restaurantes y comercios cercanos.</p><button className="buyer-locate" onClick={locate} disabled={locating}><LocateFixed size={20}/>{locating?'Obteniendo ubicación...':'Usar mi ubicación'}</button><p role="status">{locationMessage || 'También puedes pedir para otra persona eligiendo su municipio.'}</p><h3>Elegir municipio</h3><div className="buyer-municipalities">{directoryMunicipalities.map(m=><button key={m} onClick={()=>chooseMunicipality(m)} aria-pressed={destination?.municipality===m}>{m}</button>)}</div><small>La dirección exacta se confirma al hacer el pedido.</small></dialog>
  </div>;
}

function RestaurantSection({section,children,...props}:{section:string;children:React.ReactNode;municipality?:string;businesses:BuyerBusiness[];onQuery:(query:string)=>void}) {
  return section==='restaurantes'?<RestaurantDishes {...props}>{children}</RestaurantDishes>:<>{children}</>;
}
