const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role service_role bypassrls;
      create table public.order_creation_receipts(id integer primary key);
      grant all on public.order_creation_receipts to service_role;`);
    const sql = fs.readFileSync('supabase/migrations/20261030170047_restrict_order_receipts_server_grants.sql', 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const { rows } = await db.query("select has_table_privilege('service_role', 'public.order_creation_receipts', $1) as allowed", [privilege]);
      assert.equal(rows[0].allowed, ['SELECT', 'INSERT'].includes(privilege), privilege);
    }
    await db.exec('set role service_role; insert into public.order_creation_receipts values (1);');
    assert.equal((await db.query('select count(*)::int as n from public.order_creation_receipts')).rows[0].n, 1);
    await assert.rejects(() => db.exec('update public.order_creation_receipts set id=2'), /permission denied/);
    await assert.rejects(() => db.exec('delete from public.order_creation_receipts'), /permission denied/);
    console.log('PASS receipt server grants, inherited defaults and repeat application');
  } finally {
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
