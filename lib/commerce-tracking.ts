"use client";

import { trackPublicMetric } from "@/lib/marketing-attribution";
import { trackMetaEvent } from "@/lib/meta-pixel";
import posthog from "posthog-js";

type CommerceData = {
  businessId: string;
  businessName: string;
  productId?: string;
  productName?: string;
  value?: number;
  quantity?: number;
};

export function trackCommerceEvent(
  mercauType: string,
  metaEvent: string,
  data: CommerceData,
  customMeta = false,
) {
  const notes = [
    data.productId ? `product_id=${data.productId}` : "",
    data.productName ? `product=${data.productName}` : "",
    Number.isFinite(data.value) ? `value=${data.value}` : "",
    Number.isFinite(data.quantity) ? `quantity=${data.quantity}` : "",
  ].filter(Boolean).join("; ");

  trackPublicMetric(mercauType, {
    businessId: data.businessId,
    businessName: data.businessName,
    notes,
  });
  trackMetaEvent(metaEvent, {
    content_ids: data.productId ? [data.productId] : [data.businessId],
    content_name: data.productName || data.businessName,
    content_type: data.productId ? "product" : "product_group",
    currency: "COP",
    ...(Number.isFinite(data.value) ? { value: data.value } : {}),
    ...(Number.isFinite(data.quantity) ? { num_items: data.quantity } : {}),
  }, customMeta);

  trackConversion(mercauType, googleEventName(metaEvent), {
    business_id: data.businessId,
    business_name: data.businessName,
    ...(data.productId ? { item_id: data.productId } : {}),
    ...(data.productName ? { item_name: data.productName } : {}),
    ...(Number.isFinite(data.value) ? { value: data.value, currency: "COP" } : {}),
    ...(Number.isFinite(data.quantity) ? { quantity: data.quantity } : {}),
  });
}

type ConversionData = Record<string, string | number | boolean | undefined>;

function googleEventName(metaEvent: string) {
  const names: Record<string, string> = {
    ViewContent: "view_item",
    AddToCart: "add_to_cart",
    InitiateCheckout: "begin_checkout",
    Lead: "generate_lead",
    Contact: "contact",
  };
  return names[metaEvent] || "mercau_conversion";
}

export function trackConversion(eventName: string, gaEventName: string, data: ConversionData = {}) {
  if (typeof window === "undefined") return;

  const properties = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
  if (process.env.NEXT_PUBLIC_GTM_CONTAINER_ID) {
    window.dataLayer?.push({ event: gaEventName, ...properties });
  } else {
    window.gtag?.("event", gaEventName, properties);
  }
  if (posthog.__loaded) posthog.capture(eventName, properties);
}
