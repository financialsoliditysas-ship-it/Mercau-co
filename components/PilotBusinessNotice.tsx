'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function PilotBusinessNotice() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [manager, setManager] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    async function checkAccess() {
      const { data } = await client.auth.getSession();
      if (!active || !data.session) {
        if (active) setManager(false);
        return;
      }
      try {
        const response = await fetch('/api/piloto/restaurante?mode=manager', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (active) setManager(response.ok);
      } catch {
        if (active) setManager(false);
      }
    }

    void checkAccess();
    const { data } = client.auth.onAuthStateChange(() => { void checkAccess(); });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  return <section className="my-4 border-l-4 border-[#D82016] bg-[#FFF1F0] p-4 text-sm leading-6 text-[#1F2937]" aria-label="Restaurante de prueba"><h2 className="font-bold">Restaurante ficticio de prueba</h2><p>Fotos y precios ilustrativos. No se prepara comida ni se cobra dinero. Los despachos con Shipday son reales y deben coordinarse.</p><Link href={manager ? '/piloto/restaurante' : '/piloto/restaurante-mercado'} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-[#D82016] px-4 py-2 text-center font-bold text-white">{manager ? 'Recibir pedidos de prueba' : 'Probar pedido con cuenta autorizada'}</Link></section>;
}
