const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file, mocks = {}) {
  const mod = new Module(file);
  mod.require = id => id in mocks ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, file + '.cjs');
  return mod.exports;
}

async function sqlTests() {
  const pg = new PGlite();
  try {
    await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    // Actual delivery schema, indexes, triggers, constraints and carrier migration, not a substitute schema.
    await pg.exec(fs.readFileSync('supabase/delivery_orders.sql', 'utf8'));
    await pg.exec(fs.readFileSync('supabase/shipday_carriers.sql', 'utf8'));
    const insert = async () => (await pg.query(`insert into public.delivery_orders(
      service_type,customer_name,customer_phone,pickup_name,pickup_address,pickup_phone,
      delivery_name,delivery_address,delivery_phone,description)
      values('Recoger una compra','QA','000','QA','Ficticia','000','QA','Ficticia','000','QA') returning *`)).rows[0];
    const historical = await insert();
    const proposal = fs.readFileSync('supabase/drafts/logistics_controls_v2.sql', 'utf8');
    await pg.exec(proposal);
    const claim = id => pg.query('select public.claim_delivery_dispatch_v2($1) as result', [id]);
    assert.equal((await claim(historical.id)).rows[0].result, null, 'Historical uncertain sends must not be automatically retried');
    const order = await insert();
    await pg.exec(proposal);
    assert.equal((await pg.query('select dispatch_attempted_at from delivery_orders where id=$1',[order.id])).rows[0].dispatch_attempted_at,null,'Reapplying SQL must not block new unsent rows');
    const claims = await Promise.all([claim(order.id), claim(order.id), claim(order.id)]);
    assert.equal(claims.filter(result => result.rows[0].result).length, 1);
    assert.equal((await claim(order.id)).rows[0].result, null, 'No automatic second attempt after timeout/crash');
    const beforeSend = await insert();
    await pg.query('select public.cancel_unsubmitted_delivery_v2($1)', [beforeSend.id]);
    assert.equal((await claim(beforeSend.id)).rows[0].result, null);
    await assert.rejects(() => pg.query('select public.cancel_unsubmitted_delivery_v2($1)', [order.id]), /Shipday/);
    const event = async (row, status, timestamp, external = 'fake-provider', eventName = 'QA_' + status) => {
      const payload = { order: { id: external, order_number: row.public_id }, carrier: { name: 'Domiciliario ficticio' }, timestamp: Date.parse(timestamp) };
      return (await pg.query('select public.apply_shipday_event_v2($1,$2,$3,$4,$5,$6::jsonb) as result',
        [row.public_id, external, status, eventName, timestamp, JSON.stringify(payload)])).rows[0].result;
    };
    // Webhook may arrive before the POST response has been persisted.
    assert.equal((await event(order, 'assigned','2026-01-01T10:00:00Z')).status,'assigned');
    const completion = await pg.query('select public.complete_delivery_dispatch_v2($1,$2) as result',[order.id,'fake-provider']);
    assert.equal(completion.rows[0].result.status,'assigned','Late POST completion must not rewind webhook state');
    assert.equal((await event(order,'assigned','2026-01-01T10:00:00Z')).ignored,'duplicate');
    assert.equal((await event(order,'picked_up','2026-01-01T10:01:00Z')).status,'picked_up');
    assert.equal((await event(order,'assigned','2026-01-01T09:59:00Z')).ignored,'stale_event');
    assert.equal((await event(order,'assigned','2026-01-01T10:02:00Z')).ignored,'state_regression');
    assert.equal((await event(order,'unknown','2026-01-01T10:03:00Z')).ignored,'unknown_event');
    assert.equal((await event(order,'assigned','2026-01-01T10:03:01Z','fake-provider','ORDER_PIKEDUP_REMOVED')).status,'assigned');
    assert.equal((await event(order,'sent_to_shipday','2026-01-01T10:03:02Z','fake-provider','ORDER_UNASSIGNED')).status,'sent_to_shipday');
    assert.equal((await pg.query('select courier_name from delivery_orders where id=$1',[order.id])).rows[0].courier_name,null);
    assert.equal((await event(order,'in_transit','2026-01-01T10:03:03Z')).status,'in_transit');
    assert.equal((await event(order,'picked_up','2026-01-01T10:03:04Z','fake-provider','ORDER_ONTHEWAY_REMOVED')).status,'picked_up');
    await pg.exec(`create function public.qa_fail_history() returns trigger language plpgsql as $$
      begin if new.external_event='QA_ATOMIC_FAILURE' then raise exception 'QA history failure'; end if;return new;end $$;
      create trigger qa_fail_history before insert on public.delivery_status_history for each row execute function public.qa_fail_history();`);
    await assert.rejects(()=>event(order,'delivered','2026-01-01T10:03:05Z','fake-provider','QA_ATOMIC_FAILURE'),/QA history failure/);
    assert.equal((await pg.query('select status from delivery_orders where id=$1',[order.id])).rows[0].status,'picked_up','History failure rolls back state and event watermark');
    assert.equal((await event(order,'delivered','2026-01-01T10:04:00Z')).status,'delivered');
    assert.equal((await event(order,'cancelled','2026-01-01T10:05:00Z')).ignored,'terminal_state');
    const mismatch = await insert();
    await assert.rejects(() => event(mismatch,'assigned','2026-01-01T10:06:00Z'), /corresponde/);
    await assert.rejects(() => event(order,'assigned','2026-01-01T10:06:00Z','unrelated-provider'));
    const cancelled = await insert(); await claim(cancelled.id);
    assert.equal((await event(cancelled,'cancelled','2026-01-01T10:00:00Z','fake-cancelled','ORDER_DELETE')).status,'cancelled');
    assert.equal((await event(cancelled,'assigned','2026-01-01T10:01:00Z','fake-cancelled')).ignored,'terminal_state');
    for (const role of ['anon','authenticated']) {
      const rights = await pg.query(`select has_function_privilege($1,p.oid,'EXECUTE') as allowed
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname in ('claim_delivery_dispatch_v2','complete_delivery_dispatch_v2',
        'cancel_unsubmitted_delivery_v2','apply_shipday_event_v2')`, [role]);
      assert.equal(rights.rows.length,4); assert(rights.rows.every(row => !row.allowed));
      await pg.exec('set role ' + role);
      await assert.rejects(() => claim(order.id), /permission denied/);
      await pg.exec('reset role');
    }
    const serviceRights = await pg.query(`select has_function_privilege('service_role',p.oid,'EXECUTE') as allowed
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('claim_delivery_dispatch_v2','complete_delivery_dispatch_v2','cancel_unsubmitted_delivery_v2','apply_shipday_event_v2')`);
    assert.equal(serviceRights.rows.length,4);assert(serviceRights.rows.every(row=>row.allowed));
    const row = (await pg.query('select * from delivery_orders where id=$1',[order.id])).rows[0];
    assert.equal(row.status,'delivered'); assert.equal(row.courier_name,'Domiciliario ficticio');
    const metadata = (await pg.query("select metadata from delivery_status_history where external_event='QA_assigned' limit 1")).rows[0].metadata;
    assert(metadata.carrier, 'Preserve existing webhook metadata paths used by operations');
    console.log('PASS real delivery SQL: repeated/concurrent claims, historical protection, cancellation/dispatch exclusion, early webhook, stale/duplicate/unknown/terminal events, private RPC permissions. PGlite serializes requests; not a multi-process contention benchmark.');
  } finally { await pg.close(); }
}

async function runtimeTests() {
  const originalFetch = global.fetch;
  global.fetch = () => { throw new Error('Network forbidden in logistics regression tests'); };
  try {
    let row, calls, reserveError, completeError, financeError, providerError;
    const base = { id:'fake-id', public_id:'MCU-FAKE', status:'created', shipday_order_id:null, dispatch_attempted_at:null };
    const reset = () => { row={...base}; calls=0; reserveError=completeError=financeError=providerError=false; };
    const db = {
      from() { const updates={}; return {
        select(){return this;},eq(){return this;},is(){return this;},in(){return this;},
        update(value){Object.assign(updates,value);return this;},
        async single(){return {data:{...row},error:null};},
        then(resolve,reject){if(!row.shipday_order_id)Object.assign(row,updates);return Promise.resolve({error:null}).then(resolve,reject);}
      }; },
      async rpc(name,args) {
        if(name==='claim_delivery_dispatch_v2') {
          if(reserveError)return {error:{message:'mock SQL missing'},data:null};
          if(row.dispatch_attempted_at)return {data:null,error:null};
          row.dispatch_attempted_at='2026-01-01'; return {data:{...row},error:null};
        }
        if(name==='complete_delivery_dispatch_v2') {
          if(completeError)return {error:{message:'mock database unavailable'},data:null};
          Object.assign(row,{status:'sent_to_shipday',shipday_order_id:args.p_external});
          return {data:{...row},error:null};
        }
        throw new Error('Unexpected RPC ' + name);
      }
    };
    const api = load('lib/deliveries.ts',{
      '@/lib/supabase-admin':{getSupabaseAdminClient:()=>db},
      '@/lib/delivery-config':{},'@/lib/delivery-types':{},
      '@/lib/shipday':{getLogisticsProvider:()=>({async createOrder(){calls++;await Promise.resolve();if(providerError)throw new Error('fake timeout');return {externalOrderId:'fake-shipday'};}})},
      '@/lib/shipday-webhook-auth':{requireShipdayWebhookToken(){throw new Error('unauthorized');}},
      './dispatch-finance':{async prepareDispatchFinance(order){if(financeError)throw new Error('finance unavailable');return order;}},
      './shipday-reconciliation':{}
    });
    reset(); const sent = await api.syncOrderToShipday(base); assert(sent.shipdayCreated); assert.equal(calls,1);
    await api.syncOrderToShipday(base); assert.equal(calls,1,'Stale caller cannot create a second provider order');
    reset(); await Promise.allSettled([api.syncOrderToShipday(base),api.syncOrderToShipday(base)]);assert.equal(calls,1);
    reset();reserveError=true;await assert.rejects(()=>api.syncOrderToShipday(base));assert.equal(calls,0);
    reset();financeError=true;await assert.rejects(()=>api.syncOrderToShipday(base));assert.equal(calls,0);assert.equal(row.dispatch_attempted_at,null);
    reset();providerError=true;assert.equal((await api.syncOrderToShipday(base)).shipdayCreated,false);await assert.rejects(()=>api.syncOrderToShipday(base));assert.equal(calls,1);
    reset();completeError=true;await assert.rejects(()=>api.syncOrderToShipday(base),/Shipday recibió/);completeError=false;await assert.rejects(()=>api.syncOrderToShipday(base));assert.equal(calls,1);
    await assert.rejects(()=>api.applyShipdayWebhook({},null),/unauthorized/);
    console.log('PASS dispatch runtime: one provider call, stale caller, overlapping calls, missing SQL fail closed, finance failure before provider, timeout and persistence-failure no-resend, webhook auth retained. All provider calls mocked.');
  } finally { global.fetch=originalFetch; }
}

async function financeTests() {
  let failure='', patch, linked=true;
  const order={id:'fake',commerce_subtotal:60000,delivery_fee:5000,commerce_items:[{name:'Ficticio'}]};
  const snapshot={payment_method:'CASH',payment_status:'PENDING',product_subtotal:60000,delivery_fee:5000,customer_total:65000,merchant_net:51000};
  const db={from(table){return {select(){return this;},eq(){return this;},update(value){patch=value;return this;},
    async maybeSingle(){return {data:linked?{id:'food'}:null,error:failure==='link'?{}:null};},
    async single(){return table==='order_financial_snapshots'?{data:snapshot,error:failure==='snapshot'?{}:null}:{data:{...order,...patch},error:failure==='write'?{}:null};}};}};
  const {prepareDispatchFinance}=load('lib/dispatch-finance.ts',{'./supabase-admin':{getSupabaseAdminClient:()=>db}});
  for(const mode of ['CASH','BREB_QR']){
    snapshot.payment_method=mode;snapshot.payment_status='PENDING';
    await prepareDispatchFinance(order);assert(patch.pickup_instructions.includes('COP 51000'));assert(patch.notes.includes('65000'));
  }
  assert(patch.notes.includes('Financial Solidity S.A.S.'));
  snapshot.payment_status='CONFIRMED';await prepareDispatchFinance(order);assert(patch.notes.includes('No cobrar al cliente'));
  for(const value of ['link','snapshot','write']){failure=value;await assert.rejects(()=>prepareDispatchFinance(order));}
  failure='';snapshot.merchant_net=0;await prepareDispatchFinance(order);assert(patch.pickup_instructions.includes('COP 0'));
  snapshot.merchant_net=60001;await assert.rejects(()=>prepareDispatchFinance(order));snapshot.merchant_net=51000;
  snapshot.customer_total=1;await assert.rejects(()=>prepareDispatchFinance(order));snapshot.customer_total=65000;
  linked=false;await assert.rejects(()=>prepareDispatchFinance(order));await prepareDispatchFinance({...order,commerce_items:[]});
  console.log('PASS unchanged financial snapshots: cash/Bre-B on delivery/prepaid, QR beneficiary, zero net, missing/mismatched allocations and failed persistence block dispatch. Mocked database, no payment calls.');
}

async function routeTests() {
  const savedAdmin=process.env.ADMIN_METRICS_PASSWORD, savedWebhook=process.env.SHIPDAY_WEBHOOK_TOKEN;
  let calls=0, failure=false;
  class DeliveryControlError extends Error { constructor(message,status=409){super(message);this.status=status;} }
  const auth=load('lib/shipday-webhook-auth.ts');
  const delivery={DeliveryControlError,
    async getDeliveryOrderById(){calls++;return {id:'fake'};},
    async syncOrderToShipday(){throw new DeliveryControlError('Requiere conciliación.');},
    async cancelDeliveryOrder(){throw new DeliveryControlError('Cancela primero en Shipday.');},
    async applyShipdayWebhook(){calls++;if(failure)throw new DeliveryControlError('Database unavailable',503);return {ok:true};}
  };
  const admin=load('app/api/admin/envios/route.ts',{'@/lib/deliveries':delivery});
  const webhook=load('app/api/webhooks/shipday/route.ts',{'@/lib/deliveries':delivery,'@/lib/shipday-webhook-auth':auth});
  const request=(url,body,headers={})=>new Request('http://localhost'+url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  try {
    process.env.ADMIN_METRICS_PASSWORD='qa-not-real-admin';process.env.SHIPDAY_WEBHOOK_TOKEN='qa-not-real-webhook';
    assert.equal((await admin.POST(request('/api/admin/envios',{id:'fake',action:'retry_shipday'}))).status,401);assert.equal(calls,0);
    for(const action of ['retry_shipday','cancel']){
      const result=await admin.POST(request('/api/admin/envios',{id:'fake',action},{'x-admin-password':'qa-not-real-admin'}));
      assert.equal(result.status,409);assert.equal((await result.json()).ok,false);
    }
    const before=calls;
    assert.equal((await webhook.POST(request('/api/webhooks/shipday',{}, {token:'wrong'}))).status,401);assert.equal(calls,before);
    delete process.env.SHIPDAY_WEBHOOK_TOKEN;
    assert.equal((await webhook.POST(request('/api/webhooks/shipday',{}))).status,503);assert.equal(calls,before);
    process.env.SHIPDAY_WEBHOOK_TOKEN='qa-not-real-webhook';
    assert.equal((await webhook.POST(request('/api/webhooks/shipday',{}, {token:'qa-not-real-webhook'}))).status,200);
    failure=true;assert.equal((await webhook.POST(request('/api/webhooks/shipday',{}, {token:'qa-not-real-webhook'}))).status,503);
    console.log('PASS real route handlers: admin authentication, controlled retry/cancel conflict, fail-closed webhook token and retryable database error. In-process requests only.');
  } finally {
    if(savedAdmin===undefined)delete process.env.ADMIN_METRICS_PASSWORD;else process.env.ADMIN_METRICS_PASSWORD=savedAdmin;
    if(savedWebhook===undefined)delete process.env.SHIPDAY_WEBHOOK_TOKEN;else process.env.SHIPDAY_WEBHOOK_TOKEN=savedWebhook;
  }
}

(async()=>{await sqlTests();await runtimeTests();await financeTests();await routeTests();})().catch(error=>{console.error(error);process.exitCode=1;});
