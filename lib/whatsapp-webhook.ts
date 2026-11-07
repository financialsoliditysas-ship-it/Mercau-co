import { createHmac, timingSafeEqual } from 'node:crypto';

const deliveryStatuses = new Set(['sent', 'delivered', 'read', 'failed']);

export type WhatsAppDeliveryEvent = {
  message_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  occurred_at: string;
  phone_number_id: string | null;
  error_code: string | null;
  error_title: string | null;
};

function equalSecrets(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function validMetaVerificationToken(received: string | null, expected = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || '') {
  return Boolean(received && expected && equalSecrets(received, expected));
}

export function validMetaSignature(rawBody: string, signature: string | null, appSecret = process.env.META_APP_SECRET || '') {
  if (!appSecret || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return equalSecrets(signature, expected);
}

export function whatsappDeliveryEvents(payload: unknown): WhatsAppDeliveryEvent[] {
  if (!payload || typeof payload !== 'object') return [];
  const entries = Array.isArray((payload as { entry?: unknown }).entry)
    ? (payload as { entry: unknown[] }).entry
    : [];
  const events: WhatsAppDeliveryEvent[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const changes = Array.isArray((entry as { changes?: unknown }).changes)
      ? (entry as { changes: unknown[] }).changes
      : [];
    for (const change of changes) {
      const value = change && typeof change === 'object'
        ? (change as { value?: unknown }).value
        : null;
      const statuses = value && typeof value === 'object' && Array.isArray((value as { statuses?: unknown }).statuses)
        ? (value as { statuses: unknown[] }).statuses
        : [];
      const phoneNumberId = value && typeof value === 'object'
        ? String((value as { metadata?: { phone_number_id?: unknown } }).metadata?.phone_number_id || '').slice(0, 120) || null
        : null;
      for (const statusValue of statuses) {
        if (!statusValue || typeof statusValue !== 'object') continue;
        const status = String((statusValue as { status?: unknown }).status || '');
        const messageId = String((statusValue as { id?: unknown }).id || '').trim();
        const timestamp = Number((statusValue as { timestamp?: unknown }).timestamp);
        const occurredAt = new Date(timestamp * 1000);
        if (!deliveryStatuses.has(status) || !messageId || messageId.length > 300 || !Number.isFinite(timestamp) || Number.isNaN(occurredAt.getTime())) continue;
        const error = Array.isArray((statusValue as { errors?: unknown }).errors)
          ? (statusValue as { errors: Array<{ code?: unknown; title?: unknown }> }).errors[0]
          : undefined;
        events.push({
          message_id: messageId,
          status: status as WhatsAppDeliveryEvent['status'],
          occurred_at: occurredAt.toISOString(),
          phone_number_id: phoneNumberId,
          error_code: error?.code === undefined ? null : String(error.code).slice(0, 80),
          error_title: error?.title === undefined ? null : String(error.title).slice(0, 300)
        });
      }
    }
  }
  return events;
}

export type MetaMessageStatus = {
  id: string;
  status: WhatsAppDeliveryEvent['status'];
  error: string | null;
};

export function messageStatuses(payload: unknown): MetaMessageStatus[] {
  return whatsappDeliveryEvents(payload).map((event) => ({
    id: event.message_id,
    status: event.status,
    error: event.error_title
  }));
}
