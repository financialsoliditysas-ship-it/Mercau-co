"use client";

import { trackPublicMetric } from "@/lib/marketing-attribution";
import { trackMetaEvent } from "@/lib/meta-pixel";

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
}
