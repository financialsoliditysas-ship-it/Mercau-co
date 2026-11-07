'use client';

import { useEffect, useState } from 'react';

type Line = { name: string; quantity: number; unitPrice: number; note?: string; selections?: Array<{ groupName?: string; choices?: Array<{ name?: string }> }> };
type Order = {
  public_id: string;
  status: string;
  instructions: string;
  lines: Line[];
  subtotal: number;
  delivery_mode: string;
  restaurant_name: string;
  merchant_net: number | null;
};

const money = (value: number | null) => value === null ? 'No disponible' : `$${value.toLocaleString('es-CO')}`;

export default function RestaurantOrderAction({ token }: { token: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    const response = await fetch(`/api/gestionar-pedido/${encodeURIComponent(token)}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo cargar el pedido.');
    setOrder(result.order);
  }

  useEffect(() => { void load().catch(error => setError(error instanceof Error ? error.message : 'No se pudo cargar el pedido.')); }, [token]);

  async function action(value: 'accepted' | 'rejected' | 'ready') {
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await fetch(`/api/gestionar-pedido/${encodeURIComponent(token)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'La acción ya no está disponible.');
      setMessage(result.message || 'Pedido actualizado.');
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo actualizar el pedido.');
    } finally { setBusy(false); }
  }

  if (error && !order) return <main className="min-h-screen bg-[#fff7f7] px-5 py-10 text-[#151a2b]"><section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm"><h1 className="text-2xl font-black">Pedido no disponible</h1><p className="mt-3 text-slate-600">{error}</p></section></main>;
  if (!order) return <main className="min-h-screen bg-[#fff7f7] px-5 py-10 text-[#151a2b]"><p className="mx-auto max-w-md text-center font-bold">Cargando pedido...</p></main>;

  const pending = order.status === 'pending';
  const accepted = order.status === 'accepted';
  const rejected = order.status === 'rejected';
  const ready = order.status === 'ready';
  return <main className="min-h-screen bg-[#fff7f7] px-4 py-5 text-[#151a2b] sm:px-6">
    <section className="mx-auto max-w-md overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-red-100">
      <header className="bg-[#e21412] px-5 py-5 text-white"><p className="text-sm font-bold opacity-90">Mercáu · Gestión de pedido</p><h1 className="mt-1 text-2xl font-black">{order.restaurant_name}</h1><p className="mt-2 font-bold">{order.public_id}</p></header>
      <div className="space-y-5 p-5">
        <div className="rounded-xl bg-[#fff0f0] p-4"><p className="text-sm font-bold text-red-700">Estado</p><p className="mt-1 text-lg font-black">{pending ? 'Pedido pendiente' : accepted ? 'Pedido aceptado' : ready ? 'Pedido listo. Mercáu coordina la recogida.' : rejected ? 'Pedido rechazado' : order.status}</p></div>
        <div><h2 className="text-lg font-black">Productos</h2><ul className="mt-3 space-y-3">{order.lines.map((line, index) => <li key={`${line.name}-${index}`} className="border-b border-slate-100 pb-3 last:border-0"><div className="flex justify-between gap-3"><span className="font-bold">{line.quantity} x {line.name}</span><span className="font-bold">{money(line.unitPrice * line.quantity)}</span></div>{line.selections?.flatMap(group => group.choices || []).map((choice, choiceIndex) => <p key={choiceIndex} className="text-sm text-slate-600">{choice.name}</p>)}{line.note && <p className="text-sm text-slate-600">Observación: {line.note}</p>}</li>)}</ul></div>
        {order.instructions && <div><h2 className="text-lg font-black">Observaciones</h2><p className="mt-2 rounded-xl bg-slate-50 p-3 text-slate-700">{order.instructions}</p></div>}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4"><span className="font-bold">Valor para el negocio</span><strong className="text-xl text-[#e21412]">{money(order.merchant_net)}</strong></div>
        {message && <p role="status" className="rounded-xl bg-green-50 p-3 font-bold text-green-800">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 font-bold text-red-800">{error}</p>}
        {pending && <div className="grid gap-3"><button type="button" disabled={busy} onClick={() => void action('accepted')} className="min-h-12 rounded-xl bg-[#e21412] px-4 font-black text-white disabled:opacity-50">Aceptar y preparar</button><button type="button" disabled={busy} onClick={() => void action('rejected')} className="min-h-12 rounded-xl border border-slate-300 px-4 font-black text-slate-800 disabled:opacity-50">Rechazar pedido</button></div>}
        {accepted && <button type="button" disabled={busy} onClick={() => void action('ready')} className="min-h-12 w-full rounded-xl bg-[#e21412] px-4 font-black text-white disabled:opacity-50">Pedido listo</button>}
        {ready && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-center font-black text-green-800">Pedido listo. Mercáu coordina la recogida.</p>}
        {rejected && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center font-black text-slate-700">Pedido rechazado</p>}
      </div>
    </section>
  </main>;
}
