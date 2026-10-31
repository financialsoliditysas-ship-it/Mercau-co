'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, Compass, Download, House, MapPin, Menu, MoreVertical, Plus, ReceiptText, Search, Smartphone, SquareArrowUp, UserRound, X } from 'lucide-react';
import InstallMercau from '@/components/InstallMercau';
import { businessCatalogPath, businessPath } from '@/lib/business-public-url';
import { commercialLabel, type BuyerBusiness } from '@/lib/buyer-commercial';
import { buyerDestinationKey } from '@/lib/buyer-destination';
import { type DirectoryMunicipality } from '@/data/directory';
import directory from '@/content/presentation/review-businesses.json';
import map from '@/content/presentation/bajo-cauca-map.json';

type PresentationBusiness = BuyerBusiness & { logoUrl: string; photoAlt: string };
const businesses = directory.businesses as PresentationBusiness[];
const mercauInstallUrl = 'https://www.mercau.co/';
const mobileMapLabels: Record<string, [number, number]> = {
  'Nechí': [74, 12], Caucasia: [26, 32], 'Cáceres': [26, 57],
  'El Bagre': [74, 48], 'Tarazá': [26, 84], Zaragoza: [74, 80],
};
const navItems = [['Cómo funciona', '#como-funciona'], ['Cobertura', '#cobertura'], ['Para negocios', '#para-negocios']];
const questions = [
  ['¿Necesito cuenta para pedir?', 'Puedes explorar negocios, menús y catálogos sin una cuenta. Para enviar un pedido desde Mercáu, inicia sesión o crea tu cuenta. Algunos catálogos permiten contactar directamente al negocio por WhatsApp.'],
  ['¿Dónde hay domicilios?', 'Las entregas dependen del negocio y de la cobertura disponible para tu destino. Consulta las opciones y el valor del domicilio en el menú antes de confirmar. La presencia de un municipio en el mapa no significa que tenga cobertura de entregas.'],
  ['¿Puedo pedir para otra persona?', 'Sí. Al revisar tu pedido, confirma la dirección y los datos de quien lo recibe. Puedes editar los datos guardados antes de confirmar; la entrega está sujeta a la cobertura del negocio.'],
];

function Brand() {
  return <Link className="p-brand" href="/" aria-label="Mercáu, inicio"><img src="/logo-mercau.png" alt="" width="36" height="36" /><span>Mercáu</span></Link>;
}

function PhonePreview() {
  return <div className="p-phone" aria-hidden="true"><div className="p-phone-island" /><div className="p-phone-top"><img src="/logo-mercau.png" alt="" width="22" height="22" /><strong>Mercáu</strong><UserRound size={14} /></div><div className="p-phone-copy"><strong>¿Qué quieres pedir hoy?</strong><span><Search size={10} />Busca un negocio</span></div><div className="p-phone-choices"><div><img src="/presentation/category-food.webp" alt="" /><b>Restaurantes</b></div><div><img src="/presentation/category-shops.webp" alt="" /><b>Comercios</b></div></div><div className="p-phone-bottom"><House /><Search /><ReceiptText /><UserRound /></div></div>;
}

export default function Presentation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const iosGuide = useRef<HTMLDialogElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle');
  const [municipality, setMunicipality] = useState<DirectoryMunicipality>('Nechí');
  const [platform, setPlatform] = useState<'android' | 'ios'>('android');
  useEffect(() => {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) setPlatform('ios');
  }, []);
  function closeMenu() { setMenuOpen(false); menuTrigger.current?.focus(); }
  function openIosGuide() { setCopyStatus('idle'); iosGuide.current?.showModal(); }
  async function copyMercauLink() {
    setCopyStatus('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(mercauInstallUrl);
      setCopyStatus('copied');
    } catch { setCopyStatus('manual'); }
  }
  function exploreMunicipality() {
    try { localStorage.setItem(buyerDestinationKey, JSON.stringify({ municipality, source: 'manual' })); } catch { /* Navigation remains available without storage. */ }
  }
  const count = (directory.municipalityCounts as Record<string, number>)[municipality] || 0;
  return <div className="presentation-site">
    <Link className="p-skip" href="#presentacion-contenido">Saltar al contenido</Link>
    <header className="p-header"><div className="p-wrap p-header-inner"><Brand /><nav className="p-desktop-nav" aria-label="Navegación principal">{navItems.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}<Link className="p-outline" href="#instalar">Instalar</Link><Link className="p-button" href="/comprar">Pedir ahora</Link></nav><button className="p-menu-trigger" ref={menuTrigger} type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="p-mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
      <nav id="p-mobile-menu" aria-label="Navegación móvil" className="p-mobile-menu" hidden={!menuOpen} onKeyDown={event => { if (event.key === 'Escape') closeMenu(); }}>{navItems.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>)}<Link href="#instalar" onClick={() => setMenuOpen(false)}>Instalar Mercáu</Link><Link className="p-button" href="/comprar">Pedir ahora</Link></nav>
    </header>

    <div id="presentacion-contenido">
      <section className="p-hero" aria-labelledby="p-title"><div className="p-wrap p-hero-inner"><picture><source media="(max-width: 430px)" srcSet="/presentation/hero-mobile.webp" /><img className="p-hero-art" src="/presentation/hero.webp" alt="Hamburguesa y mercado de alimentos, imagen ilustrativa" width="1440" height="960" fetchPriority="high" /></picture><PhonePreview /><div className="p-hero-copy"><h1 id="p-title"><span>Pide comida y compra</span> en los negocios de tu municipio.</h1><p>Explora restaurantes, menús y catálogos.<br className="p-desktop-break" /> Encuentra lo que necesitas y consulta tu pedido.</p><div className="p-hero-actions"><Link className="p-button" href="/comprar">Ver qué puedo pedir <ArrowRight size={19} /></Link><Link className="p-install-link p-install-app" href="#instalar"><Download size={18} aria-hidden="true" />{platform === 'ios' ? 'Cómo instalar la app' : 'Instalar la app de Mercáu'}</Link></div><small>Explora sin cuenta. Inicia sesión para pedir.</small></div></div></section>

      <section className="p-wrap p-categories" aria-label="Restaurantes y comercios">{[
        { name: 'Restaurantes', text: 'Descubre menús de tus lugares favoritos.', action: 'Ver menús', href: '/comprar/restaurantes', kind: 'food' },
        { name: 'Comercios', text: 'Encuentra productos para tu hogar y más.', action: 'Ver catálogos', href: '/comprar/comercios', kind: 'shops' },
      ].map(item => <Link className={`p-category p-category-${item.kind}`} key={item.name} href={item.href}><img src={`/presentation/category-${item.kind}.webp`} alt="" width="1000" height="667" /><div><h2>{item.name}</h2><p>{item.text}</p><span>{item.action} <ArrowRight size={18} /></span></div></Link>)}</section>

      <section className="p-wrap p-discover" aria-labelledby="p-discover-title"><div className="p-section-title"><div><h2 id="p-discover-title">Descubre <span>qué puedes pedir</span></h2><p>Negocios del directorio de Mercáu.</p></div><button type="button" className="p-rail-next" aria-label="Ver más negocios" onClick={() => rail.current?.scrollBy({ left: rail.current.clientWidth * .7, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><ChevronRight /></button></div><div className="p-business-rail" ref={rail}>{businesses.map(business => {
        const label = commercialLabel(business);
        return <article key={business.id} className="p-business"><Link href={businessPath(business)} aria-label={`Información de ${business.name}`}><img className="p-business-photo" src={business.photoUrl} alt={business.photoAlt} width="600" height="400" loading="lazy" /><img className="p-business-logo" src={business.logoUrl} alt="" width="44" height="44" loading="lazy" /></Link><div className="p-business-copy"><h3><Link href={businessPath(business)}>{business.name}</Link></h3><p>{business.category}</p><span className="p-business-location"><MapPin size={14} />{business.municipality}</span>{label && <Link className="p-business-action" href={businessCatalogPath(business)}>{label}<ArrowRight size={17} /></Link>}</div></article>;
      })}</div></section>

      <section id="como-funciona" className="p-wrap p-how" aria-labelledby="p-how-title"><h2 id="p-how-title">Pedir es <span>sencillo.</span></h2><ol>{[['Elige', 'Explora menús y catálogos.'], ['Revisa', 'Confirma dirección y total.'], ['Recibe', 'Consulta el estado de tu pedido.']].map(([title, text], index) => <li key={title}><span className="p-step-number">{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>

      <section className="p-territory" id="cobertura" aria-labelledby="p-coverage-title"><div className="p-wrap p-territory-inner"><div className="p-territory-heading"><h2 id="p-coverage-title">El Bajo Cauca <span>nos conecta.</span></h2><p>Queremos conectar todo el Bajo Cauca.</p></div><div className="p-municipality-info" aria-live="polite"><MapPin size={27} /><div><h3>{municipality}</h3><p>{count ? `${count} negocios publicados en esta consulta del directorio.` : 'Aún no hay negocios publicados en esta consulta del directorio.'}</p><p>{count ? 'Domicilios según el negocio y su cobertura.' : 'La expansión del directorio no implica cobertura de domicilios.'}</p></div><Link href="/comprar/explorar" onClick={exploreMunicipality} className="p-button">Ver negocios <ArrowRight size={18} /></Link></div>
        <div className="p-map"><div className="p-map-canvas" role="group" aria-label="Selecciona un municipio del Bajo Cauca"><svg viewBox={map.viewBox}>
          {map.features.map(feature => <path key={feature.name} className={municipality === feature.name ? 'p-map-area p-map-selected' : 'p-map-area'} d={feature.path} fillRule="evenodd" role="button" tabIndex={-1} aria-label={`Área de ${feature.name}`} onClick={() => setMunicipality(feature.name as DirectoryMunicipality)} onKeyDown={event => { if (event.key === 'Enter') setMunicipality(feature.name as DirectoryMunicipality); }} />)}
          {map.features.map(feature => <g className="p-map-label" key={feature.name} transform={`translate(${feature.label[0]},${feature.label[1]})`} role="button" tabIndex={0} aria-label={`Seleccionar ${feature.name}`} aria-pressed={municipality === feature.name} onClick={() => setMunicipality(feature.name as DirectoryMunicipality)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setMunicipality(feature.name as DirectoryMunicipality); } }}><rect x={-feature.name.length * 6.7 - 20} y="-18" width={feature.name.length * 13.4 + 40} height="36" rx="18" /><circle cx={-feature.name.length * 6.7 - 3} cy="0" r="10" className={municipality === feature.name ? 'p-map-dot p-map-dot-selected' : 'p-map-dot'} />{municipality === feature.name && <path d="M -5 0 L -1 4 L 6 -4" transform={`translate(${-feature.name.length * 6.7 - 3},0)`} fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true" />}<text x="10" y="1" textAnchor="middle" dominantBaseline="middle">{feature.name}</text></g>)}
        </svg><div className="p-map-mobile-labels">{map.features.map(feature => {
          const [left, top] = mobileMapLabels[feature.name];
          return <button key={feature.name} type="button" style={{ left: `${left}%`, top: `${top}%` }} aria-label={`Seleccionar ${feature.name}`} aria-pressed={municipality === feature.name} onClick={() => setMunicipality(feature.name as DirectoryMunicipality)}><span className="p-map-check" aria-hidden="true">{municipality === feature.name && <Check size={13} />}</span>{feature.name}</button>;
        })}</div></div><p className="p-map-credit"><a href={map.source} target="_blank" rel="noreferrer">{map.attribution}</a><span>Mapa de referencia, no de cobertura logística.</span></p></div>
      </div></section>

      <section id="instalar" className="p-install" aria-labelledby="p-install-title"><div className="p-wrap"><div className="p-install-heading"><div><h2 id="p-install-title">Mercáu, a un toque.</h2><p>Agrégala a tu pantalla o sigue desde el navegador.</p></div><div className="p-platforms" role="group" aria-label="Sistema del celular"><button type="button" aria-pressed={platform === 'android'} onClick={() => setPlatform('android')}><Smartphone size={21} />Android</button><button type="button" aria-pressed={platform === 'ios'} onClick={() => setPlatform('ios')}><Smartphone size={21} />iPhone</button></div></div><div className="p-install-instructions" aria-live="polite"><ol>{platform === 'android' ? <><li><span>1</span><Compass /><p>Abre Mercáu<br />{' '}en Chrome.</p></li><li><span>2</span><MoreVertical /><p>Toca Instalar<br />{' '}o Agregar a inicio.</p></li><li><span>3</span><Check /><p>Confirma<br />{' '}y listo.</p></li></> : <><li><span>1</span><Smartphone /><p>Copia el enlace de Mercáu desde la ayuda.</p></li><li><span>2</span><Compass /><p>Abre Safari, pega el enlace y entra.</p></li><li><span>3</span><SquareArrowUp /><p>Toca Compartir → Agregar a inicio y confirma.</p></li></>}</ol><div className="p-install-control">{platform === 'ios' ? <button type="button" className="p-guide-link" onClick={openIosGuide}>Cómo instalar en iPhone <ArrowRight size={17} /></button> : <><InstallMercau prominent inlineHelp /></>}</div></div><small>{platform === 'android' ? 'La opción de instalación depende del navegador. Puedes continuar desde la web.' : 'Si ya estás en Safari, no necesitas copiar el enlace. Continúa desde Compartir.'}</small></div></section>

      <dialog ref={iosGuide} className="p-ios-guide" aria-labelledby="p-ios-guide-title" onClick={event => { if (event.target === event.currentTarget) iosGuide.current?.close(); }}><div className="p-ios-guide-heading"><h2 id="p-ios-guide-title">Cómo instalar en iPhone</h2><button type="button" aria-label="Cerrar ayuda de iPhone" onClick={() => iosGuide.current?.close()}><X size={23} /></button></div><ol><li><span className="p-guide-number">1</span><div><p><strong>Copia el enlace de Mercáu.</strong></p><button type="button" className="p-copy-link" disabled={copyStatus === 'copying'} onClick={copyMercauLink}>Copiar enlace de Mercáu</button><div role="status" aria-live="polite">{copyStatus === 'copied' && <p className="p-copy-success">Enlace copiado</p>}{copyStatus === 'manual' && <><p>No se pudo copiar automáticamente. Mantén pulsado el enlace, selecciónalo y cópialo manualmente.</p><input className="p-manual-link" aria-label="Enlace de Mercáu para copiar manualmente" value={mercauInstallUrl} readOnly onFocus={event => event.currentTarget.select()} /></>}</div></div></li><li><span className="p-guide-number">2</span><p><strong>Abre Safari</strong>, pega el enlace en la barra de direcciones y entra.</p></li><li><span className="p-guide-number">3</span><p>Toca <SquareArrowUp size={19} className="p-guide-share" aria-label="Compartir, cuadro con flecha hacia arriba" /> <strong>Compartir → Agregar a inicio</strong> y confirma.</p></li></ol><p>Si ya estás en Safari, no necesitas copiar el enlace. Continúa desde Compartir.</p></dialog>

      <section className="p-wrap p-for-business" id="para-negocios"><img src="/presentation/merchant-illustrative.webp" alt="Imagen ilustrativa de una comerciante en su establecimiento" width="180" height="120" loading="lazy" /><div><h2>¿Tienes un negocio?</h2><p>Publica tu menú o catálogo y administra tu información.</p></div><Link href="/negocios/registro" className="p-outline">Registrar mi negocio</Link></section>

      <section className="p-wrap p-faq" aria-labelledby="p-faq-title"><h2 id="p-faq-title">Resolvemos tus dudas</h2>{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</section>
      <footer className="p-wrap p-footer"><Brand /><nav aria-label="Enlaces de información"><Link href="/nosotros">Conoce Mercáu</Link><Link href="/nosotros#contacto">Ayuda</Link><Link href="/terminos-y-condiciones">Términos</Link><Link href="/politica-de-tratamiento-de-datos">Privacidad</Link></nav><a href="https://www.mercau.co">www.mercau.co</a></footer>
    </div>
  </div>;
}
