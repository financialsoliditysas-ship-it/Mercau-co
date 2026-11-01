const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const buyer='11111111-1111-4111-8111-111111111111',manager='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const migration='supabase/migrations/20261030174526_order_change_proposals.sql';
function load(file,mocks={}){const mod=new Module(file);mod.require=id=>id in mocks?mocks[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return mod.exports;}
async function database(){
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    insert into auth.users(id) values('${buyer}'),('${manager}'),('${other}');`);
  for(const file of ['delivery_orders','restaurant_pilot','business_admins','financial_ledger','breb_payments','pilot_operations_settlements','business_order_configuration','business_order_pricing_correction','account_workspace','shipday_carriers'])await db.exec(fs.readFileSync('supabase/'+file+'.sql','utf8'));
  // Reuse schema-only prefixes, excluding historical production onboarding statements.
  await db.exec(fs.readFileSync('supabase/restaurant_directory.sql','utf8').split('alter table public.business_catalog_products')[0]+'commit;');
  await db.exec(fs.readFileSync('supabase/restaurant_live_orders.sql','utf8').split('create or replace function')[0]+'commit;');
  await db.exec('grant select,insert,update on all tables in schema public to service_role;grant usage,select on all sequences in schema public to service_role;');
  await db.exec(fs.readFileSync(migration,'utf8'));
  await db.exec(`insert into pilot_restaurants(id,name,enabled,pickup_address,pickup_phone) values('qa','Ficticio',true,'Ficticia','3000000000');
    insert into pilot_restaurant_members values('qa','${manager}','manager');`);
  let serial=0;
  const line={lineId:'44444444-4444-4444-8444-444444444444',productId:'old',name:'Original',quantity:2,unitPrice:10000,selections:[],note:'Sin salsa'};
  const replacement={...line,productId:'new',name:'Alternativa',unitPrice:12000,note:'',selections:[{groupName:'Salsa',choices:[{name:'Aparte',priceDelta:0}]}]};
  const uuid=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
  const create=async(status='pending')=>(await db.query(`insert into pilot_food_orders(restaurant_id,customer_id,request_key,customer_name,customer_phone,address,neighborhood,lines,subtotal,delivery_fee,status,commission_rate_bps)
    values('qa',$1,$2,'Ficticio','3000000000','Ficticia','Ficticio',$3::jsonb,20000,5000,$4,2300) returning *`,[buyer,uuid(),JSON.stringify([line]),status])).rows[0];
  const propose=async(o,actor=manager,key=uuid(),lines=[replacement])=>(await db.query('select propose_food_change_v1($1,$2,$3,$4::jsonb) as result',[o.id,actor,key,JSON.stringify({old_lines:[line],old_subtotal:20000,new_lines:lines,new_subtotal:lines.reduce((n,l)=>n+l.quantity*l.unitPrice,0)})])).rows[0].result;
  const respond=async(id,action,actor=buyer)=>(await db.query('select respond_food_change_v1($1,$2,$3) as result',[id,actor,action])).rows[0].result;
  const food=async(id)=>(await db.query('select * from pilot_food_orders where id=$1',[id])).rows[0];
  const finance=async(id)=>(await db.query('select * from order_financial_snapshots where food_order_id=$1',[id])).rows[0];
  const o=await create(),originalFinance=await finance(o.id),key=uuid();
  await assert.rejects(()=>propose(o,other),/Acceso denegado/);
  const p=await propose(o,manager,key);assert.equal((await propose(o,manager,key)).replayed,true);
  assert.deepEqual((await food(o.id)).lines,[line]);assert.deepEqual(await finance(o.id),originalFinance);
  await assert.rejects(()=>db.query("select pilot_food_transition($1,$2,'accepted')",[o.id,manager]),/propuesta/);
  await assert.rejects(()=>respond(p.id,'accept',other),/Acceso denegado/);
  await assert.rejects(()=>respond(p.id,'accept',null),/Acceso denegado/);
  await assert.rejects(()=>propose(o),/pendiente/);
  await assert.rejects(()=>db.query('update pilot_food_orders set subtotal=100 where id=$1',[o.id]),/propuesta/);
  assert.equal((await respond(p.id,'accept')).replayed,false);
  assert.equal((await respond(p.id,'accept')).replayed,true);
  assert.equal((await food(o.id)).subtotal,24000);
  const updated=await finance(o.id);assert.equal(updated.product_subtotal,24000);assert.equal(updated.customer_total,29000);
  assert.equal(updated.merchant_commission_total,5520);assert.equal(updated.merchant_net,18480);
  for(const field of ['delivery_fee','mercau_delivery_share','courier_share','vega_share','payment_method','payment_status','merchant_commission_rate_bps'])assert.equal(updated[field],originalFinance[field],field);
  const audit=(await db.query('select finance_before,finance_after from food_order_change_proposals where id=$1',[p.id])).rows[0];
  assert.equal(audit.finance_before.product_subtotal,20000);assert.equal(audit.finance_after.product_subtotal,24000);
  assert.equal((await db.query("select count(*)::int n from pilot_food_history where order_id=$1 and status='change_accepted'",[o.id])).rows[0].n,1);
  const accepted=await create('accepted'),p2=await propose(accepted);
  const before=(await db.query('select count(*)::int n from delivery_orders')).rows[0].n;
  await assert.rejects(()=>db.query("select pilot_food_transition($1,$2,'ready')",[accepted.id,manager]),/propuesta/);
  assert.equal((await db.query('select count(*)::int n from delivery_orders')).rows[0].n,before,'Blocked dispatch must roll back the delivery insert');
  await respond(p2.id,'decline');await assert.rejects(()=>db.query("select pilot_food_transition($1,$2,'ready')",[accepted.id,manager]),/propuesta/);
  await respond(p2.id,'withdraw',manager);assert.equal((await food(accepted.id)).subtotal,20000);
  const cancelled=await create(),p3=await propose(cancelled);
  await db.query("select pilot_food_transition($1,$2,'rejected')",[cancelled.id,manager]);
  assert.equal((await db.query('select status from food_order_change_proposals where id=$1',[p3.id])).rows[0].status,'cancelled');
  await assert.rejects(()=>respond(p3.id,'accept'),/disponible/);
  const paid=await create();await db.query("update order_financial_snapshots set payment_status='CONFIRMED' where food_order_id=$1",[paid.id]);
  await assert.rejects(()=>propose(paid),/financieros/);
  const paidLater=await create(),p4=await propose(paidLater);
  await db.query("update order_financial_snapshots set payment_status='CONFIRMED' where food_order_id=$1",[paidLater.id]);
  await assert.rejects(()=>respond(p4.id,'accept'),/pagos/);assert.equal((await food(paidLater.id)).subtotal,20000);
  const empty=await create();await assert.rejects(()=>propose(empty,manager,uuid(),[]),/Propuesta invalida/);
  const large=await create(),largeProposal=await propose(large,manager,uuid(),[{...replacement,unitPrice:100000000}]);
  await respond(largeProposal.id,'accept');assert.equal((await finance(large.id)).merchant_net,154000000,'Do not overflow integer intermediate commission multiplication');
  const serviceOrder=await create();await db.exec('set role service_role');
  const serviceProposal=await propose(serviceOrder);await respond(serviceProposal.id,'accept');
  await assert.rejects(()=>db.query("update food_order_change_proposals set old_lines='[]' where id=$1",[serviceProposal.id]),/permission denied/);
  await db.exec('reset role');assert.equal((await finance(serviceOrder.id)).product_subtotal,24000);
  for(const role of ['anon','authenticated']){
    const privileges=(await db.query(`select has_table_privilege($1,'food_order_change_proposals','SELECT') t,has_function_privilege($1,'public.respond_food_change_v1(uuid,uuid,text)','EXECUTE') f`,[role])).rows[0];
    assert.equal(privileges.t,false);assert.equal(privileges.f,false);
  }
  await db.exec('set role anon');await assert.rejects(()=>db.query('select * from food_order_change_proposals'),/permission denied/);await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from financial_events')).rows[0].n,0);
  console.log('PASS order change SQL: ownership, explicit acceptance, totals, audit, replay, declined/rejected/paid orders, server dispatch guard and RLS');
 }finally{await db.close();}
}
async function push(){
 let sent=0,disabled=0,filters=[];
 const endpoint='https://fcm.googleapis.com/fictitious';
 const fake={endpoint,keys:{p256dh:Buffer.alloc(65,1).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}};
 const api=load('lib/customer-push.ts',{'./business-push':{configureWebPush:()=>true},'./order-changes-config':{orderChangesEnabled:()=>true},'./supabase-admin':{getSupabaseAdminClient:()=>({from(){return{select(){return this;},eq(k,v){filters.push([k,v]);return this;},is(){return this;},limit:async()=>({data:[{endpoint,p256dh:fake.keys.p256dh,auth:fake.keys.auth}]}),update(){disabled++;return this;},then(resolve){resolve({});}};}})},'web-push':{default:{sendNotification:async(_subscription,message)=>{sent++;const data=JSON.parse(message);assert.equal(data.kind,'CUSTOMER_ORDER_CHANGE');assert.equal(data.url,'/comprar/pedidos?pedido=PRB-000001');assert(!/3000000000|Ficticia|customer_phone/.test(message));}}}});
 assert(api.validCustomerSubscription(fake));
 for(const invalid of ['https://localhost/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','http://fcm.googleapis.com/a','https://user:pass@fcm.googleapis.com/a'])assert.equal(api.validCustomerSubscription({...fake,endpoint:invalid}),null);
 assert.equal(api.validCustomerSubscription({...fake,keys:{...fake.keys,auth:'short'}}),null);
 await api.sendCustomerChangePush(buyer,'PRB-000001','fake');assert.equal(sent,1);assert(filters.some(([k,v])=>k==='user_id'&&v===buyer));assert.equal(disabled,0);
 const events={},notifications=[],messages=[];
 require('node:vm').runInNewContext(fs.readFileSync('public/mercau-sw.js','utf8'),{importScripts:()=>{},self:{addEventListener:(type,fn)=>events[type]=fn,registration:{showNotification:async(...args)=>notifications.push(args)},location:{origin:'https://qa.invalid'}},clients:{matchAll:async()=>[{postMessage:data=>messages.push(data)}]},URL,Promise,Date});
 let completed;events.push({data:{json:()=>({kind:'CUSTOMER_ORDER_CHANGE',title:'Cambio',url:'/comprar/pedidos'})},waitUntil:p=>completed=p});await completed;assert.equal(messages[0].type,'MERCAU_CUSTOMER_ORDER_CHANGE');
 events.push({data:{json:()=>({orderId:'PRB-FAKE'})},waitUntil:p=>completed=p});await completed;assert.equal(messages[1].type,'MERCAU_NEW_ORDER_PUSH');assert.equal(notifications.length,2);
 console.log('PASS customer push: own user targeting, private payload, endpoint restrictions and separate worker event. No external push sent.');
}
async function service(publicId='PRB-000001'){
 const product={id:'new',name:'Alternativa',price:15000,image:'',category:'QA',optionGroups:[{id:'44444444-4444-4444-8444-444444444444',name:'Adicion',required:true,type:'single',minSelections:1,maxSelections:1,choices:[{id:'55555555-5555-4555-8555-555555555555',name:'Extra',priceDelta:2000}]}]};
 const row={id:'fake',public_id:'PRB-000001',restaurant_id:'qa',customer_id:buyer,customer_name:'Privado',customer_phone:'3000000000',address:'Ficticia',neighborhood:'Ficticia',payment_method:'CASH',subtotal:20000,lines:[{lineId:'66666666-6666-4666-8666-666666666666',productId:'old',name:'Original',quantity:2,unitPrice:10000}]};
 row.public_id=publicId;
 let rpc=0,notices=0,captured,replayed=false,enabled=true,proposalMatches=true;
 const db={from(name){return{select(){return this;},eq(k,v){if(k==='order_id')assert.equal(v,row.id);return this;},maybeSingle:async()=>({data:name==='pilot_food_orders'?row:proposalMatches?{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}:null,error:null})};},async rpc(name,args){rpc++;captured=args;return {data:name==='propose_food_change_v1'?{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',replayed}:{ok:true,replayed:false},error:null};}};
 const validation=load('lib/catalog-validation.ts');
 const pilot=load('lib/restaurant-pilot.ts',{'./business-order-hours':load('lib/business-order-hours.ts'),'./supabase-admin':{},'./deliveries':{},'./business-push':{},'./catalog-validation':validation,'./pilot-order-finance':{},'./order-changes-config':{orderChangesEnabled:()=>false},'./order-changes-model':{}});
 const api=load('lib/order-changes.ts',{'./supabase-admin':{getSupabaseAdminClient:()=>db},'./restaurant-pilot':{PilotError:pilot.PilotError,pilotMember:async id=>{if(id!==manager)throw new pilot.PilotError('No administras este negocio.',403);},pilotRestaurant:async()=>({menu:[product]}),validatePilotOrder:pilot.validatePilotOrder},'./order-changes-config':{orderChangesEnabled:()=>enabled},'./customer-push':{sendCustomerChangePush:async(id,publicId)=>{assert.equal(id,buyer);assert.equal(publicId,row.public_id);notices++;}}});
 const proposal={action:'propose',publicId:row.public_id,requestKey:'77777777-7777-4777-8777-777777777777',changes:[{lineId:row.lines[0].lineId,action:'replace',productId:'new',unitPrice:1,selections:[{groupId:product.optionGroups[0].id,choiceIds:[product.optionGroups[0].choices[0].id]}]}]};
 await assert.rejects(()=>api.changeOrder(other,proposal),e=>e.status===403);assert.equal(rpc,0);
 await api.changeOrder(manager,proposal);assert.equal(captured.p_payload.new_subtotal,34000);assert.equal(captured.p_payload.new_lines[0].unitPrice,17000);assert.equal(notices,1);
 replayed=true;await api.changeOrder(manager,proposal);assert.equal(notices,1,'Replayed proposals must not send a second push');
 await assert.rejects(()=>api.changeOrder(manager,{...proposal,changes:[{...proposal.changes[0],selections:[]}]}),/Completa/);
 await assert.rejects(()=>api.changeOrder(other,{action:'accept',publicId:row.public_id,proposalId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}),e=>e.status===404);
 proposalMatches=false;await assert.rejects(()=>api.changeOrder(buyer,{action:'accept',publicId:row.public_id,proposalId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}),e=>e.status===404);
 enabled=false;await assert.rejects(()=>api.changeOrder(manager,proposal),e=>e.status===404);
 let invoked=0;
 const route=load('app/api/pedidos/cambios/route.ts',{'@/lib/restaurant-pilot':{PilotError:pilot.PilotError,pilotUser:async()=>{throw new pilot.PilotError('Entra',401);}},'@/lib/order-changes':{changeOrder:async()=>{invoked++;}}});
 assert.equal((await route.POST(new Request('http://localhost/api/pedidos/cambios',{method:'POST',body:'{}'}))).status,401);assert.equal(invoked,0);
 console.log('PASS change service: manager/owner isolation, server catalog prices/options, no repeated push, proposal ownership, disabled feature and unauthenticated route.');
}
database().then(push).then(()=>service()).then(()=>service('MCU-1-000001')).catch(error=>{console.error(error);process.exitCode=1;});
