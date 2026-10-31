'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Search, ShoppingCart, Store, X } from 'lucide-react';
import RestaurantPilot from '@/components/RestaurantPilot';
import CatalogProductImage from '@/components/CatalogProductImage';
import { businessCatalogPath } from '@/lib/business-public-url';
import { isFoodBusiness } from '@/lib/catalog-validation';
import { dishCartKey, savedDishCarts, uncertainDishOrder, type DishCart } from '@/lib/dish-cart';
import { trackPublicMetric } from '@/lib/marketing-attribution';
import type { BuyerBusiness } from '@/lib/buyer-commercial';
import type { DiscoveredDish } from '@/lib/dish-discovery';
import './restaurant-dishes.css';

const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
type Page = { products: DiscoveredDish[]; categories: string[]; nextCursor: string | null };
export default function RestaurantDishes({ municipality, businesses, onQuery, children }: {
  municipality?: string; businesses: BuyerBusiness[]; onQuery: (query: string) => void; children: ReactNode;
}) {
  const router = useRouter(), params = useSearchParams();
  const mode = params.get('vista') === 'restaurantes' ? 'restaurantes' : 'platos';
  const restaurantId = params.get('restaurante') || '', productId = params.get('plato') || '';
  const query = params.get('q') || '', category = params.get('platosCategoria') || '';
  const [input, setInput] = useState(query), [page, setPage] = useState<Page>({ products: [], categories: [], nextCursor: null });
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [added, setAdded] = useState(false), [cart, setCart] = useState<DishCart | null>(null);
  const [switching, setSwitching] = useState<{ names: string; next: string } | null>(null), [cartMessage, setCartMessage] = useState('');
  const decision = useRef<((accepted: boolean) => void) | null>(null), switchDialog = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null), request = useRef(0), loadMoreBusy = useRef(false);
  const activeBusiness = businesses.find(b => b.id === restaurantId && !b.pilotRestaurant && isFoodBusiness(b.category));
  const base = '/comprar/restaurantes';
  function navigate(changes: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    const url = base + (next.size ? `?${next}` : '');
    if (replace) router.replace(url, { scroll: false }); else router.push(url, { scroll: false });
  }
  useEffect(() => { setInput(query); onQuery(query); }, [query, onQuery]);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(dishCartKey) || 'null');
      setCart(saved && savedDishCarts(sessionStorage).includes(saved.restaurantId) ? saved : null);
    } catch { /* The existing menu remains usable without storage. */ }
  }, [restaurantId]);
  useEffect(() => { setAdded(false); setCartMessage(''); decision.current?.(false); decision.current = null; setSwitching(null); }, [restaurantId, productId]);
  useEffect(() => {
    if (switching) switchDialog.current?.showModal(); else switchDialog.current?.close();
  }, [switching]);
  useEffect(() => () => { decision.current?.(false); }, []);
  useEffect(() => {
    const current = ++request.current, controller = new AbortController();
    setPage({ products: [], categories: [], nextCursor: null }); setError('');
    if (!municipality || mode !== 'platos' || restaurantId) { setLoading(false); return; }
    setLoading(true);
    const search = new URLSearchParams({ municipio: municipality, q: query, categoria: category });
    fetch(`/api/comprar/platos?${search}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(); return response.json();
    }).then(data => { if (current === request.current) setPage(data); })
      .catch(error => { if (error.name !== 'AbortError' && current === request.current) setError('No pudimos cargar los platos. Intenta nuevamente.'); })
      .finally(() => { if (current === request.current) setLoading(false); });
    return () => controller.abort();
  }, [municipality, query, category, mode, restaurantId, retry]);
  async function more() {
    if (!page.nextCursor || loadMoreBusy.current || !municipality) return;
    loadMoreBusy.current = true; const current = request.current; setLoading(true); setError('');
    try {
      const search = new URLSearchParams({ municipio: municipality, q: query, categoria: category, cursor: page.nextCursor });
      const response = await fetch(`/api/comprar/platos?${search}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(); const data: Page = await response.json();
      if (current === request.current) setPage(previous => ({ ...data, products: [...previous.products, ...data.products.filter(item => !previous.products.some(p => p.id === item.id && p.restaurantId === item.restaurantId))] }));
    } catch { if (current === request.current) setError('No pudimos cargar más platos. Intenta nuevamente.'); }
    finally { loadMoreBusy.current = false; if (current === request.current) setLoading(false); }
  }
  function respond(accepted: boolean) { decision.current?.(accepted); decision.current = null; setSwitching(null); }
  async function beforeAdd() {
    if (!activeBusiness) return false;
    try {
      const other = savedDishCarts(sessionStorage).filter(id => id !== activeBusiness.id);
      if (other.some(id => uncertainDishOrder(localStorage, id))) {
        setCartMessage('Hay una solicitud anterior pendiente de comprobar. Abre ese menú para consultar su resultado antes de iniciar otro pedido.'); return false;
      }
      if (other.length) {
        const names = other.map(id => businesses.find(b => b.id === id)?.name || 'otro restaurante').join(', ');
        setSwitching({ names, next: activeBusiness.name });
        const accepted = await new Promise<boolean>(resolve => { decision.current = resolve; });
        if (!accepted) return false;
        for (const id of other) sessionStorage.removeItem(`mercau:catalog-cart:${id}:v1`);
      }
      const next = { restaurantId: activeBusiness.id, restaurantName: activeBusiness.name, menuPath: businessCatalogPath(activeBusiness) };
      sessionStorage.setItem(dishCartKey, JSON.stringify(next)); setCart(next); return true;
    } catch { setCartMessage('No pudimos comprobar tu carrito guardado. Abre el menú para continuar sin reemplazarlo.'); return false; }
  }
  function changeMode(value: string) {
    navigate({ vista: value === 'platos' ? null : value, restaurante: null, plato: null });
    trackPublicMetric('directory_filter_used', { notes: `discovery=${value}` });
  }
  const returnToDiscovery = () => navigate({ restaurante: null, plato: null });
  return <section className={`restaurant-discovery${restaurantId ? ' dish-menu-open' : ''}`} aria-label="Descubrir restaurantes y platos">
    {restaurantId ? <>
      <button className="dish-back" onClick={returnToDiscovery}><ArrowLeft size={20}/>Volver a explorar</button>
      {activeBusiness ? <>
        {added && <p className="dish-added" role="status"><CheckCircle2 size={18}/>Agregado a tu pedido</p>}
        {added && <div className="dish-more-heading"><h1>¿Algo más de <span>{activeBusiness.name}</span>?</h1><p>Sigue explorando su menú</p></div>}
        <div className="dish-business-links"><Link href={businessCatalogPath(activeBusiness)}>Ver menú <ArrowRight size={16}/></Link><Link href={`/negocios/${activeBusiness.publicSlug || activeBusiness.id}`}>Información del negocio</Link></div>
        {cartMessage && <p role="alert">{cartMessage}</p>}
        <RestaurantPilot key={restaurantId} embedded visualMenu restaurantId={restaurantId} businessName={activeBusiness.name}
          returnPath={base + '?' + params.toString()} discoveryProductId={productId} discovery beforeDiscoveryAdd={beforeAdd} onDiscoveryAdded={() => { setAdded(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}/>
      </> : <p role="status">{businesses.length?'Este restaurante no está disponible en esta selección. Vuelve a explorar.':'Consultando el restaurante…'}</p>}
    </> : <>
      <div className="buyer-title"><Link href="/comprar" aria-label="Volver al inicio"><ArrowLeft size={23}/></Link><h1>¿Qué se te <span>antoja</span>?</h1></div>
      <form className="buyer-search dish-search" role="search" onSubmit={event => { event.preventDefault(); searchRef.current?.blur(); navigate({ q: input.trim() || null }); }}>
        <Search size={20}/><input ref={searchRef} aria-label="Busca un plato o restaurante" placeholder="Busca un plato o restaurante" value={input} onChange={event => setInput(event.target.value)} enterKeyHint="search"/>
        {input && <button type="button" aria-label="Borrar búsqueda" onClick={() => { setInput(''); navigate({ q: null }); }}><X size={19}/></button>}<button aria-label="Buscar platos y restaurantes"><ArrowRight size={22}/></button>
      </form>
      <div className="dish-tabs" role="group" aria-label="Descubrir por"><button aria-pressed={mode === 'platos'} onClick={() => changeMode('platos')}>Platos</button><button aria-pressed={mode === 'restaurantes'} onClick={() => changeMode('restaurantes')}>Restaurantes</button></div>
      {mode === 'restaurantes' ? children : <>
        <nav className="dish-filters" aria-label="Categorías de platos"><button aria-pressed={!category} onClick={() => navigate({ platosCategoria: null })}>Todos</button>{page.categories.map(name => <button key={name} aria-pressed={category === name} onClick={() => navigate({ platosCategoria: name })}>{name}</button>)}</nav>
        {!municipality && <p className="dish-empty">Elige un municipio arriba para descubrir sus platos.</p>}
        {error && <div className="dish-error" role="alert"><p>{error}</p><button onClick={() => page.products.length ? void more() : setRetry(value => value + 1)}>Intentar nuevamente</button></div>}
        {!loading && !error && municipality && !page.products.length && <div className="dish-empty"><Store size={30}/><h2>No encontramos platos disponibles</h2><p>Prueba otra búsqueda o consulta los restaurantes.</p><button onClick={() => changeMode('restaurantes')}>Explorar restaurantes</button></div>}
        <div className="dish-grid">{page.products.map((dish, index) => <article className="dish-card" key={`${dish.restaurantId}:${dish.id}`}>
          <button className="dish-card-open" aria-label={`Personalizar ${dish.name} de ${dish.restaurantName}`} onClick={() => {
            navigate({ restaurante: dish.restaurantId, plato: dish.id });
            trackPublicMetric('Producto visto', { businessId: dish.restaurantId, businessName: dish.restaurantName, notes: `discovery=platos; product_id=${dish.id}` });
          }}><div className="dish-photo"><CatalogProductImage name={dish.name} imageUrl={dish.image} priority={index < 2} sizes="(max-width: 639px) 50vw, (max-width: 999px) 33vw, 240px"/></div><div className="dish-card-body"><h2>{dish.name}</h2><strong>{dish.from && <small>Desde </small>}{money(dish.price)}</strong><span><Store size={13}/>{dish.restaurantName}</span><i aria-hidden="true"><Plus size={21}/></i></div></button>
        </article>)}</div>
        {loading && <p className="dish-loading" role="status">Buscando platos…</p>}
        {page.nextCursor && <button className="dish-load-more" disabled={loading} onClick={() => void more()}>Ver más platos</button>}
      </>}
      {cart && <Link className="dish-resume-cart" href={base + '?' + new URLSearchParams({ restaurante: cart.restaurantId })}><ShoppingCart size={20}/>Ver pedido en {cart.restaurantName}<ArrowRight size={18}/></Link>}
    </>}
    <dialog ref={switchDialog} className="dish-switch-dialog" aria-labelledby="dish-switch-title" onCancel={event => { event.preventDefault(); respond(false); }}>
      <button className="dish-switch-close" aria-label="Cerrar aviso y conservar carrito" onClick={() => respond(false)}><X size={22}/></button><h2 id="dish-switch-title">Tu carrito tiene productos de {switching?.names}.</h2><p>¿Quieres conservarlo o iniciar un pedido en {switching?.next}?</p><button onClick={() => respond(false)}>Conservar mi carrito</button><button className="dish-switch-confirm" onClick={() => respond(true)}>Iniciar nuevo pedido</button>
    </dialog>
  </section>;
}
