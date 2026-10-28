'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Banknote, Bike, Building2, ChevronDown, CircleDollarSign, Search, Store } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';

type FinanceOrder = {
  id: string; order_public_id: string; restaurant_name: string; created_at: string;
  customer_name: string; customer_phone: string; delivery_address: string;
  courier: null | { id: string; name: string; phone: string; vehicle: string; plate: string };
  product_subtotal: number; delivery_fee: number; customer_total: number;
  product_base_subtotal:number;customer_markup_total:number;merchant_commission_rate_bps:number;
  merchant_commission_total: number;merchant_commission_share:number; merchant_commission_vat: number; merchant_net: number;
  delivery_mode:'MERCAU'|'OWN';merchant_delivery_share:number;mercau_delivery_share: number; courier_share: number; vega_share: number;
  payment_method: string; payment_status: string; settlement_status: string;
  payment_reference: string | null; payment_reported_at: string | null;
  lines: Array<{ name?: string; quantity?: number; unitPrice?: number }>;
  delivery: null | { public_id: string; status: string; shipday_order_id: string | null; shipday_tracking_url: string | null };
};

const money = (value: number) => `$${Number(value || 0).toLocaleString('es-CO')}`;
const label: Record<string, string> = { PENDING: 'Pendiente', CONFIRMED: 'Confirmado', FAILED: 'Fallido', REFUNDED: 'Devuelto', PARTIAL: 'Parcial', SETTLED: 'Liquidado', DISPUTED: 'En revisión', CASH: 'Efectivo', BREB_QR: 'Bre-B / QR' };

export default function AdminFinancePage() {
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [references, setReferences] = useState<Record<string, string>>({});

  useEffect(() => { setPassword(sessionStorage.getItem('mercau_admin_password') || ''); }, []);
  async function load(event?: FormEvent) {
    event?.preventDefault(); setMessage('Cargando información financiera...');
    const response = await fetch('/api/admin/finanzas', { headers: { 'x-admin-password': password } });
    const payload = await response.json();
    if (!response.ok || !payload.ok) return setMessage(payload.error || 'No se pudo cargar el libro.');
    sessionStorage.setItem('mercau_admin_password', password);
    setOrders(payload.orders || []); setTotals(payload.totals || {}); setMessage(`${payload.orders?.length || 0} pedidos contabilizados.`);
  }
  async function confirmPayment(order: FinanceOrder) {
    const reference = (references[order.id] || order.payment_reference || '').trim();
    if (reference.length < 4) return setMessage('Escribe o verifica la referencia bancaria antes de confirmar.');
    setMessage(`Confirmando el pago de ${order.order_public_id}...`);
    const response = await fetch('/api/admin/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ action: 'confirm_payment', snapshotId: order.id, reference }) });
    const payload = await response.json();
    if (!response.ok || !payload.ok) return setMessage(payload.error || 'No se pudo confirmar el pago.');
    setMessage(`Pago de ${order.order_public_id} confirmado.`); await load();
  }

  const visible = useMemo(() => orders.filter(order => {
    const needle = search.trim().toLowerCase();
    const matches = !needle || [order.order_public_id, order.customer_name, order.customer_phone, order.restaurant_name, order.delivery?.public_id, order.delivery?.shipday_order_id].some(value => String(value || '').toLowerCase().includes(needle));
    return matches && (paymentFilter === 'ALL' || order.payment_status === paymentFilter);
  }), [orders, search, paymentFilter]);

  const cards = [
    { label: 'Recaudo registrado', value: totals.customerTotal, icon: CircleDollarSign, tone: 'bg-slate-900 text-white' },
    { label: 'Por entregar a negocios', value: totals.merchantNet, icon: Store, tone: 'bg-white text-[#172238]' },
    { label: 'Mercáu bruto', value: totals.mercauGross, icon: Banknote, tone: 'bg-red-50 text-[#B81810]' },
    { label: 'Por pagar a repartidores', value: totals.courierShare, icon: Bike, tone: 'bg-white text-[#172238]' },
    { label: 'Participación Vega Express', value: totals.vegaShare, icon: Building2, tone: 'bg-white text-[#172238]' }
  ];

  return <AdminShell active="finanzas" title="Finanzas" description="Consulta cada pedido, quién lo solicitó, cómo se distribuye el dinero y qué valores siguen pendientes de pago o liquidación.">
    <form onSubmit={load} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row">
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Clave administrativa" className="min-h-11 flex-1 rounded-lg border px-4" />
      <button className="min-h-11 rounded-lg bg-[#D82016] px-6 font-black text-white">Cargar información</button>
    </form>
    {message && <p className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold">{message}</p>}
    {orders.length > 0 && <>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(card => <article key={card.label} className={`rounded-lg border border-slate-200 p-4 shadow-sm ${card.tone}`}>
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase opacity-70">{card.label}</p><card.icon size={20}/></div><p className="mt-3 text-2xl font-black">{money(Number(card.value))}</p>
      </article>)}</section>
      <p className="mt-3 text-xs font-semibold text-slate-500">Mercáu bruto incluye el IVA de la comisión. IVA identificado: {money(Number(totals.commissionVat))}.</p>
      <section className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px]">
        <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={19}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido, cliente, negocio o Shipday" className="min-h-11 w-full rounded-lg border pl-10 pr-3"/></label>
        <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="min-h-11 rounded-lg border px-3 font-bold"><option value="ALL">Todos los pagos</option><option value="PENDING">Pago pendiente</option><option value="CONFIRMED">Pago confirmado</option><option value="REFUNDED">Devuelto</option></select>
      </section>
      <section className="mt-4 grid gap-3">{visible.map(order => <details key={order.id} className="group rounded-lg border border-slate-200 bg-white shadow-sm">
        <summary className="grid cursor-pointer list-none gap-3 p-4 md:grid-cols-[160px_1fr_1fr_150px_32px] md:items-center">
          <div><p className="font-black">{order.order_public_id}</p><p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString('es-CO')}</p></div>
          <div><p className="text-xs font-bold uppercase text-slate-500">Cliente</p><p className="font-bold">{order.customer_name}</p><p className="text-xs text-slate-500">{order.customer_phone}</p></div>
          <div><p className="text-xs font-bold uppercase text-slate-500">Negocio</p><p className="font-bold">{order.restaurant_name}</p><p className="text-xs text-slate-500">{order.delivery_address || 'Dirección no disponible'}</p></div>
          <div><p className="text-xs font-bold uppercase text-slate-500">Total</p><p className="text-xl font-black">{money(order.customer_total)}</p><span className={`mt-1 inline-flex rounded px-2 py-1 text-xs font-black ${order.payment_status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{label[order.payment_status] || order.payment_status}</span></div>
          <ChevronDown className="transition group-open:rotate-180"/>
        </summary>
        <div className="border-t border-slate-100 p-4"><div className="grid gap-5 lg:grid-cols-3">
          <div><h3 className="font-black">Detalle del pedido</h3><ul className="mt-3 grid gap-2 text-sm">{order.lines?.length ? order.lines.map((line, index) => <li key={index} className="flex justify-between gap-3"><span>{line.quantity || 1} × {line.name || 'Producto'}</span><b>{money(Number(line.unitPrice || 0) * Number(line.quantity || 1))}</b></li>) : <li>Sin productos detallados.</li>}</ul></div>
          <div><h3 className="font-black">Distribución</h3><dl className="mt-3 grid grid-cols-[1fr_auto] gap-2 text-sm"><dt>Productos publicados</dt><dd>{money(order.product_subtotal)}</dd><dt>Domicilio</dt><dd>{money(order.delivery_fee)}</dd><dt>Comisión total Mercáu</dt><dd>{money(order.merchant_commission_total)}</dd><dt>Neto de productos para negocio</dt><dd className="font-bold">{money(order.merchant_net)}</dd><dt>Domicilio para negocio</dt><dd>{money(order.merchant_delivery_share)}</dd><dt>Mercáu por domicilio</dt><dd>{money(order.mercau_delivery_share)}</dd><dt>Repartidor</dt><dd>{money(order.courier_share)}</dd><dt>Vega Express</dt><dd>{money(order.vega_share)}</dd></dl></div>
          <div><h3 className="font-black">Entrega y liquidación</h3><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-slate-500">Modalidad</dt><dd className="font-bold">{order.delivery_mode==='OWN'?'Domiciliario del negocio':'Domiciliario Mercáu'}</dd></div><div><dt className="text-slate-500">Envío Mercáu</dt><dd className="font-bold">{order.delivery?.public_id || (order.delivery_mode==='OWN'?'No aplica':'Todavía no creado')}</dd></div><div><dt className="text-slate-500">Estado</dt><dd className="font-bold">{order.delivery?.status || 'Pedido comercial'}</dd></div><div><dt className="text-slate-500">Shipday</dt><dd>{order.delivery?.shipday_order_id || 'No enviado'}</dd></div><div><dt className="text-slate-500">Mensajero</dt><dd className="font-bold">{order.delivery_mode==='OWN'?'Gestionado por el negocio':order.courier?.name || 'No informado por Shipday'}</dd>{order.courier?.id && <dd className="text-xs text-slate-500">ID Shipday: {order.courier.id}</dd>}</div><div><dt className="text-slate-500">Pago</dt><dd>{label[order.payment_method] || order.payment_method} · {label[order.payment_status] || order.payment_status}</dd></div><div><dt className="text-slate-500">Liquidación</dt><dd>{label[order.settlement_status] || order.settlement_status}</dd></div></dl>
            {order.payment_method === 'BREB_QR' && order.payment_status === 'PENDING' && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3"><p className="font-black">Transferencia contra entrega pendiente de conciliación</p><p className="text-sm">Confirma únicamente cuando el ingreso aparezca en Bancolombia.</p><input className="mt-2 min-h-11 w-full rounded border px-3" value={references[order.id] ?? order.payment_reference ?? ''} onChange={e => setReferences(current => ({ ...current, [order.id]: e.target.value }))} placeholder="Referencia bancaria verificada"/><button type="button" onClick={() => confirmPayment(order)} className="mt-2 min-h-11 rounded bg-emerald-700 px-4 font-black text-white">Registrar ingreso confirmado</button></div>}
            {order.delivery?.shipday_tracking_url && <a className="mt-3 inline-flex font-black text-[#D82016]" href={order.delivery.shipday_tracking_url} target="_blank" rel="noreferrer">Abrir tracking</a>}</div>
        </div></div>
      </details>)}</section>
      {visible.length === 0 && <p className="mt-4 rounded-lg border bg-white p-6 text-center font-bold text-slate-500">No hay pedidos que coincidan con el filtro.</p>}
    </>}
  </AdminShell>;
}
