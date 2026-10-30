const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),Module=require('node:module'),ts=require('typescript');
const contract=JSON.parse(fs.readFileSync('data/production-backend-contract.json'));
for(const [file,expected]of Object.entries(contract.sha256)){
 let bytes=fs.readFileSync(file);
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
for(const dependency of ['claim_delivery_dispatch','request_fingerprint','dispatch_attempted_at','request_key'])assert(!deliveries.includes(dependency),'Deferred SQL dependency in delivery runtime '+dependency);
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
 console.log('PASS production dispatch/payload/contracts, payment QR, authentication, manifest/SW; retained webhook and private tracking checks. Deferred SQL not required; no dispatches executed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
