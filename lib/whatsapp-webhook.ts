import { createHmac, timingSafeEqual } from 'node:crypto';

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
