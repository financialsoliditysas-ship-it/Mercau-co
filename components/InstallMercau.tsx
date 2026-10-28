"use client";

import { Check, Copy, Download, MoreVertical, SquareArrowUp, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { trackPublicMetric } from "@/lib/marketing-attribution";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __mercauInstallPrompt?: InstallPromptEvent | null;
  }
}

export default function InstallMercau({ compact = false, prominent = false }: { compact?: boolean; prominent?: boolean }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [androidBrowserNeedsChrome, setAndroidBrowserNeedsChrome] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    const userAgent = window.navigator.userAgent;
    const android = /android/i.test(userAgent);
    const recognizedGoogleChrome = /Chrome\//i.test(userAgent)
      && !/(SamsungBrowser|EdgA|OPR|Firefox|FxiOS|DuckDuckGo|YaBrowser)/i.test(userAgent);
    setIsIos(/iphone|ipad|ipod/i.test(userAgent));
    setIsAndroid(android);
    setAndroidBrowserNeedsChrome(android && !recognizedGoogleChrome);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/mercau-sw.js", { scope: "/" }).catch(() => undefined);
    }

    setPromptEvent(window.__mercauInstallPrompt || null);

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      const installEvent = event as InstallPromptEvent;
      window.__mercauInstallPrompt = installEvent;
      setPromptEvent(installEvent);
    };
    const captureStoredPrompt = () => setPromptEvent(window.__mercauInstallPrompt || null);
    const markInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowHelp(false);
      if (!localStorage.getItem("mercau:android-install-recorded:v1")) {
        localStorage.setItem("mercau:android-install-recorded:v1", new Date().toISOString());
        trackPublicMetric("Instalacion Android confirmada");
      }
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("mercau-install-ready", captureStoredPrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("mercau-install-ready", captureStoredPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function install() {
    if (installed) return;
    trackPublicMetric("Instalacion iniciada");
    if (androidBrowserNeedsChrome) {
      setShowHelp(true);
      trackPublicMetric("Guia Android abierta");
      return;
    }
    if (!promptEvent) {
      if (isIos || isAndroid) {
        setShowHelp(true);
        trackPublicMetric(isIos ? "Guia iOS abierta" : "Guia Android abierta");
      }
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      trackPublicMetric("Instalacion Android aceptada");
    }
    window.__mercauInstallPrompt = null;
    setPromptEvent(null);
  }

  async function copyMercauLink() {
    try {
      await navigator.clipboard.writeText("https://www.mercau.co");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={install}
        disabled={installed}
        className={`mercau-install-control ${compact
          ? "flex w-full items-center gap-2 rounded-md px-3 py-3 text-left hover:bg-slate-100 disabled:text-emerald-700"
          : prominent
            ? "inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#D82016] bg-[#D82016] px-5 py-3 font-black text-white hover:bg-[#B91C1C] disabled:border-emerald-700 disabled:bg-emerald-700 disabled:text-white"
            : "inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 font-black hover:bg-slate-100 disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700"}`}
        title={installed ? "Mercáu ya está en este dispositivo" : "Agregar Mercáu a la pantalla de inicio"}
      >
        <Download aria-hidden="true" size={18} />
        Instalar Mercáu
      </button>

      {showHelp ? (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-slate-950/55 p-0 sm:place-items-center sm:p-4" role="presentation" onMouseDown={() => setShowHelp(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-mercau-title"
            className="w-full rounded-t-2xl bg-white p-5 text-slate-800 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-[#D82016]">Acceso rápido</p>
                <h2 id="install-mercau-title" className="mt-1 text-2xl font-black">Instala Mercáu en tu celular</h2>
              </div>
              <button type="button" onClick={() => setShowHelp(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100" aria-label="Cerrar instrucciones">
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            {isIos ? (
              <div className="mt-5">
                <p className="rounded-lg bg-[#FFF1F0] px-4 py-3 text-center text-sm font-bold text-[#991B1B]">Hazlo desde Safari. No necesitas volver a escribir la dirección.</p>
                <button type="button" onClick={copyMercauLink} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-black text-blue-700 hover:bg-blue-100">
                  {copied ? <Check aria-hidden="true" size={20} /> : <Copy aria-hidden="true" size={20} />}
                  {copied ? "Enlace copiado" : "Copiar enlace de Mercáu"}
                </button>
                <p className="mt-2 text-center text-xs font-semibold text-slate-500">Abre Safari y pega: www.mercau.co</p>
                <ol className="mt-4 grid grid-cols-2 gap-3" aria-label="Pasos para instalar Mercáu en iPhone">
                  <li className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white text-[#D82016] shadow-sm"><SquareArrowUp aria-hidden="true" size={26} /></span>
                    <span className="text-xs font-black uppercase text-[#D82016]">Paso 1</span>
                    <strong className="mt-1 text-base">Toca Compartir</strong>
                  </li>
                  <li className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white text-[#D82016] shadow-sm"><SquarePlus aria-hidden="true" size={26} /></span>
                    <span className="text-xs font-black uppercase text-[#D82016]">Paso 2</span>
                    <strong className="mt-1 text-base">Agregar a Inicio</strong>
                  </li>
                </ol>
                <button type="button" onClick={() => setShowHelp(false)} className="mt-5 min-h-12 w-full rounded-xl bg-[#D82016] px-4 py-3 font-black text-white hover:bg-[#B91C1C]">Entendido</button>
              </div>
            ) : androidBrowserNeedsChrome ? (
              <div className="mt-5">
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
                  Este navegador puede intentar crear una aplicación incompatible en algunos equipos Android. Para instalar Mercáu de forma segura, abre esta misma página en Google Chrome.
                </p>
                <a
                  href="intent://www.mercau.co/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fwww.mercau.co%2Finstalar;end"
                  className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D82016] px-4 py-3 text-center font-black text-white hover:bg-[#B91C1C]"
                >
                  Abrir Mercáu en Chrome
                </a>
                <button type="button" onClick={copyMercauLink} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-800 hover:bg-slate-50">
                  {copied ? <Check aria-hidden="true" size={20} /> : <Copy aria-hidden="true" size={20} />}
                  {copied ? "Enlace copiado" : "Copiar enlace como alternativa"}
                </button>
                <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
                  En Chrome, toca nuevamente “Instalar Mercáu”. No elijas “Instalar de todas formas” en el aviso de Play Protect.
                </p>
              </div>
            ) : isAndroid ? (
              <div className="mt-5">
                <p className="rounded-lg bg-[#FFF1F0] px-4 py-3 text-sm font-bold leading-6 text-[#991B1B]">Chrome no habilitó el cuadro automático en este momento. Puedes instalar Mercáu desde el menú del navegador.</p>
                <ol className="mt-4 grid grid-cols-2 gap-3" aria-label="Instalación manual de Mercáu en Android">
                  <li className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white text-[#D82016] shadow-sm"><MoreVertical aria-hidden="true" size={28} /></span>
                    <span className="text-xs font-black uppercase text-[#D82016]">Paso 1</span>
                    <strong className="mt-1 text-base">Toca los tres puntos</strong>
                  </li>
                  <li className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white text-[#D82016] shadow-sm"><Download aria-hidden="true" size={26} /></span>
                    <span className="text-xs font-black uppercase text-[#D82016]">Paso 2</span>
                    <strong className="mt-1 text-base">Instalar aplicación</strong>
                  </li>
                </ol>
                <button type="button" onClick={() => setShowHelp(false)} className="mt-5 min-h-12 w-full rounded-xl bg-[#D82016] px-4 py-3 font-black text-white hover:bg-[#B91C1C]">Entendido</button>
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6">
                <p><strong>Desde computador:</strong> busca el icono de instalación en la barra de direcciones del navegador.</p>
              </div>
            )}
            {!isIos ? <p className="mt-5 text-sm text-slate-600">Después podrás abrir Mercáu directamente desde su icono, sin buscar nuevamente la página.</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
