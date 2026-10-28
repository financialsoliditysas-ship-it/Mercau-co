import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  MapPin,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from "lucide-react";

export const metadata = {
  title: "Conoce Mercáu | Plataforma digital del Bajo Cauca",
  description:
    "Conoce cómo Mercáu conecta a compradores, negocios y servicios del Bajo Cauca.",
};

const buyerSteps = [
  "Buscar un negocio o servicio.",
  "Elegir municipio o categoría.",
  "Consultar la información.",
  "Contactar por WhatsApp o teléfono.",
  "Comprar directamente con el negocio.",
  "Solicitar a Mercáu recoger y entregar la compra, cuando exista cobertura.",
];

const businessSteps = [
  "Registrar o reclamar el negocio.",
  "Completar la ficha.",
  "Agregar fotos, horarios y contactos.",
  "Recibir visitas, llamadas y mensajes.",
  "Activar entregas propias o solicitar la red logística de Mercáu.",
];

const faqs = [
  ["¿Necesito una cuenta para buscar negocios?", "No. Puedes explorar el directorio y consultar las fichas sin registrarte."],
  ["¿La cuenta de comprador es obligatoria?", "No. Es opcional y permite organizar favoritos, envíos y pedidos disponibles dentro de Mercáu."],
  ["¿Cómo administro la ficha de mi negocio?", "Debes crear una cuenta de negocio, registrar una ficha nueva o reclamar una ficha existente mediante una invitación autorizada."],
  ["¿Puedo comprar directamente en Mercáu?", "Mercáu conecta actualmente a compradores y negocios. La compra puede acordarse directamente con el negocio. El marketplace transaccional completo se implementará progresivamente."],
  ["¿Mercáu puede recoger mi compra?", "Puedes solicitar una recogida y entrega cuando exista cobertura logística para el lugar, horario y tipo de producto."],
  ["¿Mercáu llegará a otros municipios?", "La plataforma puede ampliar progresivamente su cobertura según la presencia de negocios y la disponibilidad operativa."],
];

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-6 grid gap-3">
      {items.map((item, index) => (
        <li key={item} className="flex items-start gap-3 border-b border-slate-200 pb-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#D82016] text-sm font-black text-white">
            {index + 1}
          </span>
          <span className="pt-1 font-semibold leading-6 text-slate-700">{item}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Page() {
  return (
    <main className="min-h-screen bg-white text-[#1F2937]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo-mercau.png" alt="Mercáu" className="h-11 w-11 rounded-md object-cover" />
            <strong className="text-2xl font-black text-[#D82016]">Mercáu</strong>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-bold" aria-label="Navegación principal">
            <Link href="/#directorio" className="hidden px-3 py-2 sm:block">Explorar negocios</Link>
            <Link href="/mi-cuenta" className="rounded-md border border-slate-300 px-3 py-2">Mi cuenta</Link>
          </nav>
        </div>
      </header>

      <section className="relative min-h-[34rem] overflow-hidden bg-[#1F2937] text-white">
        <img src="/bajo-cauca-hero.png" alt="Territorio del Bajo Cauca" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#1F2937]/75" />
        <div className="relative mx-auto flex min-h-[34rem] max-w-7xl items-end px-4 pb-14 pt-24 md:px-6 md:pb-20">
          <div className="max-w-4xl">
            <p className="text-sm font-black uppercase text-white">Conoce Mercáu</p>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl md:text-6xl">
              La plataforma digital del Bajo Cauca
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-white sm:text-xl">
              Mercáu es la plataforma digital del Bajo Cauca que conecta a las personas con negocios, productos y servicios de su territorio.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/#directorio" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-[#D82016] px-5 font-black text-white">Explorar negocios <ArrowRight size={18} /></Link>
              <Link href="/negocios/registro" className="inline-flex min-h-12 items-center rounded-md border border-white bg-white px-5 font-black text-[#1F2937]">Registrar mi negocio</Link>
              <Link href="/enviar" className="inline-flex min-h-12 items-center rounded-md border border-white px-5 font-black text-white">Solicitar envío</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-20">
        <div>
          <p className="text-sm font-black uppercase text-[#D82016]">Qué es Mercáu</p>
          <h2 className="mt-2 text-3xl font-black">Comercio local conectado</h2>
          <p className="mt-5 text-lg leading-8 text-slate-700">Mercáu reúne información de negocios y servicios para que las personas puedan encontrarlos, conocerlos y contactarlos con mayor facilidad.</p>
          <p className="mt-4 text-lg leading-8 text-slate-700">Actualmente conectamos compradores y negocios. Las compras pueden realizarse directamente con cada negocio y las funciones transaccionales se incorporarán progresivamente.</p>
        </div>
        <div>
          <p className="text-sm font-black uppercase text-[#D82016]">Nuestro propósito</p>
          <h2 className="mt-2 text-3xl font-black">Más oportunidades en el territorio</h2>
          <p className="mt-5 text-lg leading-8 text-slate-700">Fortalecer el comercio local y crear nuevas oportunidades para los negocios, compradores y prestadores de servicios del Bajo Cauca.</p>
          <div className="mt-6 flex items-start gap-3 border-l-4 border-[#D82016] pl-4">
            <CheckCircle2 className="mt-1 shrink-0 text-[#D82016]" />
            <p className="font-semibold leading-7">Buscar negocios no requiere una cuenta. Los compradores pueden registrarse de manera opcional.</p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 md:grid-cols-2 md:px-6">
          <div>
            <ShoppingBag className="text-[#D82016]" size={34} />
            <h2 className="mt-4 text-3xl font-black">Para compradores</h2>
            <p className="mt-3 leading-7 text-slate-700">Encuentra información útil y decide cómo contactar o comprar. Crear una cuenta es opcional.</p>
            <Steps items={buyerSteps} />
          </div>
          <div>
            <Store className="text-[#D82016]" size={34} />
            <h2 className="mt-4 text-3xl font-black">Para dueños de negocio</h2>
            <p className="mt-3 leading-7 text-slate-700">La cuenta es necesaria para administrar la ficha y mantener actualizada la información pública.</p>
            <Steps items={businessSteps} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-3 md:px-6 md:py-20">
        <div>
          <Truck className="text-[#D82016]" size={34} />
          <h2 className="mt-4 text-2xl font-black">Envíos y recogidas</h2>
          <p className="mt-3 leading-7 text-slate-700">Mercáu permite solicitar la recogida de una compra o el envío de un paquete. La disponibilidad depende de la cobertura logística, el horario, la ubicación y el tipo de producto.</p>
        </div>
        <div>
          <Building2 className="text-[#D82016]" size={34} />
          <h2 className="mt-4 text-2xl font-black">Empresas e instituciones</h2>
          <p className="mt-3 leading-7 text-slate-700">Podemos conversar sobre directorio, visibilidad comercial, campañas y necesidades logísticas. Las soluciones se definen según el alcance disponible; Mercáu todavía no ofrece un módulo empresarial completo.</p>
        </div>
        <div>
          <MapPin className="text-[#D82016]" size={34} />
          <h2 className="mt-4 text-2xl font-black">Municipios</h2>
          <p className="mt-3 leading-7 text-slate-700">El directorio contempla Cáceres, Caucasia, El Bagre, Nechí, Tarazá y Zaragoza. La cantidad de negocios y la cobertura logística pueden variar en cada municipio.</p>
        </div>
      </section>

      <section className="bg-[#1F2937] py-16 text-white md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <Users className="text-white" size={34} />
          <h2 className="mt-4 text-3xl font-black">Preguntas frecuentes</h2>
          <div className="mt-7 divide-y divide-white/20 border-y border-white/20">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="cursor-pointer list-none pr-6 text-lg font-black">{question}</summary>
                <p className="mt-3 max-w-3xl leading-7 text-white/85">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <p className="text-sm font-black uppercase text-[#D82016]">Contacto</p>
        <h2 className="mt-2 text-3xl font-black">Hablemos</h2>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">Para soporte, registro de negocios, alianzas o información sobre cobertura, utiliza nuestros canales oficiales.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="https://wa.me/573207637511?text=Hola%2C%20conoc%C3%AD%20Merc%C3%A1u%20en%20su%20p%C3%A1gina%20web%20y%20quiero%20recibir%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios." className="inline-flex min-h-12 items-center rounded-md bg-[#D82016] px-5 font-black text-white">WhatsApp</a>
          <a href="mailto:gerencia@financialsolidity.com" className="inline-flex min-h-12 items-center rounded-md border border-slate-300 px-5 font-black">Correo electrónico</a>
        </div>
      </section>

      <footer className="bg-[#D82016] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 md:px-6">
          <strong className="text-2xl font-black">Mercáu</strong>
          <nav className="flex flex-wrap gap-4 text-sm font-bold" aria-label="Pie de página">
            <Link href="/">Inicio</Link><Link href="/#directorio">Negocios</Link><Link href="/enviar">Solicitar envío</Link><Link href="/mi-cuenta">Mi cuenta</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
