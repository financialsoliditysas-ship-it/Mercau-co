const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const crypto = require('node:crypto');

function load(file) {
  const mod = new Module(file);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText, `${file}.cjs`);
  return mod.exports;
}

async function main() {
  Object.assign(process.env, {
    META_WHATSAPP_GRAPH_VERSION: 'v99.0',
    META_WHATSAPP_PHONE_NUMBER_ID: '123456789',
    META_WHATSAPP_ACCESS_TOKEN: 'qa-token-not-real',
    META_WHATSAPP_ORDER_TEMPLATE: 'mercau_nuevo_pedido',
    META_WHATSAPP_TEMPLATE_LANGUAGE: 'es',
    META_APP_SECRET: 'qa-app-secret-not-real'
  });
  const cloud = load('lib/whatsapp-cloud.ts');
  const webhook = load('lib/whatsapp-webhook.ts');
  assert.equal(cloud.normalizeWhatsAppRecipient('300 123 4567'), '573001234567');
  assert.equal(cloud.normalizeWhatsAppRecipient('+57 300 123 4567'), '573001234567');
  assert.throws(() => cloud.normalizeWhatsAppRecipient('123'));

  let request;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    request = { url: String(url), options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.qa' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await cloud.sendRestaurantOrderTemplate({
      recipient: '3001234567', publicId: 'MCU-1-000001', restaurantName: 'Negocio QA',
      actionToken: 'A'.repeat(43)
    });
    assert.equal(result.messageId, 'wamid.qa');
    assert.match(request.url, /graph\.facebook\.com\/v99\.0\/123456789\/messages$/);
    assert.equal(request.options.headers.Authorization, 'Bearer qa-token-not-real');
    assert.equal(request.body.type, 'template');
    assert.equal(request.body.template.name, 'mercau_nuevo_pedido');
    assert.deepEqual(request.body.template.components[0].parameters.map(item => item.text), ['MCU-1-000001', 'Negocio QA']);
    assert.equal(request.body.template.components[1].parameters[0].text, 'A'.repeat(43));
  } finally { global.fetch = originalFetch; }

  const raw = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.qa', status: 'delivered' }] } }] }] });
  const signature = `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(raw).digest('hex')}`;
  assert.equal(webhook.validMetaSignature(raw, signature), true);
  assert.equal(webhook.validMetaSignature(raw, 'sha256=bad'), false);
  assert.deepEqual(webhook.messageStatuses(JSON.parse(raw)), [{ id: 'wamid.qa', status: 'delivered', error: null }]);

  const migration = fs.readFileSync('supabase/migrations/20261106193000_restaurant_auto_dispatch.sql', 'utf8');
  const worker = fs.readFileSync('lib/restaurant-order-messages.ts', 'utf8');
  const route = fs.readFileSync('app/api/webhooks/meta-whatsapp/route.ts', 'utf8');
  assert.match(migration, /status in \('blocked_provider', 'queued', 'processing', 'sent', 'failed', 'uncertain'\)/);
  assert.match(worker, /eq\('status', 'queued'\)/);
  assert.match(worker, /eq\('status', candidate\.status\)/);
  assert.match(route, /x-hub-signature-256/);
  console.log('PASS WhatsApp Cloud: payload de plantilla, número colombiano, firma del webhook y reclamación única simulados. No se contactó Meta ni se enviaron mensajes.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
