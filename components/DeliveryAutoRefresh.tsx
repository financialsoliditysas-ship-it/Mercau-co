"use client";

import { useEffect } from "react";

const finalStatuses = new Set(["delivered", "failed", "cancelled"]);

export default function DeliveryAutoRefresh({ status }: { status: string }) {
  useEffect(() => {
    if (finalStatuses.has(status)) return;

    const interval = window.setInterval(() => {
      window.location.reload();
    }, 12000);

    return () => window.clearInterval(interval);
  }, [status]);

  if (finalStatuses.has(status)) return null;

  return (
    <p className="mt-4 rounded-2xl bg-[#FFF1F0] p-3 text-xs font-black text-[#D82016]">
      Actualizando seguimiento automaticamente.
    </p>
  );
}
