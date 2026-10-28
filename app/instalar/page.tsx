import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpenText, ChevronDown, Download, Heart, HelpCircle, Mail, MapPin, MessageCircle, Search, ShoppingBag, Smartphone, Store, Truck } from "lucide-react";
import InstallMercau from "@/components/InstallMercau";
import InstallLandingMetrics from "@/components/InstallLandingMetrics";

export const metadata: Metadata = {
  title: "Instalar Mercáu | Negocios del Bajo Cauca",
  description: "Instala Mercáu gratis en tu celular y encuentra negocios, productos y servicios del Bajo Cauca.",
  alternates: { canonical: "/instalar" },
  openGraph: {
    type: "website", locale: "es_CO", siteName: "Mercáu", title: "Instala Mercáu en tu celular",
    description: "Encuentra negocios, productos y servicios del Bajo Cauca. La instalación es gratuita.", url: "/instalar",
    images: [{ url: "/og-instalar-mercau.jpg", width: 1200, height: 630, alt: "Instala Mercáu, negocios del Bajo Cauca en tu celular" }],
  },
  twitter: { card: "summary_large_image", title: "Instala Mercáu en tu celular", description: "Encuentra negocios, productos y servicios del Bajo Cauca. La instalación es gratuita.", images: ["/og-instalar-mercau.jpg"] },
};

const benefits = [
  { icon: Search, title: "Encuentra negocios", copy: "Busca por municipio, categoría o nombre." },
  { icon: BookOpenText, title: "Consulta catálogos", copy: "Conoce productos, menús, precios y horarios." },
  { icon: MessageCircle, title: "Contacta directamente", copy: "Habla con cada negocio desde su ficha." },
  { icon: Truck, title: "Solicita entregas", copy: "Pide recogidas y envíos donde exista cobertura." },
];

const faqs = [
  ["¿Instalar Mercáu tiene costo?", "No. La instalación es gratuita y agrega un acceso directo de Mercáu en la pantalla de tu celular."],
  ["¿Tengo que crear una cuenta para explorar?", "No. Puedes buscar negocios y consultar sus fichas sin registrarte. La cuenta sirve para guardar actividad, gestionar pedidos o administrar un negocio."],
  ["¿Cómo se instala en Android?", "Toca el botón Instalar Mercáu. Si Chrome no muestra la instalación automática, la página te indicará cómo hacerlo desde el menú del navegador."],
  ["¿Cómo se instala en iPhone?", "Abre Mercáu en Safari, toca Compartir y luego Agregar a Inicio. El botón de instalación te mostrará estos pasos."],
  ["¿Puedo usar Mercáu sin instalarla?", "Sí. Puedes seguir usando www.mercau.co desde cualquier navegador. La instalación solo facilita el acceso desde la pantalla de inicio."],
  ["¿Cómo registro mi negocio?", "Entra en Registrar mi negocio, crea o usa tu cuenta y completa la información de tu ficha. Podrás agregar fotos, horarios y catálogo o menú."],
  ["¿Los pedidos y envíos están disponibles en todos los negocios?", "No necesariamente. Los pedidos y las entregas dependen de las funciones activadas por cada negocio y de la cobertura logística disponible."],
];

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <InstallLandingMetrics />
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 text-white">
        <Link href="/" className="flex items-center gap-3 font-black"><img src="/logo-mercau.png" alt="Mercáu" width="46" height="46" className="rounded-lg" /><span className="text-xl">Mercáu</span></Link>
        <nav className="hidden items-center gap-6 text-sm font-bold md:flex" aria-label="Navegación de instalación"><a href="#beneficios" className="hover:text-red-200">Qué puedes hacer</a><a href="#como-funciona" className="hover:text-red-200">Cómo funciona</a><a href="#preguntas" className="hover:text-red-200">Preguntas</a></nav>
        <Link href="/mi-cuenta" className="rounded-md border border-white/70 px-4 py-2 text-sm font-black hover:bg-white hover:text-slate-950">Entrar</Link>
      </header>

      <section className="relative flex min-h-[82vh] items-end overflow-hidden bg-slate-950 px-5 pb-12 pt-28 text-white sm:items-center sm:pb-16">
        <img src="/bajo-cauca-hero.png" alt="Paisaje del Bajo Cauca" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-slate-950/55" />
        <div className="relative mx-auto w-full max-w-7xl">
          <p className="text-sm font-black uppercase text-red-200">El comercio local, más cerca de ti</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">Instala Mercáu en tu celular</h1>
          <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-white sm:text-xl">Encuentra negocios, productos y servicios del Bajo Cauca desde un acceso directo en tu pantalla.</p>
          <div className="mt-7 inline-flex rounded-lg bg-white p-1 shadow-xl"><InstallMercau prominent /></div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-white/90"><span className="inline-flex items-center gap-2"><BadgeCheck size={17} /> Instalación gratuita</span><span className="inline-flex items-center gap-2"><Smartphone size={17} /> Android y iPhone</span><span className="inline-flex items-center gap-2"><Search size={17} /> Explora sin registrarte</span></div>
        </div>
      </section>

      <section id="beneficios" className="scroll-mt-8 border-b border-slate-200 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-3xl"><p className="text-sm font-black uppercase text-[#D82016]">Todo en un mismo lugar</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">Descubre lo que hay cerca de ti</h2><p className="mt-4 text-lg leading-8 text-slate-600">Mercáu conecta a las personas con la información y los canales de atención de los negocios de su territorio.</p></div>
          <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ icon: Icon, title, copy }) => <article key={title} className="border-l-4 border-[#D82016] pl-5"><Icon aria-hidden="true" className="text-[#D82016]" size={28} /><h3 className="mt-4 text-xl font-black">{title}</h3><p className="mt-2 leading-7 text-slate-600">{copy}</p></article>)}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-8 bg-slate-50 py-14 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div><p className="text-sm font-black uppercase text-[#D82016]">Fácil de empezar</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">Mercáu en tres pasos</h2><p className="mt-4 leading-7 text-slate-600">Instálala, explora el directorio y elige cómo quieres conectar con cada negocio.</p></div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[["1", "Instala", "Agrega Mercáu a la pantalla de inicio de tu celular."], ["2", "Explora", "Busca negocios por nombre, categoría o municipio."], ["3", "Conecta", "Consulta su información, catálogo y canales disponibles."]].map(([number, title, copy]) => <li key={number} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#D82016] font-black text-white">{number}</span><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-2 leading-7 text-slate-600">{copy}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="py-14 md:py-20"><div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-6 sm:p-8"><ShoppingBag className="text-[#D82016]" size={32} /><p className="mt-5 text-sm font-black uppercase text-[#D82016]">Para compradores</p><h2 className="mt-2 text-3xl font-black">Encuentra y compra local</h2><ul className="mt-5 grid gap-3 leading-7 text-slate-700"><li className="flex gap-3"><Heart className="mt-1 shrink-0 text-[#D82016]" size={19} /> Guarda tus negocios favoritos.</li><li className="flex gap-3"><MapPin className="mt-1 shrink-0 text-[#D82016]" size={19} /> Explora la oferta de tu municipio.</li><li className="flex gap-3"><MessageCircle className="mt-1 shrink-0 text-[#D82016]" size={19} /> Contacta al negocio desde su ficha.</li></ul><Link href="/#directorio" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-md bg-slate-950 px-5 font-black text-white hover:bg-slate-800">Explorar negocios <ArrowRight size={18} /></Link></div>
        <div className="rounded-lg border border-red-200 bg-[#FFF7F6] p-6 sm:p-8"><Store className="text-[#D82016]" size={32} /><p className="mt-5 text-sm font-black uppercase text-[#D82016]">Para negocios</p><h2 className="mt-2 text-3xl font-black">Tu vitrina digital en Mercáu</h2><p className="mt-4 leading-7 text-slate-700">Crea una página para tu negocio, publica fotos, horarios y productos, y comparte el enlace con tus clientes.</p><Link href="/negocios/registro" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-md bg-[#D82016] px-5 font-black text-white hover:bg-[#B91C1C]">Registrar mi negocio <ArrowRight size={18} /></Link></div>
      </div></section>

      <section className="bg-slate-950 py-14 text-white md:py-20"><div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.8fr_1.2fr] md:items-center"><div><MapPin className="text-red-300" size={32} /><h2 className="mt-4 text-3xl font-black">Hecho para el Bajo Cauca</h2><p className="mt-4 leading-7 text-white/75">El directorio contempla negocios de los municipios de la subregión. La cantidad de fichas y la cobertura logística pueden variar.</p></div><div className="flex flex-wrap gap-3" aria-label="Municipios del directorio">{["Cáceres", "Caucasia", "El Bagre", "Nechí", "Tarazá", "Zaragoza"].map((municipality) => <span key={municipality} className="rounded-full border border-white/25 px-4 py-2 font-bold">{municipality}</span>)}</div></div></section>

      <section id="preguntas" className="scroll-mt-8 py-14 md:py-20"><div className="mx-auto max-w-4xl px-5"><p className="text-sm font-black uppercase text-[#D82016]">Resuelve tus dudas</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">Preguntas frecuentes</h2><div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">{faqs.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black">{question}<ChevronDown aria-hidden="true" className="shrink-0 text-[#D82016] transition-transform group-open:rotate-180" size={22} /></summary><p className="mt-3 max-w-3xl pr-8 leading-7 text-slate-600">{answer}</p></details>)}</div></div></section>

      <section className="bg-[#D82016] px-5 py-14 text-center text-white md:py-20"><div className="mx-auto max-w-3xl"><Download aria-hidden="true" className="mx-auto" size={34} /><h2 className="mt-4 text-3xl font-black sm:text-4xl">Lleva el comercio local contigo</h2><p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/90">Instala Mercáu y entra al directorio desde el icono de tu pantalla cuando lo necesites.</p><div className="mt-7 inline-flex rounded-lg bg-white p-1 shadow-xl"><InstallMercau prominent /></div></div></section>

      <section className="border-b border-slate-200 bg-slate-50 px-5 py-14 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="max-w-2xl">
            <HelpCircle aria-hidden="true" className="text-[#D82016]" size={32} />
            <p className="mt-4 text-sm font-black uppercase text-[#D82016]">Contacto y ayuda</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">¿Necesitas ayuda con Mercáu?</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">Escríbenos si necesitas orientación para instalar Mercáu, crear tu cuenta, registrar tu negocio o utilizar alguno de nuestros servicios.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <a href="https://wa.me/573207637511?text=Hola%2C%20necesito%20ayuda%20con%20Merc%C3%A1u." target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#D82016] px-6 font-black text-white hover:bg-[#B91C1C]">
              <MessageCircle aria-hidden="true" size={20} /> WhatsApp
            </a>
            <a href="mailto:gerencia@financialsolidity.com?subject=Ayuda%20con%20Merc%C3%A1u" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-6 font-black text-slate-900 hover:border-slate-500">
              <Mail aria-hidden="true" size={20} /> Correo electrónico
            </a>
          </div>
        </div>
      </section>

      <footer className="px-5 py-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left"><Link href="/" className="flex items-center gap-3 font-black"><img src="/logo-mercau.png" alt="" width="40" height="40" className="rounded-md" /><span>Mercáu, Directorio Digital del Bajo Cauca</span></Link><nav className="flex flex-wrap justify-center gap-4 text-sm font-bold text-slate-600" aria-label="Pie de página"><Link href="/nosotros">Conoce Mercáu</Link><Link href="/negocios/registro">Registrar negocio</Link><Link href="/mi-cuenta">Mi cuenta</Link></nav></div></footer>
    </main>
  );
}
