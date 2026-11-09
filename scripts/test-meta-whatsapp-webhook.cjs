const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function load(file, mocks = {}) {
  const mod = new Module(file);
  mod.require = id => id in mocks ? mocks[id] : require(id);
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
const events=webhook.whatsappDeliveryEvents({entry:[{changes:[{value:{metadata:{phone_number_id:'sender-id'},statuses:[{id:'wamid.test',status:'delivered',timestamp:'1794181200'},{id:'invalid',status:'other',timestamp:'1794181200'}]}}]}]});
assert.deepEqual(events,[{message_id:'wamid.test',status:'delivered',occurred_at:'2026-11-08T23:40:00.000Z',phone_number_id:'sender-id',error_code:null,error_title:null}]);

const stored=[];
const routeModule=load('app/api/webhooks/meta-whatsapp/route.ts',{
  '@/lib/whatsapp-webhook':webhook,
  '@/lib/supabase-admin':{getSupabaseAdminClient:()=>({from:table=>table==='whatsapp_message_delivery_events'
    ? {upsert:async(rows,options)=>{assert.equal(options.onConflict,'message_id,status,occurred_at');stored.push(...rows);return {error:null};}}
    : {update:()=>({eq:()=>({error:null})})}})}
});
process.env.META_APP_SECRET=appSecret;
const deliveryBody=JSON.stringify({entry:[{changes:[{value:{metadata:{phone_number_id:'sender-id'},statuses:[{id:'wamid.test',status:'delivered',timestamp:'1794181200'}]}}]}]});
const deliverySignature=`sha256=${crypto.createHmac('sha256',appSecret).update(deliveryBody).digest('hex')}`;
(async()=>{
  const response=await routeModule.POST(new Request('https://example.invalid/api/webhooks/meta-whatsapp',{method:'POST',headers:{'x-hub-signature-256':deliverySignature},body:deliveryBody}));
  assert.equal(response.status,200);assert.equal(stored.length,1);
  const rejected=await routeModule.POST(new Request('https://example.invalid/api/webhooks/meta-whatsapp',{method:'POST',headers:{'x-hub-signature-256':'sha256=bad'},body:deliveryBody}));
  assert.equal(rejected.status,401);assert.equal(stored.length,1);
  console.log('PASS Meta WhatsApp webhook: reto, token, firma y estados de entrega simulados. No se contacto Meta ni se enviaron mensajes.');
})().catch(error=>{console.error(error);process.exitCode=1;});

const route = fs.readFileSync('app/api/webhooks/meta-whatsapp/route.ts', 'utf8');
assert.match(route, /META_WHATSAPP_WEBHOOK_VERIFY_TOKEN/);
assert.match(route, /x-hub-signature-256/);
assert.match(route, /Webhook not configured/);
assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|SHIPDAY/);
