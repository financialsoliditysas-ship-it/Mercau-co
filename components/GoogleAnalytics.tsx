"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { marketingConsent } from "@/lib/meta-pixel";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
const privatePrefixes = [
  "/actualizar/",
  "/admin",
  "/envio/",
  "/gestionar-compra/",
  "/gestionar-pedido/",
  "/mi-cuenta",
  "/mi-negocio",
  "/piloto/"
];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isPrivatePath(pathname: string) {
  return privatePrefixes.some(prefix => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
}

function ensureGoogleTag() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("consent", "default", { analytics_storage: "denied" });

  if (!document.querySelector(`script[data-mercau-ga="${measurementId}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.mercauGa = measurementId;
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<"accepted" | "rejected" | null>(null);
  const initialized = useRef(false);
  const lastPage = useRef("");

  useEffect(() => {
    const refresh = () => setConsent(marketingConsent());
    refresh();
    window.addEventListener("mercau:marketing-consent", refresh);
    return () => window.removeEventListener("mercau:marketing-consent", refresh);
  }, []);

  useEffect(() => {
    if (!measurementId) return;
    if (consent !== "accepted" || isPrivatePath(pathname)) {
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      return;
    }

    if (!initialized.current) {
      ensureGoogleTag();
      initialized.current = true;
    }
    window.gtag?.("consent", "update", { analytics_storage: "granted" });

    if (lastPage.current !== pathname) {
      lastPage.current = pathname;
      window.gtag?.("event", "page_view", {
        page_title: document.title,
        page_location: window.location.href,
        page_path: pathname
      });
    }
  }, [consent, pathname]);

  return null;
}
