const { createClient } = require("@supabase/supabase-js");

const restaurantId = "restaurante-mercado";
const managerEmail = (process.env.PILOT_MANAGER_EMAIL || "").trim().toLowerCase();
const testerEmail = (process.env.PILOT_TESTER_EMAIL || "").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || !managerEmail || !testerEmail) {
  throw new Error("Faltan variables de entorno para autorizar la prueba.");
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUsers(emails) {
  const pending = new Set(emails);
  const found = new Map();
  for (let page = 1; pending.size && page <= 100; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      const email = (user.email || "").toLowerCase();
      if (pending.has(email)) {
        found.set(email, user);
        pending.delete(email);
      }
    }
    if (data.users.length < 1000) break;
  }
  return found;
}

(async () => {
  const users = await findUsers([managerEmail, testerEmail]);
  const manager = users.get(managerEmail);
  const tester = users.get(testerEmail);
  if (!manager) throw new Error(`No existe la cuenta administrativa ${managerEmail}.`);
  if (!tester) throw new Error(`No existe la cuenta de prueba ${testerEmail}.`);

  const managerAccess = await db.from("pilot_restaurant_members").select("role")
    .eq("restaurant_id", restaurantId).eq("user_id", manager.id).maybeSingle();
  if (managerAccess.error) throw managerAccess.error;
  if (managerAccess.data?.role !== "manager") {
    throw new Error("La cuenta administrativa no tiene rol manager. No se modificó su acceso.");
  }

  const { error: testerError } = await db.from("pilot_restaurant_members").upsert({
    restaurant_id: restaurantId,
    user_id: tester.id,
    role: "tester",
  }, { onConflict: "restaurant_id,user_id" });
  if (testerError) throw testerError;

  const verification = await db.from("pilot_restaurant_members").select("user_id,role")
    .eq("restaurant_id", restaurantId).in("user_id", [manager.id, tester.id]);
  if (verification.error) throw verification.error;
  const roles = new Map((verification.data || []).map((row) => [row.user_id, row.role]));
  if (roles.get(manager.id) !== "manager" || roles.get(tester.id) !== "tester") {
    throw new Error("La verificación final de permisos no coincidió.");
  }
  console.log("Accesos verificados: administrador=manager, comprador=tester.");
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
