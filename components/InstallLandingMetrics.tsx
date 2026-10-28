"use client";

import { useEffect } from "react";
import { trackPublicMetric } from "@/lib/marketing-attribution";

export default function InstallLandingMetrics() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const campaignKey = [
      params.get("utm_source") || "direct",
      params.get("utm_medium") || "none",
      params.get("utm_campaign") || "none"
    ].join(":");
    const sessionKey = `mercau:install-landing-visited:${campaignKey}`;

    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, new Date().toISOString());
    trackPublicMetric("Pagina instalacion visitada");
  }, []);

  return null;
}
