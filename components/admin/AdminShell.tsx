'use client';

import { Activity, BarChart3, Bike, BookOpen, Building2, Images, LayoutDashboard, Menu, ScanText, X } from 'lucide-react';
import { ReactNode, useState } from 'react';

const items = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard, key: 'resumen' },
  { href: '/admin/operaciones', label: 'Operación diaria', icon: Activity, key: 'operaciones' },
  { href: '/admin/negocios', label: 'Negocios', icon: Building2, key: 'negocios' },
  { href: '/admin/catalogos', label: 'Acompañamiento', icon: ScanText, key: 'catalogos' },
  { href: '/admin/catalogos/fotos', label: 'Fotos de productos', icon: Images, key: 'catalogos-fotos' },
  { href: '/admin/envios', label: 'Envíos', icon: Bike, key: 'envios' },
  { href: '/admin/finanzas', label: 'Finanzas', icon: BookOpen, key: 'finanzas' },
  { href: '/admin/metricas', label: 'Métricas', icon: BarChart3, key: 'metricas' }
];

export default function AdminShell({ active, title, description, children }: { active: string; title: string; description: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="min-h-screen bg-[#F6F7F9] text-[#172238]">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white lg:hidden">
      <div className="flex min-h-16 items-center justify-between px-4">
        <a href="/admin" className="flex items-center gap-2 font-black"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#D82016] text-white">M</span>Administración</a>
        <button type="button" onClick={() => setOpen(!open)} aria-label="Abrir menú administrativo" className="grid h-11 w-11 place-items-center rounded-lg border">
          {open ? <X size={20}/> : <Menu size={20}/>} 
        </button>
      </div>
      {open && <nav className="grid gap-1 border-t p-3">{items.map(item => <a key={item.key} href={item.href} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 font-bold ${active === item.key ? 'bg-red-50 text-[#D82016]' : ''}`}><item.icon size={19}/>{item.label}</a>)}</nav>}
    </header>
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-[#172238] p-5 text-white lg:block">
      <a href="/admin" className="flex items-center gap-3 text-xl font-black"><span className="grid h-11 w-11 place-items-center rounded-lg bg-[#D82016]">M</span>Mercáu Admin</a>
      <p className="mt-3 text-xs font-semibold text-slate-400">Control operativo interno</p>
      <nav className="mt-8 grid gap-2">{items.map(item => <a key={item.key} href={item.href} className={`flex min-h-12 items-center gap-3 rounded-lg px-4 font-bold ${active === item.key ? 'bg-[#D82016] text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><item.icon size={20}/>{item.label}</a>)}</nav>
      <a href="/" className="absolute bottom-5 left-5 right-5 flex min-h-11 items-center gap-3 rounded-lg border border-white/20 px-4 font-bold text-slate-200"><Building2 size={19}/>Ver Mercáu</a>
    </aside>
    <main className="lg:ml-64">
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        <header className="mb-6"><p className="text-xs font-black uppercase text-[#D82016]">Panel privado</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">{description}</p></header>
        {children}
      </div>
    </main>
  </div>;
}
