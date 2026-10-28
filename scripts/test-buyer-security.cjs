const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file, mocks = {}) {
  const mod = new Module(file);
  mod.require = id => id in mocks ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file + '.cjs');
  return mod.exports;
}
class AccountError extends Error { constructor(message, status) { super(message); this.status = status; } }
(async () => {
  const original = process.env.SHIPDAY_WEBHOOK_TOKEN;
  const auth = load('lib/shipday-webhook-auth.ts');
  try {
    delete process.env.SHIPDAY_WEBHOOK_TOKEN;
    assert.throws(() => auth.requireShipdayWebhookToken(null), e => e.status === 503);
    process.env.SHIPDAY_WEBHOOK_TOKEN = 'local-test-not-production';
    for (const token of [null, '', 'wrong', 'local-test-not-productioN'])
      assert.throws(() => auth.requireShipdayWebhookToken(token), e => e.status === 401);
    auth.requireShipdayWebhookToken('local-test-not-production');
    let applied = 0;
    const route = load('app/api/webhooks/shipday/route.ts', {
      '@/lib/shipday-webhook-auth': auth,
      '@/lib/deliveries': { applyShipdayWebhook: async () => { applied++; return {ok:true}; } },
    });
    assert.equal((await route.POST(new Request('http://localhost/api/webhooks/shipday', {method:'POST',body:'{}'}))).status,401);
    assert.equal(applied, 0);
    assert.equal((await route.POST(new Request('http://localhost/api/webhooks/shipday', {method:'POST',headers:{token:'local-test-not-production'},body:'{}'}))).status,200);
    assert.equal(applied, 1);
  } finally { if(original === undefined) delete process.env.SHIPDAY_WEBHOOK_TOKEN; else process.env.SHIPDAY_WEBHOOK_TOKEN=original; }

  const rows = { delivery_orders: [{id:'d1',public_id:'MCU-000001',customer_user_id:'owner',status:'assigned',updated_at:'2026-01-01',customer_phone:'PRIVATE',delivery_latitude:8}], pilot_food_orders: [] };
  const db = { from: name => { let filtered=rows[name]; return {
    select(){return this;},eq(key,value){filtered=filtered.filter(r=>r[key]===value);return this;},
    async maybeSingle(){return {data:filtered[0] || null,error:null};},
  }; } };
  const tracking=load('lib/delivery-tracking.ts',{
    './account-server':{AccountError},'./supabase-admin':{getSupabaseAdminClient:()=>db},
    './account-model':{deliveryLabels:{assigned:'Mensajero asignado'}},
  });
  const own=await tracking.authorizedDeliveryTracking('owner','MCU-000001');
  assert.equal(own.label,'Mensajero asignado');
  assert(!JSON.stringify(own).includes('PRIVATE'));
  assert(!('delivery_latitude' in own));
  await assert.rejects(()=>tracking.authorizedDeliveryTracking('foreign','MCU-000001'),e=>e.status===404);
  rows.pilot_food_orders.push({id:'f1',delivery_order_id:'d1',customer_id:'food-owner'});
  assert.equal((await tracking.authorizedDeliveryTracking('food-owner','MCU-000001')).publicId,'MCU-000001');
  await assert.rejects(()=>tracking.authorizedDeliveryTracking('owner','MCU-999999'),e=>e.status===404);
  const trackingRoute=load('app/api/seguimiento/[publicId]/route.ts',{
    '@/lib/account-server':{accountUser:async()=>{throw new AccountError('No autorizado',401);},accountJson:()=>{},accountFailure:e=>new Response('{}',{status:e.status})},
    '@/lib/delivery-tracking':{authorizedDeliveryTracking:()=>{throw Error('Must not query before authentication');}},
  });
  assert.equal((await trackingRoute.GET(new Request('http://localhost'),{params:{publicId:'MCU-000001'}})).status,401);

  const deliveries=[]; const claims=new Set(); let providerCalls=0,failSave=false;
  const dispatchDb={
    rpc:async(_name,{p_order})=>{const claimed=!claims.has(p_order);claims.add(p_order);return {data:claimed,error:null};},
    from(name){let filters=[],insert,updates;return {
      insert(value){insert=value;return this;},update(value){updates=value;return this;},
      select(){return this;},eq(key,value){filters.push([key,value]);return this;},
      async single(){
        if(name==='delivery_status_history')return {data:null,error:null};
        if(insert){if(deliveries.some(r=>r.request_key===insert.request_key))return {data:null,error:{code:'23505'}};
          const row={...insert,id:`d${deliveries.length+1}`,public_id:`MCU-00000${deliveries.length+1}`,shipday_order_id:null};deliveries.push(row);return {data:{...row},error:null};}
        const row=deliveries.find(r=>filters.every(([key,value])=>r[key]===value));
        if(updates&&failSave&&updates.shipday_order_id){failSave=false;return {data:null,error:{message:'Simulated persistence outage'}};}
        if(row&&updates)Object.assign(row,updates);
        return {data:row?{...row}:null,error:null};
      },async maybeSingle(){return this.single();},
      then(resolve){return resolve({data:null,error:null});},
    };},
  };
  const logistics=load('lib/deliveries.ts',{
    '@/lib/supabase-admin':{getSupabaseAdminClient:()=>dispatchDb},
    '@/lib/delivery-config':{getDeliveryFeeCop:()=>5000},
    '@/lib/delivery-types':load('lib/delivery-types.ts'),
    '@/lib/shipday-webhook-auth':auth,
    '@/lib/shipday':{getLogisticsProvider:()=>({createOrder:async()=>{providerCalls++;return {externalOrderId:`provider-${providerCalls}`};}})},
  });
  const input={requestKey:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',serviceType:'Recoger una compra',customerName:'Synthetic',customerPhone:'3000000000',pickupName:'Test pickup',pickupAddress:'Test address',pickupPhone:'3000000000',deliveryName:'Synthetic',deliveryAddress:'Test destination',deliveryPhone:'3000000000',description:'Synthetic test'};
  const repeated=await Promise.all([logistics.createDeliveryOrder(input),logistics.createDeliveryOrder(input)]);
  assert.equal(repeated[0].order.id,repeated[1].order.id);assert.equal(deliveries.length,1);assert.equal(providerCalls,1);
  await assert.rejects(()=>logistics.createDeliveryOrder({...input,description:'Changed'}));
  await logistics.syncOrderToShipday(deliveries[0]);assert.equal(providerCalls,1);
  failSave=true;
  const uncertain=await logistics.createDeliveryOrder({...input,requestKey:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
  assert.equal(uncertain.shipdayCreated,false);assert.equal(providerCalls,2);
  await logistics.syncOrderToShipday(uncertain.order);assert.equal(providerCalls,2,'Provider must not be called again after an ambiguous save failure');

  const realFetch=global.fetch,oldApiKey=process.env.SHIPDAY_API_KEY;
  try {
    process.env.SHIPDAY_API_KEY='local-test-key';let payload;
    global.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return new Response(JSON.stringify({success:true,orderId:123}),{status:200});};
    const {ShipdayProvider}=load('lib/shipday.ts');
    const baseOrder={public_id:'MCU-000001',id:'local',pickup_address:'Pickup',delivery_address:'Delivery',pickup_phone:'3000000000',customer_phone:'3000000000',delivery_phone:'3000000000',pickup_latitude:8.1,pickup_longitude:-74.7,delivery_latitude:8.09,delivery_longitude:-74.78};
    await new ShipdayProvider().createOrder(baseOrder);
    assert.equal(payload.pickupLatitude,8.1);assert.equal(payload.deliveryLatitude,8.09);
    assert.equal(payload.deliveryLongitude,-74.78);
    await new ShipdayProvider().createOrder({...baseOrder,pickup_latitude:null,pickup_longitude:null,delivery_latitude:null,delivery_longitude:null});
    assert(!('deliveryLatitude' in payload));assert(!('pickupLatitude' in payload));
  } finally {global.fetch=realFetch;if(oldApiKey===undefined)delete process.env.SHIPDAY_API_KEY;else process.env.SHIPDAY_API_KEY=oldApiKey;}

  const pg=new PGlite();
  try {
    await pg.exec(`create role anon; create role authenticated; create role service_role;
      create table delivery_orders(id uuid primary key,updated_at timestamptz default now(),shipday_order_id text,status text default 'created');`);
    await pg.exec(fs.readFileSync('supabase/drafts/delivery_safety.sql','utf8'));
    await pg.exec(`insert into delivery_orders(id,request_key) values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');`);
    const claim=()=>pg.query(`select claim_delivery_dispatch('11111111-1111-4111-8111-111111111111') as claimed`);
    const claims=await Promise.all([claim(),claim(),claim()]);
    assert.equal(claims.filter(r=>r.rows[0].claimed).length,1);
    assert.equal((await claim()).rows[0].claimed,false,'Uncertain attempts must not be automatically resent');
    await assert.rejects(()=>pg.exec(`insert into delivery_orders(id,request_key) values('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222')`),e=>e.code==='23505');
    const privileges=await pg.query(`select has_function_privilege('anon','claim_delivery_dispatch(uuid)','EXECUTE') as anon,has_function_privilege('authenticated','claim_delivery_dispatch(uuid)','EXECUTE') as authenticated,has_function_privilege('service_role','claim_delivery_dispatch(uuid)','EXECUTE') as service`);
    assert.deepEqual(privileges.rows[0],{anon:false,authenticated:false,service:true});
    await pg.exec(fs.readFileSync('supabase/drafts/delivery_safety.sql','utf8'));
  } finally { await pg.close(); }
  console.log('PASS local webhook auth, tracking authorization/redaction, SQL dispatch claim, duplicate request and SQL function permissions. No production calls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
