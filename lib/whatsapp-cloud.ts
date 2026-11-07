type WhatsAppConfig = {
  graphVersion: string;
  phoneNumberId: string;
  accessToken: string;
  templateName: string;
  templateLanguage: string;
};

export class WhatsAppCloudError extends Error {
  constructor(message: string, public outcome: 'failed' | 'uncertain' = 'failed') { super(message); }
}

export function getWhatsAppCloudConfig(): WhatsAppConfig | null {
  const graphVersion = process.env.META_WHATSAPP_GRAPH_VERSION?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const templateName = process.env.META_WHATSAPP_ORDER_TEMPLATE?.trim();
  const templateLanguage = process.env.META_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'es';
  if (!graphVersion || !phoneNumberId || !accessToken || !templateName) return null;
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new WhatsAppCloudError('La versión de Graph API no es válida.');
  if (!/^\d+$/.test(phoneNumberId)) throw new WhatsAppCloudError('El identificador del número de WhatsApp no es válido.');
  return { graphVersion, phoneNumberId, accessToken, templateName, templateLanguage };
}

export function normalizeWhatsAppRecipient(value: string) {
  const digits = value.replace(/\D/g, '');
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  if (/^573\d{9}$/.test(digits)) return digits;
  throw new WhatsAppCloudError('El WhatsApp del negocio no es un número colombiano válido.');
}

export async function sendRestaurantOrderTemplate(input: {
  recipient: string;
  publicId: string;
  restaurantName: string;
  actionToken: string;
}) {
  const config = getWhatsAppCloudConfig();
  if (!config) throw new WhatsAppCloudError('WhatsApp Cloud API no está configurado.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizeWhatsAppRecipient(input.recipient),
        type: 'template',
        template: {
          name: config.templateName,
          language: { code: config.templateLanguage },
          components: [
            { type: 'body', parameters: [
              { type: 'text', text: input.publicId },
              { type: 'text', text: input.restaurantName }
            ] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [
              { type: 'text', text: input.actionToken }
            ] }
          ]
        }
      }),
      signal: controller.signal
    });
  } catch (error) {
    throw new WhatsAppCloudError(
      error instanceof Error && error.name === 'AbortError'
        ? 'Meta no confirmó el envío antes del tiempo límite.'
        : 'No se pudo confirmar si Meta recibió el mensaje.',
      'uncertain'
    );
  } finally {
    clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => null) as { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number } } | null;
  if (!response.ok) {
    const code = payload?.error?.code ? ` (${payload.error.code})` : '';
    throw new WhatsAppCloudError(`Meta rechazó el mensaje${code}: ${payload?.error?.message || 'respuesta no disponible'}.`);
  }
  const messageId = payload?.messages?.[0]?.id;
  if (!messageId) throw new WhatsAppCloudError('Meta respondió sin identificador del mensaje.', 'uncertain');
  return { messageId };
}
