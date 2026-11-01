const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),Module=require('node:module'),ts=require('typescript');
const contract=JSON.parse(fs.readFileSync('data/production-backend-contract.json'));
// Retain the published baseline. Only these explicitly versioned safety changes supersede it.
const safety=JSON.parse(fs.readFileSync('data/logistics-controls-contract.json'));
const changes=JSON.parse(fs.readFileSync('data/order-changes-contract.json'));
const hours=JSON.parse(fs.readFileSync('data/business-hours-contract.json'));
for(const [file,expected]of Object.entries(hours))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex'),expected,'Unexpected saved-hours change '+file);
assert.equal(safety.status,'release-requires-sql-v2-v3');
for(const [index,source] of ['supabase/drafts/logistics_controls_v2.sql','supabase/drafts/order_receipts_v3.sql'].entries()){
 assert.equal(fs.readFileSync(source,'utf8').replace(/\r\n/g,'\n'),fs.readFileSync(safety.releaseMigrations[index],'utf8').replace(/\r\n/g,'\n'),'Release migration differs from tested SQL');
}
for(const [file,expected]of Object.entries(contract.sha256)){
 if(hours[file])continue;
 let bytes=fs.readFileSync(file);
 if(file==='lib/delivery-tracking.ts')bytes=Buffer.from(bytes.toString('utf8').replace('/^(?:MCU-\\d{6,}|MCU-1-\\d{6})$/','/^MCU-\\d{6,}$/'));
 // Only the authorized reference-format alternatives differ from the operational hashes.
 if(['lib/restaurant-pilot.ts','lib/order-changes.ts','app/api/piloto/restaurante/route.ts'].includes(file)){
  let source=bytes.toString('utf8');
  source=source.replaceAll('/^(?:PRB-\\d+|MCU-1-\\d{6})$/','/^PRB-\\d+$/')
   .replaceAll('/^(?:PRB-\\d{6}|MCU-1-\\d{6})$/','/^PRB-\\d{6}$/');
  bytes=Buffer.from(source);
 }
 if(changes.sha256[file]){
  const source=bytes.toString('utf8').replace(/\r\n/g,'\n');
  const baseline=file==='public/mercau-sw.js'?source.replace("importScripts('/mercau-public-cache-v1.js');\n",''):source;
  assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'),changes.sha256[file],'Unexpected order-change integration '+file);
  continue;
 }
 if(safety.sha256[file]){
  assert.equal(crypto.createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g,'\n')).digest('hex'),safety.sha256[file],'Unexpected safety change '+file);
  continue;
 }
 if(!file.endsWith('.jpeg')){
  let source=bytes.toString('utf8').replace(/\r\n/g,'\n');
  if(file==='lib/restaurant-pilot.ts')source=source.replace("import { pilotOrderSelection, customerPaymentFinance } from './pilot-order-finance';\n",'').replace('.select(pilotOrderSelection(manager))',".select('*,delivery:delivery_orders(public_id,status,shipday_order_id),history:pilot_food_history(status,created_at),finance:order_financial_snapshots(payment_method,payment_status)')").replace('finance: customerPaymentFinance(o.finance)','finance: o.finance');
  if(file==='lib/shipday.ts')source=source.replace("import { merchantPickupText } from '@/lib/shipday-pickup-text';\n",'').replace('merchantPickupText(order.pickup_instructions),','order.pickup_instructions,');
  if(file==='lib/deliveries.ts')source=source.replace("import { requireShipdayWebhookToken } from '@/lib/shipday-webhook-auth';\n",'').replace('  requireShipdayWebhookToken(token);','  const expectedToken = process.env.SHIPDAY_WEBHOOK_TOKEN || "";\n  if (expectedToken && token !== expectedToken) {\n    throw new Error("Webhook no autorizado.");\n  }');
  bytes=Buffer.from(source);
 }
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected,'Unexpected operational change '+file);
}
const deliveries=fs.readFileSync('lib/deliveries.ts','utf8');
assert(deliveries.includes("rpc('claim_delivery_dispatch_v2'"));
assert(deliveries.includes("rpc('create_delivery_once_v3'"));
assert(fs.existsSync('supabase/drafts/order_receipts_v3.sql'),'Receipt SQL must accompany the local candidate');
assert(deliveries.includes('requireShipdayWebhookToken(token)'),'Do not remove webhook validation');
function load(file,mocks={}){const mod=new Module(file);mod.require=id=>id in mocks?mocks[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return mod.exports;}
(async()=>{
 const original=process.env.SHIPDAY_WEBHOOK_TOKEN,auth=load('lib/shipday-webhook-auth.ts');
 try{process.env.SHIPDAY_WEBHOOK_TOKEN='qa-existing-token';assert.throws(()=>auth.requireShipdayWebhookToken(null));assert.throws(()=>auth.requireShipdayWebhookToken('wrong'));auth.requireShipdayWebhookToken('qa-existing-token');delete process.env.SHIPDAY_WEBHOOK_TOKEN;assert.throws(()=>auth.requireShipdayWebhookToken(null),error=>error.status===503);}finally{if(original===undefined)delete process.env.SHIPDAY_WEBHOOK_TOKEN;else process.env.SHIPDAY_WEBHOOK_TOKEN=original;}
 class AccountError extends Error{constructor(message,status){super(message);this.status=status;}}
 const row={id:'qa-delivery',public_id:'MCU-000001',customer_user_id:'owner',status:'assigned',created_at:'2026-10-29',updated_at:'2026-10-29',customer_phone:'PRIVATE'};
 const db={from(name){let allowed=true;return{select(){return this;},eq(key,value){allowed=allowed&&row[key]===value;return this;},async maybeSingle(){return {data:name==='delivery_orders'&&allowed?row:null,error:null};}};}};
 const tracking=load('lib/delivery-tracking.ts',{'./account-server':{AccountError},'./supabase-admin':{getSupabaseAdminClient:()=>db},'./account-model':{deliveryLabels:{assigned:'Mensajero asignado'}}});
 const own=await tracking.authorizedDeliveryTracking('owner','MCU-000001');assert(!JSON.stringify(own).includes('PRIVATE'));await assert.rejects(()=>tracking.authorizedDeliveryTracking('other','MCU-000001'),error=>error.status===404);
 row.public_id='MCU-1-000001';assert.equal((await tracking.authorizedDeliveryTracking('owner',row.public_id)).publicId,row.public_id);await assert.rejects(()=>tracking.authorizedDeliveryTracking('other',row.public_id),error=>error.status===404);
 console.log('PASS preserved payment QR, authentication, manifest and provider payload; explicit order-change projection/worker contract, logistics hashes, webhook and private tracking. Order changes remain local and REQUIRE approved migration/activation. No dispatches executed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
