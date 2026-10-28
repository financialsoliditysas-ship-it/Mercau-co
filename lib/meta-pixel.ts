"use client";

export const MARKETING_CONSENT_KEY = "mercau:marketing-consent:v1";

type MetaPixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: MetaPixel;
    _fbq?: MetaPixel;
    __mercauMetaPixelId?: string;
  }
}

export function marketingConsent() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(MARKETING_CONSENT_KEY);
  return value === "accepted" || value === "rejected" ? value : null;
}

export function initializeMetaPixel(pixelId: string) {
  if (typeof window === "undefined" || !pixelId || marketingConsent() !== "accepted") return false;
  if (window.__mercauMetaPixelId === pixelId && window.fbq) return true;

  const fbq: MetaPixel = window.fbq || (function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else (fbq.queue ||= []).push(args);
  } as MetaPixel);
  window.fbq = fbq;
  window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue ||= [];

  if (!document.querySelector('script[data-mercau-meta-pixel="true"]')) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.mercauMetaPixel = "true";
    document.head.appendChild(script);
  }

  fbq("init", pixelId);
  window.__mercauMetaPixelId = pixelId;
  return true;
}

export function trackMetaEvent(event: string, data: Record<string, unknown> = {}, custom = false) {
  if (typeof window === "undefined" || marketingConsent() !== "accepted" || !window.fbq) return;
  window.fbq(custom ? "trackCustom" : "track", event, data);
}
