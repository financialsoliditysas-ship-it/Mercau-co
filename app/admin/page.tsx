import { Activity, ArrowRight, BarChart3, Bike, BookOpen, Building2 } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';

const sections = [
  { href: '/admin/negocios', title: 'Negocios', description: 'Activa pedidos, define la mensajería y configura el acuerdo de comisión de cada negocio.', icon: Building2, color: 'bg-red-50 text-[#D82016]' },
  { href: '/admin/operaciones', title: 'Operación diaria', description: 'Pedidos pendientes, entregas activas, incidencias y saldos por liquidar.', icon: Activity, color: 'bg-slate-100 text-slate-800' },
  { href: '/admin/envios', title: 'Envíos', description: 'Órdenes, estados de Shipday, direcciones, tracking y reintentos.', icon: Bike, color: 'bg-red-50 text-[#D82016]' },
  { href: '/admin/finanzas', title: 'Finanzas', description: 'Ventas, comisiones, reparto del domicilio, pagos y liquidaciones.', icon: BookOpen, color: 'bg-emerald-50 text-emerald-700' },
  { href: '/admin/metricas', title: 'Métricas', description: 'Visitas, búsquedas, contactos y actividad de los negocios.', icon: BarChart3, color: 'bg-amber-50 text-amber-700' }
];

export default function AdminHome() {
  return <AdminShell active="resumen" title="Administración Mercáu" description="Un solo lugar para supervisar la operación, el dinero y el comportamiento de la plataforma.">
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{sections.map(section => <a key={section.href} href={section.href} className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`grid h-12 w-12 place-items-center rounded-lg ${section.color}`}><section.icon size={23}/></div>
      <h2 className="mt-5 text-xl font-black">{section.title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{section.description}</p>
      <span className="mt-5 flex items-center gap-2 font-black text-[#D82016]">Abrir sección <ArrowRight size={18} className="transition group-hover:translate-x-1"/></span>
    </a>)}</section>
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-black">Estado del panel</h2><p className="mt-2 text-sm leading-6 text-slate-600">Las secciones usan la misma clave administrativa. Los datos operativos permanecen protegidos y no se muestran en el directorio público.</p></section>
  </AdminShell>;
}
