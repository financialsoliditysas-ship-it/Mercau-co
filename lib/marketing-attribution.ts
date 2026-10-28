"use client";

const ATTRIBUTION_KEY = "mercau:marketing-attribution:v1";

type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  landing?: string;
};

function clean(value: string | null, max = 80) {
  return String(value || "").trim().slice(0, max);
}

export function captureMarketingAttribution() {
  if (typeof window === "undefined") return {} as Attribution;

  const params = new URLSearchParams(window.location.search);
  const next: Attribution = {
    source: clean(params.get("utm_source")),
    medium: clean(params.get("utm_medium")),
    campaign: clean(params.get("utm_campaign")),
    content: clean(params.get("utm_content")),
    landing: `${window.location.pathname}${window.location.search}`.slice(0, 180)
  };
  const hasCampaign = Boolean(next.source || next.medium || next.campaign || next.content);

  if (hasCampaign) {
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
    return next;
  }

  try {
    return JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || "{}") as Attribution;
  } catch {
    return {} as Attribution;
  }
}

export function attributionNotes(extra: Record<string, string> = {}) {
  const attribution = captureMarketingAttribution();
  return Object.entries({ ...attribution, ...extra })
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}=${String(value).replace(/[;\n\r]/g, " ")}`)
    .join("; ")
    .slice(0, 300);
}

export function trackPublicMetric(type: string, extra: Record<string, string> = {}) {
  if (typeof window === "undefined") return;
  const { notes = "", ...payload } = extra;
  void fetch("/api/metricas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      type,
      path: window.location.pathname,
      ...payload,
      notes: attributionNotes(notes ? { detail: notes } : {})
    })
  }).catch(() => undefined);
}
