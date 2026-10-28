"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { initializeMetaPixel, MARKETING_CONSENT_KEY, marketingConsent, trackMetaEvent } from "@/lib/meta-pixel";

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

export default function MarketingConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<"accepted" | "rejected" | null>(null);
  const lastPage = useRef("");

  useEffect(() => setChoice(marketingConsent()), []);
  useEffect(() => {
    if (!pixelId || choice !== "accepted" || lastPage.current === pathname) return;
    if (!initializeMetaPixel(pixelId)) return;
    lastPage.current = pathname;
    trackMetaEvent("PageView");
  }, [choice, pathname]);

  if (!pixelId || choice) return null;

  function decide(value: "accepted" | "rejected") {
    window.localStorage.setItem(MARKETING_CONSENT_KEY, value);
    setChoice(value);
  }

  return (
    <aside className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-4 shadow-2xl md:bottom-5" aria-label="Preferencias de medición">
      <p className="font-black text-slate-950">Ayúdanos a mejorar Mercáu</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">Con tu permiso medimos qué campañas llevan a menús y pedidos. No enviamos a Meta tu nombre, teléfono ni dirección.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => decide("accepted")} className="min-h-11 rounded-md bg-[#D82016] px-4 text-sm font-bold text-white">Permitir medición</button>
        <button type="button" onClick={() => decide("rejected")} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-bold">Continuar sin medición</button>
        <a href="/politica-de-tratamiento-de-datos" className="min-h-11 content-center px-2 text-sm font-bold text-[#D82016]">Ver política</a>
      </div>
    </aside>
  );
}
