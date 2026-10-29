'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { trackPublicMetric } from '@/lib/marketing-attribution';
import { pwaLaunchTarget } from '@/lib/pwa-launch';

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
    if (typeof document !== 'undefined' && document.documentElement.dataset.mercauPwaLaunching === 'true') return;
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const standalone = displayMode.matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const initialLaunch = pwaLaunchTarget(window.location.pathname, window.location.search, window.location.hash, standalone);
    if (initialLaunch) { router.replace(initialLaunch); return; }
    if (!visited.current) {
      visited.current = true;
      try { trackPublicMetric('Visita', { notes: 'Home presentación' }); }
      catch { /* Optional metrics must not block legacy navigation. */ }
    }
    function continueLegacyLink() {
      if (window.location.pathname !== '/') return;
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      const launch = pwaLaunchTarget(window.location.pathname, window.location.search, window.location.hash, standalone);
      if (launch) { router.replace(launch); return; }
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
    window.addEventListener('pageshow', continueLegacyLink);
    displayMode.addEventListener?.('change', continueLegacyLink);
    return () => {
      window.removeEventListener('hashchange', continueLegacyLink);
      window.removeEventListener('pageshow', continueLegacyLink);
      displayMode.removeEventListener?.('change', continueLegacyLink);
    };
  }, [router]);

  return null;
}
