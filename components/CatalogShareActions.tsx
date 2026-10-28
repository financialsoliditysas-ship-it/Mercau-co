"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export default function CatalogShareActions({ businessName, catalogUrl, noun = "Menú" }: { businessName: string; catalogUrl: string; noun?: "Menú" | "Catálogo" }) {
  const [copied, setCopied] = useState(false);
  const lowerNoun = noun.toLocaleLowerCase("es-CO");
  const text = `Conoce el ${lowerNoun} de ${businessName} en Mercáu${noun === "Menú" ? " y haz tu pedido" : ""}:`;

  async function copy() {
    await navigator.clipboard.writeText(catalogUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${businessName} en Mercáu`, text, url: catalogUrl });
        return;
      } catch {
        return;
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#D82016] px-4 text-sm font-bold text-white"><Share2 size={17} />Compartir {lowerNoun}</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${catalogUrl}`)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-bold">Enviar por WhatsApp</a>
      <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold">{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Enlace copiado" : "Copiar enlace"}</button>
    </div>
  );
}
