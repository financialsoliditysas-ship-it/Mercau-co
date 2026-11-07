const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { computeRestaurantDispatchDueAt, advanceRestaurantDispatchDueAt, isRestaurantDispatchDue } = load('lib/restaurant-dispatch-schedule.ts');

function load(file) {
  const mod = new Module(file);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, `${file}.cjs`);
  return mod.exports;
}

function fakeDispatchGuard() {
  const claimed = new Set();
  let providerCalls = 0;
  return {
    claim(id) {
      if (claimed.has(id)) return false;
      claimed.add(id); providerCalls += 1; return true;
    },
    get providerCalls() { return providerCalls; }
  };
}

async function main() {
  const acceptedAt = new Date('2026-11-06T15:00:00.000Z');
  const due = computeRestaurantDispatchDueAt({ acceptedAt, preparationMinutes: 15, dispatchLeadMinutes: 3 });
  assert.equal(due.toISOString(), '2026-11-06T15:12:00.000Z', 'El piloto debe iniciar la búsqueda en el minuto 12.');
  assert.equal(computeRestaurantDispatchDueAt({ acceptedAt }).toISOString(), due.toISOString(), 'Los valores por defecto deben ser 15 y 3.');
  assert.equal(isRestaurantDispatchDue(due, '2026-11-06T15:11:59.000Z'), false, 'Antes del minuto 12 no se debe iniciar.');
  assert.equal(isRestaurantDispatchDue(due, '2026-11-06T15:12:00.000Z'), true, 'En el minuto 12 se debe iniciar.');

  const readyAt = new Date('2026-11-06T15:04:00.000Z');
  assert.equal(advanceRestaurantDispatchDueAt(readyAt).toISOString(), readyAt.toISOString(), 'Pedido listo adelanta la búsqueda a ahora.');
  assert.equal(isRestaurantDispatchDue(advanceRestaurantDispatchDueAt(readyAt), '2026-11-06T15:04:00.000Z'), true);

  const guard = fakeDispatchGuard();
  assert.equal(guard.claim('MCU-1-000001'), true, 'El primer worker puede reclamar el despacho.');
  assert.equal(guard.claim('MCU-1-000001'), false, 'Un segundo worker no puede reclamar el mismo despacho.');
  assert.equal(guard.claim('MCU-1-000001'), false, 'Cerrar y reabrir el enlace no debe duplicar el despacho.');
  assert.equal(guard.providerCalls, 1, 'La protección debe dejar una sola llamada al proveedor.');

  const canceled = { canceledAt: '2026-11-06T15:05:00.000Z', dispatchDueAt: due.toISOString() };
  assert.equal(canceled.canceledAt < canceled.dispatchDueAt, true);
  assert.equal(isRestaurantDispatchDue(canceled.dispatchDueAt, canceled.canceledAt), false, 'Una cancelación previa deja el envío fuera de la cola.');

  const migration = fs.readFileSync('supabase/migrations/20261106193000_restaurant_auto_dispatch.sql', 'utf8');
  const dispatcher = fs.readFileSync('lib/restaurant-dispatch.ts', 'utf8');
  const delivery = fs.readFileSync('lib/deliveries.ts', 'utf8');
  for (const marker of [
    'preparation_minutes', 'dispatch_lead_minutes', 'dispatch_scheduled_at',
    'restaurant_order_action_links', 'restaurant_order_messages', 'pilot_food_transition_v4',
    'claim_delivery_dispatch_v2'
  ]) assert.match(`${migration}\n${dispatcher}\n${delivery}`, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Falta el contrato ${marker}.`);
  console.log('PASS restaurant auto-dispatch: minuto 12, adelanto por Pedido listo, cancelación previa y reclamación única simulados. No se contactó Shipday ni WhatsApp.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
