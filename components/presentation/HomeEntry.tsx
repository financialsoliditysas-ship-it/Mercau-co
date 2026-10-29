'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { trackPublicMetric } from '@/lib/marketing-attribution';

const legacyDestinations: Record<string, string> = {
  '#directorio': '/comprar/explorar',
  '#favoritos': '/comprar/favoritos',
  '#cuenta': '/mi-cuenta?entry=general',
  '#inscripcion': '/negocios/registro',
};
const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

export default function HomeEntry() {
  const router = useRouter();
  const visited = useRef(false);

  useEffect(() => {
    if (!visited.current) {
      visited.current = true;
      try { trackPublicMetric('Visita', { notes: 'Home presentación' }); }
      catch { /* Optional metrics must not block legacy navigation. */ }
    }
    function continueLegacyLink() {
      if (window.location.pathname !== '/') return;
      const target = legacyDestinations[window.location.hash];
      if (!target) return;
      const destination = new URL(target, window.location.origin);
      const incoming = new URLSearchParams(window.location.search);
      for (const key of campaignKeys) {
        const value = incoming.get(key);
        if (value) destination.searchParams.set(key, value);
      }
      router.replace(destination.pathname + destination.search);
    }
    continueLegacyLink();
    window.addEventListener('hashchange', continueLegacyLink);
    return () => window.removeEventListener('hashchange', continueLegacyLink);
  }, [router]);

  return null;
}
