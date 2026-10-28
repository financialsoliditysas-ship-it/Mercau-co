"use client";

import { useEffect } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Check, CircleHelp, Clock3, MapPin, MessageCircle, PackageOpen, Share2, ShoppingBag, Store } from "lucide-react";
import BusinessRegistration from "@/components/BusinessRegistration";
import { businessRegistrationStage } from "@/lib/business-registration-flow";
import AccountAuth from "./AccountAuth";
import { useAccount } from "./AccountSession";

const benefits = [
  { icon: Store, title: "Tu página propia", text: "Presenta tu negocio con ubicación, horarios y datos de contacto." },
  { icon: BookOpen, title: "Catálogo o menú", text: "Publica productos, servicios o platos con fotografías y precios." },
  { icon: MessageCircle, title: "Contacto directo", text: "Recibe consultas por WhatsApp y teléfono desde tu ficha." },
  { icon: Share2, title: "Lista para compartir", text: "Obtén un enlace para enviarlo a clientes y contactos." },
];

const included = ["Ficha pública del negocio", "Categoría, municipio y ubicación", "Horarios y medios de contacto", "Logo, portada y fotografías", "Catálogo de productos o menú", "Enlace público para compartir"];

export default function BusinessRegistrationEntry() {
  const { session, ready, recovering, data, loading } = useAccount();
  useEffect(() => localStorage.setItem("mercau.businessRegistrationIntent", "business"), []);
  const businesses = (data?.businesses || []).filter((business) => business.status === "Activo");
  const stage = businessRegistrationStage({ ready, hasSession: Boolean(session), recovering, loading, hasData: Boolean(data), businesses: data?.businesses || [] });
  const access = stage === "loading" ? <p role="status" className="ma-notice">Cargando tu acceso...</p>
    : stage === "auth" ? <AccountAuth businessOnly />
    : stage === "panel" ? (
      <section className="ma-band ma-business-access">
        <p className="ma-eyebrow">TU NEGOCIO YA ESTÁ VINCULADO</p>
        <h2>Continúa administrando desde tu panel</h2>
        <p>No necesitas crear otra cuenta ni registrar nuevamente una ficha que ya administras.</p>
        <div className="ma-business-grid">{businesses.map((business) => <article className="ma-business-item" key={business.business_id}><Store size={26} /><div><h3>{business.business_name}</h3><small>Acceso activo</small></div><a href="/mi-cuenta/negocio" aria-label={`Administrar ${business.business_name}`}><ArrowUpRight size={20} /></a></article>)}</div>
        <a className="ma-button primary" href="/mi-cuenta/negocio">Ir al panel de mi negocio</a>
      </section>
    ) : (
      <section><div className="ma-page-heading"><div><p className="ma-eyebrow">CUENTA LISTA</p><h2>Ahora registra tu negocio</h2><p>Tu correo ya fue confirmado. Completa estos datos para crear la ficha de tu negocio.</p></div></div><BusinessRegistration compact onRegistered={() => window.location.assign("/mi-cuenta/negocio?onboarding=producto")} /></section>
    );

  if (stage === "register") {
    return <main className="ma min-h-screen bg-[#FCFBF9]">
      <header className="ma-business-header"><div className="ma-business-header-inner"><a href="/" className="ma-brand"><img src="/logo-mercau.png" alt="Mercáu" width="44" height="44" /><strong>Mercáu</strong></a><nav aria-label="Acciones principales"><a href="/mi-cuenta" className="ma-button">Mi cuenta</a></nav></div></header>
      <section id="registro" className="mx-auto max-w-3xl px-4 py-8 sm:py-12">{access}</section>
    </main>;
  }

  return (
    <main className="ma ma-business-landing">
      <header className="ma-business-header"><div className="ma-business-header-inner"><a href="/" className="ma-brand"><img src="/logo-mercau.png" alt="Mercáu" width="44" height="44" /><strong>Mercáu</strong></a><nav aria-label="Acciones principales"><a href="/" className="ma-button">Explorar negocios</a><a href="/mi-cuenta?entry=general" className="ma-button">Entrar a mi cuenta</a><a href="#registro" className="ma-button primary">Registrar mi negocio</a></nav></div></header>

      <section className="ma-business-hero"><div className="ma-business-hero-overlay" /><div className="ma-business-hero-content"><p className="ma-business-kicker">NEGOCIOS DEL BAJO CAUCA</p><h1>Tu negocio merece una vitrina digital</h1><p>Regístralo gratis, crea su página en Mercáu y publica su catálogo o menú para que más personas conozcan lo que ofreces.</p><div className="ma-business-hero-actions"><a href="#registro" className="ma-button primary">Registrar mi negocio gratis <ArrowRight size={18} /></a><a href="/negocios/recGLMhJYXTRE46st" className="ma-button ma-button-light">Ver una página publicada</a></div><small>Una sola cuenta para comprar y administrar tu negocio.</small></div></section>

      <section className="ma-business-proof" aria-label="Ventajas principales"><div><strong>Registro gratuito</strong><span>Empieza sin pago de inscripción</span></div><div><strong>Presencia digital</strong><span>Información accesible desde celular</span></div><div><strong>Control propio</strong><span>Actualiza tu ficha cuando lo necesites</span></div></section>

      <section className="ma-commercial-section"><div className="ma-commercial-heading"><p className="ma-eyebrow">MÁS FORMAS DE MOSTRARTE</p><h2>Todo lo esencial para presentar mejor tu negocio</h2><p>Una página sencilla para que tus clientes encuentren lo importante y puedan contactarte.</p></div><div className="ma-benefit-grid">{benefits.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={24} /><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section className="ma-demo-band"><div className="ma-demo-copy"><p className="ma-eyebrow">ASÍ PUEDE VERSE TU NEGOCIO</p><h2>Una página que puedes presentar como propia</h2><p>Tu logo, descripción, ubicación, horarios, contacto y productos reunidos en un enlace fácil de compartir.</p><ul><li><Check size={17} /> Información organizada para celular</li><li><Check size={17} /> Catálogo o menú con precios</li><li><Check size={17} /> Acceso directo a WhatsApp</li></ul></div><article className="ma-demo-business" aria-label="Demostración de una ficha de negocio"><div className="ma-demo-photo"><img src="/demo-burger.jpg" alt="Hamburguesa de demostración" /><span>Demostración</span></div><div className="ma-demo-details"><p>Comidas y bebidas</p><h3>Tu negocio en Mercáu</h3><span><MapPin size={15} /> Nechí, Bajo Cauca</span><span><Clock3 size={15} /> Horario visible para tus clientes</span><div><button type="button">Ver menú</button><button type="button">WhatsApp</button></div></div></article></section>

      <section className="ma-commercial-section"><div className="ma-commercial-heading"><p className="ma-eyebrow">EMPEZAR ES SENCILLO</p><h2>Tres pasos para publicar tu negocio</h2></div><ol className="ma-step-grid"><li><span>1</span><div><h3>Crea tu cuenta</h3><p>Ingresa tus datos o inicia sesión si ya eres comprador.</p></div></li><li><span>2</span><div><h3>Registra o reclama tu negocio</h3><p>Completa la información sin crear otra cuenta.</p></div></li><li><span>3</span><div><h3>Publica y comparte</h3><p>Agrega fotos, productos o servicios y comparte tu página.</p></div></li></ol></section>

      <section className="ma-included-band"><div><p className="ma-eyebrow">INCLUIDO EN TU PÁGINA</p><h2>La información que tus clientes necesitan</h2><p>Completa tu ficha a tu ritmo y mantenla actualizada desde el panel.</p></div><ul>{included.map((item) => <li key={item}><Check size={18} /> {item}</li>)}</ul></section>

      <section id="registro" className="ma-registration-zone"><div className="ma-registration-intro"><p className="ma-eyebrow">EMPIEZA AHORA</p><h2>{stage === "panel" ? "Tu negocio ya está en Mercáu" : "Crea la página de tu negocio"}</h2><p>Este acceso está preparado para comerciantes. Si ya tienes una cuenta de comprador, inicia sesión con ella.</p><div className="ma-registration-points"><span><ShoppingBag size={19} /> Conservas tus funciones de comprador</span><span><PackageOpen size={19} /> Puedes agregar catálogo o menú</span><span><MessageCircle size={19} /> Ayuda disponible por WhatsApp</span></div><p><a className="ma-text-button" href="/mi-cuenta?entry=general&mode=register&intent=buyer">¿Solo quieres comprar? Crear cuenta como comprador</a></p></div><div className="ma-registration-form">{access}</div></section>

      <section className="ma-commercial-section"><div className="ma-commercial-heading"><p className="ma-eyebrow">PREGUNTAS FRECUENTES</p><h2>Antes de registrar tu negocio</h2></div><div className="ma-faq-list"><details><summary><CircleHelp size={19} /> ¿Registrar mi negocio tiene costo?</summary><p>El registro y la creación de la ficha son gratuitos. Cualquier servicio adicional deberá informarse antes de su contratación.</p></details><details><summary><CircleHelp size={19} /> ¿Qué hago si mi negocio ya aparece?</summary><p>Usa el enlace privado de activación que te envíe Mercáu. Ese proceso valida que puedas administrar la ficha existente.</p></details><details><summary><CircleHelp size={19} /> ¿Puedo cambiar la información después?</summary><p>Sí. Una vez vinculado, puedes administrar la información autorizada desde el panel de tu negocio.</p></details><details><summary><CircleHelp size={19} /> ¿Puedo recibir pedidos y entregas?</summary><p>Los productos, pedidos y entregas dependen de las funciones y la cobertura habilitadas para cada negocio.</p></details></div></section>

      <section className="ma-business-final-cta"><h2>Haz que más personas encuentren tu negocio</h2><p>Crea tu cuenta, completa tu ficha y comparte tu página de Mercáu.</p><a href="#registro" className="ma-button primary">Registrar mi negocio gratis <ArrowRight size={18} /></a></section>
    </main>
  );
}
