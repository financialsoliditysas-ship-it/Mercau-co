"use client";
import { useEffect, useState } from 'react';

export default function BusinessOrdersLink({ businessId }: { businessId: string }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/piloto/restaurante?mode=menu&restaurant=${encodeURIComponent(businessId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => response.ok ? response.json() : null)
      .then(menu => { if (!controller.signal.aborted) setEnabled(menu?.live === true); }).catch(() => {});
    return () => controller.abort();
  }, [businessId]);
  return enabled ? <a href={`/mi-negocio/${businessId}/pedidos`} className="mt-3 inline-flex min-h-11 items-center rounded-md border border-gray-300 px-4 text-sm font-bold">Pedidos de mi negocio</a> : null;
}
