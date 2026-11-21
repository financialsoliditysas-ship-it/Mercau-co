"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { marketingConsent } from "@/lib/meta-pixel";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || "";
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
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

function isPrivatePath(pathname: string) {
  return privatePrefixes.some(prefix => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
}

export default function PostHogAnalytics() {
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
    if (!projectToken || consent !== "accepted") return;
    if (!initialized.current) {
      posthog.init(projectToken, {
        api_host: apiHost,
        defaults: "2025-05-24",
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
        capture_exceptions: true,
        disable_session_recording: true,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: "[data-private]"
        },
        before_send: event => isPrivatePath(window.location.pathname) ? null : event
      });
      initialized.current = true;
    } else {
      posthog.opt_in_capturing();
    }

    if (isPrivatePath(pathname)) {
      posthog.stopSessionRecording();
      return;
    }
    posthog.startSessionRecording();
    if (lastPage.current !== pathname) {
      lastPage.current = pathname;
      posthog.capture("$pageview", { $current_url: window.location.href });
    }
  }, [consent, pathname]);

  useEffect(() => {
    if (!initialized.current || consent !== "rejected") return;
    posthog.stopSessionRecording();
    posthog.opt_out_capturing();
  }, [consent]);

  return null;
}
