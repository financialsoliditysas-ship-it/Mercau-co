const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
const mod = new Module("age-test");
mod._compile(
  ts.transpileModule(fs.readFileSync("lib/account-age.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  "age-test.cjs",
);
const age = mod.exports;
const cases = [
  ["", "2026-10-15", age.invalidBirthDateMessage],
  ["2026-02-30", "2026-10-15", age.invalidBirthDateMessage],
  ["2007-02-29", "2026-10-15", age.invalidBirthDateMessage],
  ["1900-02-29", "2026-10-15", age.invalidBirthDateMessage],
  ["2008-10-16", "2026-10-15", age.minimumAgeMessage],
  ["2008-10-15", "2026-10-15", ""],
  ["2008-10-14", "2026-10-15", ""],
  ["2026-10-16", "2026-10-15", age.futureBirthDateMessage],
  ["2008-02-29", "2026-02-28", age.minimumAgeMessage],
  ["2008-02-29", "2026-03-01", ""],
  ["2000-02-29", "2026-10-15", ""],
  ["0000-01-01", "2026-10-15", age.invalidBirthDateMessage],
];
(async () => {
  for (const [birth, today, error] of cases)
    assert.equal(age.birthDateError(birth, today), error);
  assert.equal(
    age.birthDateError(null, "2026-10-15"),
    age.invalidBirthDateMessage,
  );
  assert.equal(
    age.accountToday(new Date("2026-10-16T04:59:59Z")),
    "2026-10-15",
  );
  assert.equal(
    age.accountToday(new Date("2026-10-16T05:00:00Z")),
    "2026-10-16",
  );
  assert.equal(age.latestAdultBirthDate("2044-02-29"), "2026-02-28");
  const pg = new PGlite();
  try {
    await pg.exec(
      "create role anon;create role authenticated;create role supabase_auth_admin;",
    );
    const sql = fs.readFileSync("supabase/account_adult_signup.sql", "utf8");
    await pg.exec(sql);
    await pg.exec(sql);
    for (const [birth, today, error] of cases) {
      const result = await pg.query(
        "select public.account_birth_date_error($1,$2::date) error",
        [birth, today],
      );
      assert.equal(result.rows[0].error, error || null);
    }
    const event = (birth) =>
      JSON.stringify({
        user: {
          user_metadata: birth === undefined ? {} : { birth_date: birth },
        },
      });
    await pg.exec("set role supabase_auth_admin;");
    const deny = await pg.query(
      "select public.hook_mercau_adult_signup($1::jsonb) result",
      [event(undefined)],
    );
    assert.equal(deny.rows[0].result.error.http_code, 403);
    const minor = await pg.query(
      "select public.hook_mercau_adult_signup($1::jsonb) result",
      [event("2020-01-01")],
    );
    assert.equal(minor.rows[0].result.error.message, age.minimumAgeMessage);
    const valid = await pg.query(
      "select public.hook_mercau_adult_signup($1::jsonb) result",
      [event("2000-01-01")],
    );
    assert.deepEqual(valid.rows[0].result, {});
    await pg.exec("reset role;set role anon;");
    await assert.rejects(
      () =>
        pg.query("select public.hook_mercau_adult_signup($1::jsonb)", [
          event("2000-01-01"),
        ]),
      /permission denied/,
    );
    await pg.exec("reset role;set role authenticated;");
    await assert.rejects(
      () =>
        pg.query("select public.hook_mercau_adult_signup($1::jsonb)", [
          event("2000-01-01"),
        ]),
      /permission denied/,
    );
  } finally {
    await pg.close();
  }
  console.log(
    "PASS adult signup: exact eighteenth birthday, minors, future/invalid/leap dates, Bogota midnight, repeated migration, server hook and restricted execution. PostgreSQL local only; no accounts created.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
