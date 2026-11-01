'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bike, CheckCircle2, Clock3, RefreshCw, Store } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';

type Dashboard = {
  generatedAt: string;
  summary: { ordersToday: number; pendingRestaurant: number; activeDeliveries: number; completedToday: number; issues: number };
  issues: Array<{ key: string; severity: string; type: string; public_id: string; title: string; detail: string; href: string }>;
  orders: Array<{ public_id: string; customer_name: string; business_name: string; is_test: boolean; status: string; delivery_status: string | null; subtotal: number; delivery_fee: number; created_at: string }>;
  active: Array<{ id: string; public_id: string; pickup_name: string; customer_name: string; status: string; courier_name?: string | null; updated_at: string }>;
  balances: { merchants: BalanceRow[]; couriers: BalanceRow[]; vega: BalanceRow };
};
type BalanceRow = { reference: string; name: string; amount: number; orders: number; items: string[] };

const money = (value: number) => `$${Number(value || 0).toLocaleString('es-CO')}`;
const initial: Dashboard = { generatedAt: '', summary: { ordersToday: 0, pendingRestaurant: 0, activeDeliveries: 0, completedToday: 0, issues: 0 }, orders: [], issues: [], active: [], balances: { merchants: [], couriers: [], vega: { reference: 'VEGA_EXPRESS', name: 'Vega Express', amount: 0, orders: 0, items: [] } } };
const orderLabels: Record<string, string> = { pending: 'Esperando aceptación', accepted: 'En preparación', rejected: 'Rechazado', ready: 'Listo para recoger', out_for_delivery: 'En camino', delivered: 'Entregado' };
const deliveryLabels: Record<string, string> = { created: 'Envío registrado', sent_to_shipday: 'Buscando domiciliario', assigned: 'Domiciliario asignado', picked_up: 'Recogido', in_transit: 'En camino', delivered: 'Entregado', cancelled: 'Envío cancelado', failed: 'Entrega no completada', integration_error: 'Error de despacho' };

export default function OperationsPage() {
  const [password, setPassword] = useState('');
  const [data, setData] = useState<Dashboard>(initial);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [references, setReferences] = useState<Record<string, string>>({});
  useEffect(() => { setPassword(sessionStorage.getItem('mercau_admin_password') || ''); }, []);

  const load = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    if (!password) return setMessage('Escribe la clave administrativa.');
    setMessage('Actualizando operación...');
    const response = await fetch('/api/admin/operaciones', { headers: { 'x-admin-password': password }, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) return setMessage(payload.error || 'No se pudo cargar la operación.');
    sessionStorage.setItem('mercau_admin_password', password); setData(payload); setLoaded(true);
    setMessage(`Actualizado ${new Date(payload.generatedAt).toLocaleTimeString('es-CO')}.`);
  }, [password]);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, [loaded, load]);

  async function settle(row: BalanceRow, component: 'MERCHANT_NET' | 'COURIER_SHARE' | 'VEGA_SHARE') {
    const externalReference = (references[`${component}:${row.reference}`] || '').trim();
    if (externalReference.length < 4) return setMessage('Escribe la referencia del pago o del cierre de caja.');
    if (!window.confirm(`Registrar ${money(row.amount)} como liquidado para ${row.name}?`)) return;
    setMessage(`Registrando liquidación de ${row.name}...`);
    const response = await fetch('/api/admin/operaciones', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify({ action: 'record_settlement', component, payeeReference: row.reference, method: 'BANK_TRANSFER', externalReference, snapshotIds: row.items }) });
    const payload = await response.json();
    if (!response.ok || !payload.ok) return setMessage(payload.error || 'No se pudo registrar la liquidación.');
    setMessage(`Liquidación de ${row.name} registrada.`); await load();
  }

  const cards = [
    ['Pedidos hoy', data.summary.ordersToday, Store], ['Esperando negocio', data.summary.pendingRestaurant, Clock3],
    ['Entregas activas', data.summary.activeDeliveries, Bike], ['Entregados hoy', data.summary.completedToday, CheckCircle2],
    ['Requieren atención', data.summary.issues, AlertTriangle]
  ] as const;

  return <AdminShell active="operaciones" title="Operación diaria" description="Supervisa pedidos, entregas, incidencias y saldos confirmados pendientes de liquidación.">
    <form onSubmit={load} className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row"><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Clave administrativa" className="min-h-11 flex-1 rounded-lg border px-4"/><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#D82016] px-5 font-black text-white"><RefreshCw size={18}/>Actualizar</button></form>
    {message && <p role="status" className="mt-3 rounded-lg border bg-white px-4 py-3 text-sm font-bold">{message}</p>}
    {loaded && <>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value, Icon]) => <article key={label} className="rounded-lg border bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase text-slate-500">{label}</p><Icon size={20} className={label === 'Requieren atención' && value ? 'text-[#D82016]' : 'text-slate-500'}/></div><p className="mt-3 text-3xl font-black">{value}</p></article>)}</section>
      <section className="mt-6" aria-labelledby="recent-orders-title"><h2 id="recent-orders-title" className="text-xl font-black">Pedidos recientes</h2><p className="mt-1 text-sm text-slate-600">Últimos 200 pedidos, incluso antes de solicitar domiciliario. Pedidos hoy cuenta solicitudes recibidas en horario de Colombia, incluidos rechazados y pruebas identificadas abajo.</p><div className="mt-3 grid gap-3 lg:grid-cols-2">{data.orders?.length ? data.orders.map(order => <article key={order.public_id} className="rounded-lg border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{order.public_id}</strong><span className="rounded bg-red-50 px-2 py-1 text-sm font-bold text-[#B91C1C]">{orderLabels[order.status] || 'Estado en revisión'}</span></div><p className="mt-2 font-bold">{order.business_name}{order.is_test && <span className="ml-2 text-xs text-amber-800">PRUEBA</span>}</p><p className="mt-1 text-sm"><b>Cliente:</b> {order.customer_name}</p><p className="mt-1 text-sm text-slate-600">{new Date(order.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p><p className="mt-2 text-sm">Productos: {money(order.subtotal)} · Domicilio: {money(order.delivery_fee)} · <b>Total: {money(order.subtotal + order.delivery_fee)}</b></p>{order.delivery_status && <p className="mt-2 text-sm font-bold">Entrega: {deliveryLabels[order.delivery_status] || 'Estado en revisión'}</p>}</article>) : <p className="rounded-lg border bg-white p-5 text-slate-600">No hay pedidos registrados para mostrar.</p>}</div></section>
      <section className="mt-6"><div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-black">Requieren atención</h2><p className="text-sm text-slate-600">Errores, demoras y pedidos sin respuesta.</p></div><a href="/admin/envios" className="font-black text-[#D82016]">Ver envíos</a></div>
        <div className="mt-3 grid gap-3">{data.issues.length ? data.issues.map(issue => <article key={issue.key} className={`rounded-lg border-l-4 bg-white p-4 ${issue.severity === 'critical' ? 'border-l-[#D82016]' : 'border-l-amber-500'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-slate-500">{issue.type} · {issue.public_id}</p><h3 className="font-black">{issue.title}</h3><p className="text-sm text-slate-600">{issue.detail}</p></div><a href={issue.href} className="font-black text-[#D82016]">Revisar</a></div></article>) : <p className="rounded-lg border bg-white p-5 font-bold text-emerald-700">No hay incidencias detectadas.</p>}</div>
      </section>
      <section className="mt-6"><h2 className="text-xl font-black">Entregas activas</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{data.active.length ? data.active.map(order => <article key={order.id} className="rounded-lg border bg-white p-4"><div className="flex justify-between gap-3"><strong>{order.public_id}</strong><span className="rounded bg-red-50 px-2 py-1 text-xs font-black text-[#D82016]">{order.status}</span></div><p className="mt-2 text-sm"><b>Recogida:</b> {order.pickup_name}</p><p className="text-sm"><b>Cliente:</b> {order.customer_name}</p><p className="text-sm"><b>Mensajero:</b> {order.courier_name || 'Pendiente'}</p></article>) : <p className="rounded-lg border bg-white p-5 text-slate-600">No hay entregas activas.</p>}</div></section>
      <section className="mt-6 grid gap-4 xl:grid-cols-2"><Balance title="Negocios por liquidar" rows={data.balances.merchants} component="MERCHANT_NET" references={references} setReferences={setReferences} onSettle={settle}/><Balance title="Mensajeros por liquidar" rows={data.balances.couriers} component="COURIER_SHARE" references={references} setReferences={setReferences} onSettle={settle}/></section>
      <section className="mt-4"><Balance title="Vega Express por liquidar" rows={data.balances.vega.amount ? [data.balances.vega] : []} component="VEGA_SHARE" references={references} setReferences={setReferences} onSettle={settle}/></section>
      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold">Estos saldos incluyen únicamente recaudos confirmados que todavía no figuran como liquidados. Verifica el dinero antes de registrar cada pago.</p>
    </>}
  </AdminShell>;
}

function Balance({ title, rows, component, references, setReferences, onSettle }: { title: string; rows: BalanceRow[]; component: 'MERCHANT_NET' | 'COURIER_SHARE' | 'VEGA_SHARE'; references: Record<string, string>; setReferences: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSettle: (row: BalanceRow, component: 'MERCHANT_NET' | 'COURIER_SHARE' | 'VEGA_SHARE') => Promise<void> }) {
  return <section className="rounded-lg border bg-white p-4"><h2 className="text-lg font-black">{title}</h2><div className="mt-3 grid gap-2">{rows.length ? rows.map(row => { const key = `${component}:${row.reference}`; const disabled = row.reference === 'SIN_MENSAJERO'; return <div key={row.reference} className="border-t py-3 first:border-0"><div className="flex items-center justify-between gap-4"><div><p className="font-bold">{row.name}</p><p className="text-xs text-slate-500">{row.orders} pedido{row.orders === 1 ? '' : 's'}</p></div><strong>{money(row.amount)}</strong></div><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={references[key] || ''} onChange={event => setReferences(current => ({ ...current, [key]: event.target.value }))} placeholder="Referencia del pago" disabled={disabled} className="min-h-10 flex-1 rounded border px-3 text-sm"/><button type="button" disabled={disabled} onClick={() => void onSettle(row, component)} className="min-h-10 rounded bg-slate-900 px-3 text-sm font-black text-white disabled:opacity-50">Registrar liquidación</button></div>{disabled && <p className="mt-2 text-xs font-bold text-amber-700">Primero identifica al mensajero en Shipday.</p>}</div>; }) : <p className="py-3 text-sm text-slate-500">Sin saldos confirmados pendientes.</p>}</div></section>;
}
