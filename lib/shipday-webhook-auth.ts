import { timingSafeEqual } from 'node:crypto';
export class WebhookAuthError extends Error {
  constructor(public status: number) { super('Webhook no autorizado.'); }
}
export function requireShipdayWebhookToken(token: string | null) {
  const expected = process.env.SHIPDAY_WEBHOOK_TOKEN;
  if (!expected) throw new WebhookAuthError(503);
  if (!token || Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    throw new WebhookAuthError(401);
  }
}
