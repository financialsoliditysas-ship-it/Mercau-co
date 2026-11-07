const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const manager = '11111111-1111-4111-8111-111111111111';
const customer = '22222222-2222-4222-8222-222222222222';

async function main() {
  const db = new PGlite();
  const execFile = async file => db.exec(fs.readFileSync(file, 'utf8'));
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      insert into auth.users(id) values ('${manager}'), ('${customer}');`);
    for (const file of ['delivery_orders', 'restaurant_pilot', 'business_admins', 'financial_ledger', 'breb_payments',
      'pilot_operations_settlements', 'business_order_configuration', 'business_order_pricing_correction',
      'account_workspace', 'shipday_carriers']) {
      if (file === 'business_order_configuration') {
        const live = fs.readFileSync('supabase/restaurant_live_orders.sql', 'utf8');
        await db.exec(`${live.slice(0, live.indexOf('create or replace function'))}\ncommit;`);
      }
      await execFile(`supabase/${file}.sql`);
    }
    await execFile('supabase/drafts/logistics_controls_v2.sql');
    await execFile('supabase/migrations/20261030133030_order_creation_receipts.sql');
    await execFile('supabase/migrations/20261030174526_order_change_proposals.sql');
    await execFile('supabase/migrations/20261106193000_restaurant_auto_dispatch.sql');
    await db.exec('grant all on all tables in schema public to service_role; grant usage, select on all sequences in schema public to service_role;');
    await db.exec(`insert into pilot_restaurants(id,name,pickup_address,pickup_phone,enabled,is_live,delivery_mode,preparation_minutes,dispatch_lead_minutes)
      values('qa-auto','Asadero ficticio','Calle de prueba','3000000000',true,false,'MERCAU',15,3);
      insert into pilot_restaurant_members(restaurant_id,user_id,role) values('qa-auto','${manager}','manager');`);

    const lines = JSON.stringify([{ lineId: '33333333-3333-4333-8333-333333333333', productId: 'p1', name: 'Producto ficticio', basePrice: 20000, unitPrice: 20000, quantity: 1, selections: [], note: 'Sin cebolla' }]);
    const create = async () => (await db.query(`insert into pilot_food_orders(
      restaurant_id,customer_id,request_key,customer_name,customer_phone,address,neighborhood,instructions,lines,
      subtotal,delivery_fee,payment_method,delivery_mode,commission_rate_bps,customer_markup_bps)
      values('qa-auto','${customer}',gen_random_uuid(),'Cliente ficticio','3000000000','Dirección ficticia','Centro','',$1::jsonb,20000,5000,'CASH','MERCAU',1500,0) returning *`, [lines])).rows[0];
    const order = await create();
    const transition = async (action, actorType = 'business', actor = manager, actorReference = manager) =>
      (await db.query('select pilot_food_transition_v4($1,$2,$3,$4,$5) as result', [order.id, actor, action, actorType, actorReference])).rows[0].result;

    const accepted = await transition('accepted');
    assert.equal(accepted.dispatch, false);
    const stored = (await db.query('select status,accepted_at,estimated_preparation_minutes,dispatch_due_at,delivery_order_id from pilot_food_orders where id=$1', [order.id])).rows[0];
    assert.equal(stored.status, 'accepted');
    assert.equal(stored.estimated_preparation_minutes, 15);
    assert.equal(Math.round((new Date(stored.dispatch_due_at) - new Date(stored.accepted_at)) / 60000), 12);
    assert.ok(stored.delivery_order_id, 'Aceptar debe crear un único registro de despacho programado.');
    assert.equal((await db.query('select count(*)::int as count from delivery_orders where id=$1', [stored.delivery_order_id])).rows[0].count, 1);
    assert.equal((await transition('accepted')).dispatch, false, 'Aceptar repetido no debe crear otro despacho.');
    assert.equal((await db.query('select count(*)::int as count from delivery_orders where id=$1', [stored.delivery_order_id])).rows[0].count, 1);

    const ready = await transition('ready');
    assert.equal(ready.dispatch, true, 'Pedido listo antes de tiempo debe adelantar una única búsqueda.');
    const readyAgain = await transition('ready');
    assert.equal(readyAgain.dispatch, false, 'Acciones simultáneas o repetidas no deben volver a reclamar el envío.');
    const scheduled = (await db.query('select status,dispatch_scheduled_at,shipday_order_id,dispatch_attempted_at from delivery_orders where id=$1', [stored.delivery_order_id])).rows[0];
    assert.equal(scheduled.status, 'created');
    assert.equal(scheduled.shipday_order_id, null);
    assert.equal(scheduled.dispatch_attempted_at, null);
    assert.ok(scheduled.dispatch_scheduled_at);

    const rejectedOrder = await create();
    const rejected = (await db.query('select pilot_food_transition_v4($1,$2,$3,$4,$5) as result', [rejectedOrder.id, manager, 'rejected', 'business', manager])).rows[0].result;
    assert.equal(rejected.status, 'rejected');
    assert.equal((await db.query('select delivery_order_id from pilot_food_orders where id=$1', [rejectedOrder.id])).rows[0].delivery_order_id, null);

    const changeOrder = await create();
    const link = (await db.query(`insert into restaurant_order_action_links(restaurant_id,order_id,token_hash,expires_at)
      values('qa-auto',$1,'qa-link-hash',now()+interval '1 day') returning id`, [changeOrder.id])).rows[0];
    const replacement = [{ lineId: '33333333-3333-4333-8333-333333333333', productId: 'p2', name: 'Alternativa ficticia', basePrice: 21000, unitPrice: 21000, quantity: 1, selections: [], note: '' }];
    const proposal = (await db.query(`select propose_food_change_v2($1,null,$2,gen_random_uuid(),$3::jsonb) as result`, [
      changeOrder.id, link.id, JSON.stringify({ old_lines: changeOrder.lines, old_subtotal: changeOrder.subtotal, new_lines: replacement, new_subtotal: 21000 })
    ])).rows[0].result;
    assert.ok(proposal.id, 'El enlace protegido debe poder crear una propuesta.');
    const recorded = (await db.query('select proposed_by,proposed_by_link,proposed_via from food_order_change_proposals where id=$1', [proposal.id])).rows[0];
    assert.equal(recorded.proposed_by, null);
    assert.equal(recorded.proposed_by_link, link.id);
    assert.equal(recorded.proposed_via, 'whatsapp_link');

    console.log('PASS SQL restaurant auto-dispatch: programación, reclamación única y propuesta de cambio registrada desde enlace protegido. PGlite con esquema del repositorio; sin Shipday ni mensajes externos.');
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
