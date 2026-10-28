"use client";

import { useEffect } from "react";
import { captureMarketingAttribution, trackPublicMetric } from "@/lib/marketing-attribution";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const STANDALONE_RECORDED = "mercau:standalone-open-recorded:v1";
const SIGNUP_PENDING = "mercau:signup-pending:v1";

export default function AppLifecycleMetrics() {
  useEffect(() => {
    captureMarketingAttribution();

    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    if (standalone && !localStorage.getItem(STANDALONE_RECORDED)) {
      localStorage.setItem(STANDALONE_RECORDED, new Date().toISOString());
      trackPublicMetric("App instalada activa", {
        notes: /iphone|ipad|ipod/i.test(navigator.userAgent) ? "platform=ios" : "platform=other"
      });
    }

    if (!localStorage.getItem(SIGNUP_PENDING)) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    void client.auth.getSession().then(({ data }) => {
      if (!data.session?.user) return;
      trackPublicMetric("Cuenta confirmada");
      localStorage.removeItem(SIGNUP_PENDING);
    });
  }, []);

  return null;
}
