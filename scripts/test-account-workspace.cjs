const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
function load(file, mocks = {}) {
  const mod = new Module(file);
  mod.require = (id) => (id in mocks ? mocks[id] : require(id));
  mod._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    file + ".cjs",
  );
  return mod.exports;
}
const data = load("data/directory.ts");
const model = load("lib/account-model.ts", { "@/data/directory": data });
const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  bid = "recGLMhJYXTRE46st",
  foreign = "rec00000000000002";
const profile = {
  ...model.emptyAccountProfile,
  name: "Prueba local",
  municipality: "Nechí",
  phone: "3147637745",
};
let user = {
  id: uid,
  email_confirmed_at: "2026-01-01",
  user_metadata: {
    role: "admin",
    account_intent: "business",
    delivery_profile: profile,
  },
};
const tables = {
  account_profiles: [],
  account_roles: [{ user_id: uid, role: "business_owner" }],
  business_admins: [
    {
      user_id: other,
      business_id: foreign,
      business_name: "Otro negocio",
      status: "Activo",
      private_token: "never-return",
    },
  ],
  account_notifications: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      user_id: other,
      title: "Otra cuenta",
      body: "privado",
    },
  ],
  favorites: [],
  business_daily_activity: [],
  delivery_orders: [
    {
      customer_user_id: uid,
      public_id: "MCU-000001",
      created_at: new Date().toISOString(),
      pickup_business_id: bid,
      status: "assigned",
      service_type: "Recoger una compra",
      customer_name: "Prueba Local",
      delivery_address: "direccion privada",
      delivery_phone: "3100000000",
      delivery_neighborhood: "Centro",
      description: "Compra",
      notes: "private notes",
    },
    {
      customer_user_id: other,
      public_id: "MCU-000002",
      created_at: new Date().toISOString(),
      pickup_business_id: foreign,
      status: "assigned",
    },
  ],
};
const db = {
  auth: {
    getUser: async (token) => ({
      data: { user: token === "valid" ? user : null },
      error: token !== "valid",
    }),
  },
  from(table) {
    let columns = "*",
      filters = [],
      head = false,
      limit = Infinity,
      change = null;
    const result = () => {
      let rows = (tables[table] || []).filter((row) =>
        filters.every((f) => f(row)),
      );
      const count = rows.length;
      rows = rows.slice(0, limit);
      if (change) rows.forEach((row) => Object.assign(row, change));
      if (columns !== "*")
        rows = rows.map((row) =>
          Object.fromEntries(columns.split(",").map((k) => [k, row[k]])),
        );
      return { data: head ? null : rows, error: null, count };
    };
    const query = {
      select(c = "*", options = {}) {
        columns = c;
        head = options.head;
        return query;
      },
      eq(k, v) {
        filters.push((row) => row[k] === v);
        return query;
      },
      gte(k, v) {
        filters.push((row) => row[k] >= v);
        return query;
      },
      order() {
        return query;
      },
      limit(n) {
        limit = n;
        return query;
      },
      update(value) {
        change = value;
        return query;
      },
      maybeSingle: async () => ({
        ...result(),
        data: result().data?.[0] || null,
      }),
      then(resolve, reject) {
        return Promise.resolve(result()).then(resolve, reject);
      },
    };
    return query;
  },
  rpc: async (name, args) => ({ data: args.p_version + 1, error: null }),
};
const admin = { getSupabaseAdminClient: () => db };
let businessStatus = "Publicado";
const server = load("lib/account-server.ts", {
  "./supabase-admin": admin,
  "@/app/api/actualizaciones/[token]/route": {
    GET: async (_request, { params }) =>
      Response.json({
        business: {
          id: params.token === "owned-private" ? bid : foreign,
          status: businessStatus,
        },
      }),
  },
});
const mocks = {
  "@/lib/account-server": server,
  "@/lib/account-business-state": load("lib/account-business-state.ts"),
  "@/lib/supabase-admin": admin,
  "@/lib/account-model": model,
  "@/data/directory": data,
  "@/lib/airtable-directory": {
    loadDirectoryBusiness: async (id) => ({ id, name: "Test" }),
  },
};
const account = load("app/api/mi-cuenta/route.ts", mocks),
  deliveries = load("app/api/mi-cuenta/envios/route.ts", mocks),
  notifications = load("app/api/mi-cuenta/notificaciones/route.ts", mocks),
  business = load("app/api/mi-cuenta/negocio/[businessId]/route.ts", mocks),
  activity = load(
    "app/api/mi-cuenta/negocio/[businessId]/actividad/route.ts",
    mocks,
  );
const request = (
  path = "/api/mi-cuenta",
  method = "GET",
  body,
  token = "valid",
) =>
  new Request("http://local.test" + path, {
    method,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        }
      : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
async function sql() {
  const { PGlite } = require("@electric-sql/pglite");
  const pg = new PGlite();
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to service_role;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    grant select,update on auth.users to service_role;
    create table public.business_admins(user_id uuid,business_id text,status text);
    create table public.delivery_orders(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),status text default 'created',public_id text);
    create table public.pilot_food_orders(id uuid primary key default gen_random_uuid(),customer_id uuid,status text,public_id text);
    insert into auth.users values('${uid}','{}'),('${other}','{}');
    insert into business_admins values('${uid}','${bid}','Activo');`);
    const migration = fs.readFileSync("supabase/account_workspace.sql", "utf8");
    await pg.exec(migration);
    await pg.exec(migration);
    const saved = await pg.query(
      "select public.account_save_profile($1,$2::jsonb,0) as v",
      [uid, JSON.stringify(profile)],
    );
    assert.equal(saved.rows[0].v, 1);
    await pg.query(
      "insert into public.delivery_orders(customer_user_id,public_id) values($1,'MCU-000001')",
      [uid],
    );
    await pg.exec(
      "update public.delivery_orders set status='assigned'; update public.delivery_orders set status='assigned';",
    );
    assert.equal(
      (await pg.query("select count(*)::int n from account_notifications"))
        .rows[0].n,
      2,
    );
    await pg.query(
      "insert into pilot_food_orders(customer_id,status,public_id) values($1,'accepted','PRB-000001')",
      [uid],
    );
    assert.equal(
      (await pg.query("select count(*)::int n from account_notifications"))
        .rows[0].n,
      3,
    );
    await pg.query(
      `update account_profiles set data=jsonb_set(data,'{notifications,deliveries}','false') where user_id=$1`,
      [uid],
    );
    await pg.exec("update delivery_orders set status='delivered'");
    assert.equal(
      (await pg.query("select count(*)::int n from account_notifications"))
        .rows[0].n,
      3,
    );
    await assert.rejects(
      () =>
        pg.query("select public.account_save_profile($1,$2::jsonb,0)", [
          uid,
          JSON.stringify(profile),
        ]),
      /VERSION_CONFLICT/,
    );
    assert.equal(
      (
        await pg.query(
          "select raw_user_meta_data->'delivery_profile'->>'name' as n from auth.users where id=$1",
          [uid],
        )
      ).rows[0].n,
      profile.name,
    );
    await pg.query(
      "select public.account_save_business($1,$2,$3::jsonb,0,false)",
      [uid, bid, "{}"],
    );
    await assert.rejects(
      () =>
        pg.query(
          "select public.account_save_business($1,$2,$3::jsonb,0,false)",
          [other, bid, "{}"],
        ),
      /ACCESS_DENIED/,
    );
    await pg.query("select public.record_business_activity($1,$2)", [
      bid,
      "profile_view",
    ]);
    await pg.query("select public.record_business_activity($1,$2)", [
      bid,
      "whatsapp_click",
    ]);
    const metrics = (await pg.query("select * from business_daily_activity"))
      .rows[0];
    assert.equal(metrics.profile_views, 1);
    assert.equal(metrics.whatsapp_clicks, 1);
    assert(!("user_id" in metrics));
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role}`);
      for (const table of [
        "account_profiles",
        "account_roles",
        "business_account_settings",
        "account_notifications",
        "account_audit",
        "business_daily_activity",
      ])
        await assert.rejects(
          () => pg.query(`select * from public.${table}`),
          /permission denied/,
        );
      await assert.rejects(
        () =>
          pg.query("select public.account_save_profile($1,$2::jsonb,0)", [
            uid,
            "{}",
          ]),
        /permission denied/,
      );
      await pg.exec("reset role");
    }
    assert.equal(
      (
        await pg.query(
          "select count(*)::int as n from account_audit where actor_id=$1",
          [uid],
        )
      ).rows[0].n,
      2,
    );
    console.log(
      "PASS SQL: additive migration twice, preserved identities, profile metadata compatibility, version conflicts, owner-only settings, private tables/functions, aggregate metrics, audit. Local PostgreSQL only.",
    );
  } finally {
    await pg.close();
  }
}
(async () => {
  const clean = model.validateAccountProfile(profile);
  assert.equal(clean.address, "");
  assert.equal(clean.phone, "+573147637745");
  assert.equal(clean.notifications.marketing, false);
  assert.throws(() =>
    model.validateAccountProfile({ ...profile, role: "admin" }),
  );
  assert.throws(() =>
    model.validateAccountProfile({ ...profile, municipality: "No existe" }),
  );
  assert.throws(() =>
    model.validateAccountProfile({ ...profile, phone: "bad" }),
  );
  assert.equal(
    (await account.GET(request(undefined, "GET", undefined, ""))).status,
    401,
  );
  assert.equal(
    (await account.GET(request(undefined, "GET", undefined, "invalid"))).status,
    401,
  );
  let response = await account.GET(request());
  let body = await response.json();
  assert.deepEqual(body.roles, ["buyer"]);
  assert.equal(body.businesses.length, 0);
  assert.equal(body.version, 0);
  assert(!JSON.stringify(body).includes("never-return"));
  tables.business_admins.push({
    user_id: uid,
    business_id: bid,
    business_name: "Ficha autorizada",
    status: "Activo",
    private_token: "owned-private",
  });
  body = await (await account.GET(request())).json();
  assert.deepEqual(body.roles, ["buyer", "business_owner"]);
  assert(!JSON.stringify(body).includes("private_token"));
  response = await business.GET(request(), { params: { businessId: bid } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "Publicada");
  tables.business_admins[1].private_token = "wrong-proof";
  response = await business.GET(request(), { params: { businessId: bid } });
  assert.equal(response.status, 403);
  tables.business_admins[1].private_token = "owned-private";
  businessStatus = "Suspendido";
  body = await (
    await business.GET(request(), { params: { businessId: bid } })
  ).json();
  assert.equal(body.editable, false);
  response = await business.PATCH(
    request(undefined, "PATCH", { version: 0, settings: {} }),
    { params: { businessId: bid } },
  );
  assert.equal(response.status, 403);
  businessStatus = "Publicado";
  response = await business.PATCH(
    request(undefined, "PATCH", {
      version: 0,
      settings: {
        specialHours: [
          {
            date: "2026-12-24",
            closed: false,
            periods: [{ start: "18:00", end: "12:00" }],
          },
        ],
      },
    }),
    { params: { businessId: bid } },
  );
  assert.equal(response.status, 400);
  response = await business.PATCH(
    request(undefined, "PATCH", {
      version: 0,
      settings: {
        specialHours: [{ date: "2026-12-24", closed: true, periods: [] }],
      },
    }),
    { params: { businessId: bid } },
  );
  assert.equal(response.status, 200);
  response = await account.PATCH(
    request(undefined, "PATCH", {
      version: 0,
      profile: { ...profile, user_id: other },
    }),
  );
  assert.equal(response.status, 400);
  response = await account.PATCH(
    request(undefined, "PATCH", { version: 0, profile }),
  );
  assert.equal(response.status, 200);
  body = await (await deliveries.GET(request())).json();
  assert.equal(body.deliveries.length, 1);
  assert.equal(body.deliveries[0].statusLabel, "Mensajero asignado");
  assert(!JSON.stringify(body).includes("direccion privada"));
  response = await business.GET(request(), { params: { businessId: foreign } });
  assert.equal(response.status, 403);
  response = await activity.GET(request("/?days=30"), {
    params: { businessId: foreign },
  });
  assert.equal(response.status, 403);
  body = await (
    await activity.GET(request("/?days=30"), { params: { businessId: bid } })
  ).json();
  assert.equal(body.requests[0].phone, "3100000000");
  assert(!JSON.stringify(body).includes("private notes"));
  tables.delivery_orders[0].status = "created";
  body = await (
    await activity.GET(request("/?days=30"), { params: { businessId: bid } })
  ).json();
  assert(!("phone" in body.requests[0]));
  assert(!("address" in body.requests[0]));
  body = await (await notifications.GET(request())).json();
  assert.equal(body.notifications.length, 0);
  const notification = tables.account_notifications[0];
  await notifications.PATCH(
    request(undefined, "PATCH", { id: notification.id }),
  );
  assert(!notification.read_at);
  user = { ...user, email_confirmed_at: null };
  assert.equal((await account.GET(request())).status, 401);
  console.log(
    "PASS API/model: optional buyer address, phone validation, no self-assigned admin/owner, verified JWT, own deliveries/notifications, owner isolation, state-based contact minimization, protected fields. Mocked APIs; no production data.",
  );
  await sql();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
