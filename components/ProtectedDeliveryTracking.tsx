'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase';
type Tracking = { publicId: string; status: string; label: string; updatedAt: string };
export default function ProtectedDeliveryTracking({ publicId }: { publicId: string }) {
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [message, setMessage] = useState('Comprobando tu acceso...');
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const client = getSupabaseBrowserClient();
        const session = client ? (await client.auth.getSession()).data.session : null;
        if (!session) { if (active) { setTracking(null); setMessage('Entra con la cuenta que solicitó el pedido para consultar su seguimiento.'); } return; }
        const response = await fetch(`/api/seguimiento/${encodeURIComponent(publicId)}`, {
          cache: 'no-store', signal: controller.signal,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json();
        if (active) {
          setTracking(response.ok ? data : null);
          setMessage(response.ok ? '' : data.error || 'Seguimiento no disponible.');
        }
      } catch { if (active) { setTracking(null); setMessage('No pudimos actualizar el seguimiento. Intenta nuevamente en unos momentos.'); } }
    }
    void load();
    const timer = setInterval(load, 15000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, [publicId]);
  return <main className="mx-auto max-w-xl p-6 text-gray-900">
    <Link href="/" className="font-black text-[#D82016]">Mercáu</Link>
    <h1 className="my-6 text-2xl font-black">Seguimiento de tu pedido</h1>
    {message && <p role="status">{message}</p>}
    {tracking && <section aria-live="polite"><h2 className="text-xl font-bold">{tracking.publicId}</h2>
      <p className="my-4 font-bold text-[#D82016]">{tracking.label}</p>
      <p className="text-sm">Última actualización: {new Date(tracking.updatedAt).toLocaleString('es-CO')}</p></section>}
    <nav className="mt-6 flex flex-wrap gap-4"><Link href="/mi-cuenta/pedidos" className="font-bold text-[#D82016]">Entrar y ver mis pedidos</Link><Link href="/nosotros#contacto">Necesito ayuda</Link></nav>
  </main>;
}
