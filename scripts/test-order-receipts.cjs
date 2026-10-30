const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}){const mod=new Module(file);mod.require=id=>id in mocks?mocks[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return mod.exports;}
const uid='11111111-1111-4111-8111-111111111111', key='22222222-2222-4222-8222-222222222222';
async function database(){
 const pg=process.env.MERCAU_QA_POSTGRES_CONTAINER
  ?new (require('./helpers/docker-postgres.cjs').DockerPostgres)(process.env.MERCAU_QA_POSTGRES_CONTAINER):new PGlite();
 try{
  await pg.exec(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;
    end $$;
    create schema if not exists auth;create table if not exists auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    insert into auth.users(id) values('${uid}');`);
  for(const file of ['delivery_orders','restaurant_pilot','business_admins','financial_ledger','breb_payments','pilot_operations_settlements',
   'business_order_configuration','business_order_pricing_correction','account_workspace','shipday_carriers']){
   try{await pg.exec(fs.readFileSync('supabase/'+file+'.sql','utf8'));}catch(e){throw new Error(file+': '+e.message);}
  }
  await pg.exec(fs.readFileSync('supabase/drafts/logistics_controls_v2.sql','utf8'));
  const sql=fs.readFileSync('supabase/drafts/order_receipts_v3.sql','utf8');await pg.exec(sql);await pg.exec(sql);
  await pg.query("insert into pilot_restaurants(id,name,enabled) values('qa','Negocio ficticio',true)");
  const food={restaurant_id:'qa',customer_id:uid,request_key:key,customer_name:'QA',customer_phone:'3000000000',
   address:'Ficticia',neighborhood:'QA',instructions:'',lines:[{lineId:key,productId:'fake',name:'Ficticio',basePrice:1000,unitPrice:1000,quantity:1,selections:[],note:''}],
   subtotal:1000,delivery_fee:5000,payment_method:'CASH',delivery_mode:'MERCAU',commission_rate_bps:1500,customer_markup_bps:0,
   delivery_latitude:null,delivery_longitude:null,delivery_location_accuracy_m:null,delivery_location_captured_at:null};
  const createFood=(k,p=food,scope='food:'+uid+':qa')=>pg.query('select create_food_order_once_v3($1,$2,$3::jsonb) as result',[scope,k,JSON.stringify(p)]);
  const first=(await createFood(key)).rows[0].result;assert.equal(first.outcome,'created');
  const replay=(await createFood(key,{...food,lines:[{...food.lines[0],lineId:'33333333-3333-4333-8333-333333333333'}]})).rows[0].result;
  assert.equal(replay.outcome,'existing');assert.equal(replay.public_id,first.public_id);
  const conflict=(await createFood(key,{...food,address:'Otra dirección'})).rows[0].result;assert.equal(conflict.outcome,'conflict');
  assert.equal((await pg.query('select count(*)::int as n from pilot_food_orders')).rows[0].n,1);
  assert.equal((await pg.query('select count(*)::int as n from order_financial_snapshots')).rows[0].n,1);
  assert.equal((await pg.query('select merchant_net from order_financial_snapshots')).rows[0].merchant_net,850);
  const p={service_type:'Enviar un paquete',customer_name:'QA',customer_phone:'3000000000',pickup_name:'QA',pickup_address:'Ficticia',pickup_phone:'3000000000',
   delivery_name:'QA',delivery_address:'Ficticia',delivery_phone:'3000000000',description:'Ficticio',delivery_fee:5000,source:'WEB',customer_user_id:uid};
  const createDelivery=(k,payload=p,scope='delivery:user:'+uid)=>pg.query('select create_delivery_once_v3($1,$2,$3::jsonb) as result',[scope,k,JSON.stringify(payload)]);
  const results=await Promise.all([createDelivery(key),createDelivery(key),createDelivery(key)]);
  assert.equal(results.filter(result=>result.rows[0].result.outcome==='created').length,1);
  assert.equal(new Set(results.map(result=>result.rows[0].result.order.id)).size,1);
  assert.equal((await createDelivery(key,{...p,description:'Cambio'})).rows[0].result.outcome,'conflict');
  await assert.rejects(()=>createDelivery(key,p,'delivery:guest:other'),/duplicate key/);
  assert.equal((await pg.query('select count(*)::int as n from delivery_orders')).rows[0].n,1,'A receipt collision must roll back the delivery and its triggers');
  const order=results[0].rows[0].result.order;
  const claim=(await pg.query('select claim_delivery_dispatch_v2($1) as result',[order.id])).rows[0].result;
  for(const outcome of ['not_found','multiple','mismatch','unavailable']){
   await pg.query('select record_dispatch_reconciliation_v3($1,$2,$3,null,now())',[order.id,claim.dispatch_attempted_at,outcome]);
   assert.equal((await pg.query('select claim_delivery_dispatch_v2($1) as result',[order.id])).rows[0].result,null);
  }
  await pg.query("select record_dispatch_reconciliation_v3($1,$2,'matched','123',now())",[order.id,claim.dispatch_attempted_at]);
  const linked=(await pg.query('select * from delivery_orders where id=$1',[order.id])).rows[0];
  assert.equal(linked.shipday_order_id,'123');assert.equal(linked.status,'sent_to_shipday');assert(linked.dispatch_attempted_at);
  await assert.rejects(()=>pg.query("select record_dispatch_reconciliation_v3($1,$2,'matched','999',now())",[order.id,claim.dispatch_attempted_at]),/Vinculo diferente/);
  let serial=100;
  const uuid=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
  const foodResult=async(payload,k=uuid())=>(await createFood(k,payload)).rows[0].result;
  const duplicate=await foodResult(food);assert.equal(duplicate.outcome,'duplicate');assert.equal(duplicate.previous_public_id,first.public_id);
  const repeatKey=uuid(), repeat=await foodResult({...food,_repeat_of:first.public_id},repeatKey);
  assert.equal(repeat.outcome,'created');assert.notEqual(repeat.public_id,first.public_id);
  assert.equal((await foodResult(food,repeatKey)).public_id,repeat.public_id,'Repeating the confirmed second request must return the second order');
  assert.equal((await foodResult({...food,_repeat_of:first.public_id})).outcome,'duplicate','A stale confirmation cannot create a third order');
  assert.equal((await pg.query('select repeat_of_public_id from order_creation_receipts where request_key=$1',[repeatKey])).rows[0].repeat_of_public_id,first.public_id);
  const quantity={...food,subtotal:2000,lines:[{...food.lines[0],quantity:2}]};
  assert.equal((await foodResult(quantity)).outcome,'created');
  assert.equal((await foodResult({...quantity,lines:[food.lines[0],{...food.lines[0],lineId:uuid()}]})).outcome,'duplicate','Equivalent split quantities are the same comparison');
  const customized={...food,lines:[{...food.lines[0],selections:[{groupId:'sauce',choices:[{choiceId:'a'},{choiceId:'b'}]}]}]};
  assert.equal((await foodResult(customized)).outcome,'created');
  assert.equal((await foodResult({...customized,lines:[{...customized.lines[0],selections:[{groupId:'sauce',choices:[{choiceId:'b'},{choiceId:'a'}]}]}]})).outcome,'duplicate');
  assert.equal((await foodResult({...customized,lines:[{...food.lines[0],note:'Sin cebolla'}]})).outcome,'created','Different personalization remains a different purchase');
  const rejectedPayload={...food,address:'Destino rechazado'},rejectedKey=uuid();
  const rejected=await foodResult(rejectedPayload,rejectedKey);
  await pg.query("update pilot_food_orders set status='rejected' where public_id=$1",[rejected.public_id]);
  assert.equal((await foodResult(rejectedPayload)).outcome,'created','Rejected orders do not block a fresh request');
  assert.equal((await foodResult(rejectedPayload,rejectedKey)).public_id,rejected.public_id,'Same-key retry still returns rejected original');
  const cancelledPayload={...food,address:'Destino cancelado'},cancelled=await foodResult(cancelledPayload);
  const cancelledDelivery=(await createDelivery(uuid(),{...p,description:'Fixture cancelado'})).rows[0].result.order;
  await pg.query("update delivery_orders set status='cancelled' where id=$1",[cancelledDelivery.id]);
  await pg.query("update pilot_food_orders set delivery_order_id=$1,status='ready' where public_id=$2",[cancelledDelivery.id,cancelled.public_id]);
  assert.equal((await foodResult(cancelledPayload)).outcome,'created','Cancelled shipments do not block a new food order');
  const expiredPayload={...food,address:'Destino antiguo'},expired=await foodResult(expiredPayload);
  await pg.query("update pilot_food_orders set created_at=clock_timestamp()-interval '6 minutes' where public_id=$1",[expired.public_id]);
  assert.equal((await foodResult(expiredPayload)).outcome,'created','Comparison window is five minutes, not permanent deduplication');
  const uncertainPayload={...food,address:'Destino incierto'},uncertain=await foodResult(uncertainPayload);
  const uncertainDelivery=(await createDelivery(uuid(),{...p,description:'Fixture incierto'})).rows[0].result.order;
  await pg.query('select claim_delivery_dispatch_v2($1)',[uncertainDelivery.id]);
  await pg.query("update pilot_food_orders set delivery_order_id=$1,status='ready' where public_id=$2",[uncertainDelivery.id,uncertain.public_id]);
  assert.equal((await foodResult({...uncertainPayload,_repeat_of:uncertain.public_id})).outcome,'uncertain','Do not invite a fresh order while external dispatch is uncertain');
  await pg.query("update pilot_food_orders set created_at=clock_timestamp()-interval '6 minutes' where public_id=$1",[uncertain.public_id]);
  assert.equal((await foodResult(uncertainPayload)).outcome,'uncertain','Five minutes must not release an unresolved dispatch');
  const lookup=async(scope,k)=>(await pg.query('select lookup_order_receipt_v3($1,$2) as result',[scope,k])).rows[0].result;
  assert.equal((await lookup('food:'+uid+':qa',repeatKey)).public_id,repeat.public_id);
  assert.equal((await lookup('food:foreign:qa',repeatKey)).outcome,'not_found');
  const inventedRepeat=await foodResult({...food,_repeat_of:'PRB-999999'});
  assert.equal(inventedRepeat.outcome,'conflict');assert.equal(inventedRepeat.previous_public_id,undefined,'Do not expose or record a forged original');
  assert.equal((await lookup('delivery:user:'+uid,key)).public_id,order.public_id);
  const parallelPayload={...food,address:'Destino paralelo'};
  const parallel=await Promise.all([foodResult(parallelPayload),foodResult(parallelPayload),foodResult(parallelPayload)]);
  assert.equal(parallel.filter(result=>result.outcome==='created').length,1);assert.equal(parallel.filter(result=>result.outcome==='duplicate').length,2);
  const anchor=parallel.find(result=>result.outcome==='created').public_id;
  const confirms=await Promise.all([foodResult({...parallelPayload,_repeat_of:anchor}),foodResult({...parallelPayload,_repeat_of:anchor})]);
  assert.equal(confirms.filter(result=>result.outcome==='created').length,1,'Two confirmations of the same original cannot create two additional purchases');
  assert.equal(confirms.filter(result=>result.outcome==='duplicate').length,1);
  const secondUser=uuid();await pg.query('insert into auth.users(id) values($1)',[secondUser]);
  assert.equal((await createFood(uuid(),{...food,customer_id:secondUser},'food:'+secondUser+':qa')).rows[0].result.outcome,'created');
  assert.equal((await createFood(uuid(),{...food,customer_id:secondUser,_repeat_of:first.public_id},'food:'+secondUser+':qa')).rows[0].result.outcome,'conflict');
  await pg.query("insert into pilot_restaurants(id,name,enabled) values('qa-other','Otro negocio ficticio',true)");
  assert.equal((await createFood(uuid(),{...food,restaurant_id:'qa-other'},'food:'+uid+':qa-other')).rows[0].result.outcome,'created');
  console.log('PASS five-minute guard: new request keys, explicit second order and its replay, stale confirmations, quantities, options, notes, expiry, rejected/cancelled exclusion, uncertain dispatch block, private lookups and buyer/business isolation.');
  for(const role of ['anon','authenticated']){
   await pg.exec('set role '+role);
   await assert.rejects(()=>createFood(key),/permission denied/);
   await assert.rejects(()=>pg.query('select * from order_creation_receipts'),/permission denied/);
   await assert.rejects(()=>lookup('food:'+uid+':qa',key),/permission denied/);
   await assert.rejects(()=>pg.query("select record_dispatch_reconciliation_v3($1,$2,'matched','999',now())",[order.id,claim.dispatch_attempted_at]),/permission denied/);
   await pg.exec('reset role');
  }
  console.log('PASS real versioned schemas/triggers: food and delivery receipts, replay with new line IDs, payload conflict, one financial snapshot, cross-scope rejection and rollback, private RPCs, reconciliation with no rearming. '+(process.env.MERCAU_QA_POSTGRES_CONTAINER?'PostgreSQL with independent psql sessions.':'PGlite, not a multi-process PostgreSQL contention test.'));
 }finally{await pg.close();}
}
async function matching(){
 const {matchShipdayOrder,queryShipdayOrder}=load('lib/shipday-reconciliation.ts');
 const order={id:'qa',public_id:'MCU-QA',delivery_name:'QA',delivery_phone:'+573000000000',pickup_phone:'3000000001',delivery_address:'Entrega ficticia',delivery_neighborhood:'Sector',
  pickup_address:'Recogida ficticia',pickup_neighborhood:'Sector',commerce_subtotal:1000,delivery_fee:5000,commerce_items:[{name:'Ficticio',quantity:1,unitPrice:1000}],shipday_order_id:null};
 const row={orderId:123,orderNumber:'MCU-QA',customer:{name:'QA',phoneNumber:'3000000000',address:'Entrega ficticia, Sector, Bajo Cauca, Antioquia, Colombia'},
  restaurant:{phoneNumber:'+573000000001',address:'Recogida ficticia, Sector, Bajo Cauca, Antioquia, Colombia'},costing:{deliveryFee:5000},orderItems:order.commerce_items};
 assert.equal(matchShipdayOrder(order,[row]).outcome,'matched');
 assert.equal(matchShipdayOrder(order,[]).outcome,'not_found');assert.equal(matchShipdayOrder(order,[row,row]).outcome,'multiple');
 for(const bad of [{...row,orderItems:[]},{...row,customer:{...row.customer,phoneNumber:'wrong'}},{...row,costing:{deliveryFee:1}},{...row,orderId:''}])assert.equal(matchShipdayOrder(order,[bad]).outcome,'mismatch');
 assert.throws(()=>matchShipdayOrder(order,{error:'upstream failure'}));
 const original=global.fetch,previous=process.env.SHIPDAY_API_KEY;let count=0;
 try{
  process.env.SHIPDAY_API_KEY='qa-not-real';global.fetch=async(url,options)=>{count++;assert.equal(options.method,'GET');assert(String(url).endsWith('/orders/MCU-QA'));return new Response(JSON.stringify([row]),{status:200});};
  const result=await queryShipdayOrder(order);assert.equal(result.providerId,'123');assert(!JSON.stringify(result).includes('Entrega ficticia'));assert.equal(count,1);
 }finally{global.fetch=original;if(previous===undefined)delete process.env.SHIPDAY_API_KEY;else process.env.SHIPDAY_API_KEY=previous;}
 const intent=load('lib/order-intent.ts');const data=new Map(),store={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 let serial=0;const uuid=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
 const first=intent.pendingOrderIntent(store,'same-user-same-business','',uuid);
 assert.equal(intent.pendingOrderIntent(store,'same-user-same-business','',uuid),first,'Reload must reuse the pending reference');
 assert.notEqual(intent.pendingOrderIntent(store,'other-user-same-business','',uuid),first);
 intent.clearOrderIntent(store,'same-user-same-business');assert.notEqual(intent.pendingOrderIntent(store,'same-user-same-business','',uuid),first);
 console.log('PASS strict Shipday identity matching, no personal data returned, GET-only reconciliation and persistent browser intent. All provider requests mocked.');
}
async function foodService(){
 const business='rec'+'Q'.repeat(14),product='33333333-3333-4333-8333-333333333333';
 let outcome='created',pushes=0,captured,queries=0;
 const db={from(table){const value=table==='pilot_restaurants'?{id:business,name:'Ficticio',enabled:true,is_live:true,directory_initialized:true,directory_business_id:business,delivery_fee:5000,delivery_mode:'MERCAU',commission_rate_bps:1500,customer_markup_bps:0}:
  [{id:product,name:'Ficticio',section:'Comida',price:1000,option_groups:[],version:1}];
  return {select(){return this;},eq(){return this;},order(){return this;},async single(){return {data:value,error:null};},then(resolve,reject){return Promise.resolve({data:value,error:null}).then(resolve,reject);}};
 },async rpc(name,args){queries++;captured=args;if(name==='lookup_order_receipt_v3')return {data:{outcome:'existing',public_id:'PRB-000001'},error:null};
  assert.equal(name,'create_food_order_once_v3');return {data:{outcome,public_id:outcome==='created'||outcome==='existing'?'PRB-000001':undefined,previous_public_id:'PRB-000001'},error:null};}};
 const api=load('lib/restaurant-pilot.ts',{'./supabase-admin':{getSupabaseAdminClient:()=>db},'./deliveries':{},'./business-push':{sendNewOrderPush:async()=>{pushes++;}},
  './catalog-validation':{catalogOptionGroups:()=>[]},'./pilot-order-finance':load('lib/pilot-order-finance.ts')});
 const body={confirmed:true,requestKey:key,name:'QA',phone:'3000000000',address:'Ficticia',neighborhood:'QA',paymentMethod:'CASH',
  lines:[{lineId:key,productId:product,quantity:1,unitPrice:1,selections:[],note:''}],customer_id:'foreign',restaurant_id:'foreign'};
 assert.equal((await api.createPilotOrder(uid,body,business)).replayed,false);assert.equal(pushes,1);assert.equal(captured.p_payload.customer_id,uid);assert.equal(captured.p_payload.lines[0].unitPrice,1000);
 outcome='existing';assert.equal((await api.createPilotOrder(uid,body,business)).replayed,true);assert.equal(pushes,1);
 outcome='duplicate';await assert.rejects(()=>api.createPilotOrder(uid,body,business),error=>error.status===409&&error.canRepeat&&error.message==='Ya tienes un pedido reciente igual. ¿Quieres revisarlo o hacer otro?');assert.equal(pushes,1);
 outcome='uncertain';await assert.rejects(()=>api.createPilotOrder(uid,body,business),error=>error.status===409&&!error.canRepeat);assert.equal(pushes,1);
 const before=queries;await assert.rejects(()=>api.createPilotOrder(uid,{...body,repeatOf:'PRB-000001'},business),error=>error.status===400);assert.equal(queries,before,'No confirmation must not reach the creation RPC');
 outcome='created';await api.createPilotOrder(uid,{...body,repeatOf:'PRB-000001',repeatConfirmed:true},business);assert.equal(captured.p_payload._repeat_of,'PRB-000001');assert.equal(pushes,2);
 await api.lookupPilotOrderIntent(uid,key,business);assert.equal(captured.p_scope,`food:${uid}:${business}`);assert.equal(pushes,2);
 console.log('PASS actual food service: server prices/identity retained, exact duplicate message, explicit-repeat gate, one push per creation, none on replay/duplicate/uncertainty/lookup. Database and push simulated.');
}
(async()=>{await database();await matching();await foodService();})().catch(error=>{console.error(error);process.exitCode=1;});
