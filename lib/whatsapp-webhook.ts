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
  const output: MetaMessageStatus[] = [];
  const entries = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return output;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = (change as { value?: { statuses?: unknown } })?.value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const status of statuses) {
        const item = status as { id?: unknown; status?: unknown; errors?: unknown };
        if (typeof item.id !== 'string' || !deliveryStatuses.has(String(item.status))) continue;
        const firstError = Array.isArray(item.errors) ? item.errors[0] as { title?: unknown; message?: unknown } | undefined : undefined;
        output.push({
          id: item.id,
          status: item.status as MetaMessageStatus['status'],
          error: typeof firstError?.title === 'string' ? firstError.title : typeof firstError?.message === 'string' ? firstError.message : null
        });
      }
    }
  }
  return output;
}
