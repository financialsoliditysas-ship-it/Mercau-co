const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function load(file) {
  const mod = new Module(file);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, `${file}.cjs`);
  return mod.exports;
}

const webhook = load('lib/whatsapp-webhook.ts');
const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
const appSecret = 'qa-app-secret-not-real';
const signature = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

assert.equal(webhook.validMetaVerificationToken('qa-verify', 'qa-verify'), true);
assert.equal(webhook.validMetaVerificationToken('wrong', 'qa-verify'), false);
assert.equal(webhook.validMetaVerificationToken(null, 'qa-verify'), false);
assert.equal(webhook.validMetaSignature(rawBody, signature, appSecret), true);
assert.equal(webhook.validMetaSignature(rawBody, 'sha256=bad', appSecret), false);
assert.equal(webhook.validMetaSignature(rawBody, signature, ''), false);

const route = fs.readFileSync('app/api/webhooks/meta-whatsapp/route.ts', 'utf8');
assert.match(route, /META_WHATSAPP_WEBHOOK_VERIFY_TOKEN/);
assert.match(route, /x-hub-signature-256/);
assert.match(route, /Webhook not configured/);
assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|SHIPDAY/);

console.log('PASS Meta WhatsApp webhook: reto, token y firma simulados. No se contacto Meta ni se enviaron mensajes.');
