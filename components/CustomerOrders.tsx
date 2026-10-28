"use client";
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { CustomerOrder } from '@/lib/customer-order-status';
import CustomerOrderCard from './CustomerOrderCard';
import BackToAccount from './BackToAccount';
import './restaurant-pilot.css';

export default function CustomerOrders() {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<{ userId: string; orders: CustomerOrder[] } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!client) { setReady(true); return; }
    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setReady(true); } });
    client.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } })
      .catch(() => { if (active) setReady(true); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client]);
  useEffect(() => {
    setError('');
    if (!session) { setResult(null); setLoading(false); return; }
    let active = true, controller: AbortController | undefined;
    setLoading(true);
    async function load() {
      controller?.abort();
      const request = new AbortController(); controller = request;
      try {
        const response = await fetch('/api/mi-cuenta/pedidos', { cache: 'no-store', signal: request.signal,
          headers: { Authorization: `Bearer ${session!.access_token}` } });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'No se pudo actualizar.');
        if (active && !request.signal.aborted) { setResult({ userId: session!.user.id, orders: body.orders }); setError(''); }
      } catch {
        if (active && !request.signal.aborted) setError('No se pudo actualizar el seguimiento. Conservamos la última información recibida; intenta nuevamente.');
      } finally { if (active && !request.signal.aborted) setLoading(false); }
    }
    load(); const timer = setInterval(load, 12000);
    return () => { active = false; controller?.abort(); clearInterval(timer); };
  }, [session, refresh]);
  const orders = result?.userId === session?.user.id ? result?.orders || [] : [];
  return <main className="pilot"><header className="pilot-header"><a href="/"><img src="/logo-mercau.png" alt="Mercáu" /></a><span>Mis pedidos</span><BackToAccount /></header>
    <h1>Mis pedidos</h1>
    {!ready ? <p role="status">Cargando tu cuenta...</p> : !session ? <p><a href="/mi-cuenta">Entra con tu cuenta para consultar tus pedidos</a></p> : <>
      <button onClick={() => setRefresh(value => value + 1)} disabled={loading}>Actualizar seguimiento</button>
      {error && <p role="status" className="pilot-notice">{error}</p>}
      {loading && !orders.length && <p role="status">Cargando tus pedidos...</p>}
      {!loading && !error && !orders.length && <p>Aún no tienes pedidos. <a href="/">Explorar negocios</a></p>}
      <section className="pilot-orders" aria-label="Tus pedidos">{orders.map(order => <CustomerOrderCard key={order.public_id} order={order} />)}</section>
    </>}
  </main>;
}
