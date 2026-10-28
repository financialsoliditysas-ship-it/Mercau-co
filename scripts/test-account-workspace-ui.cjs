const assert = require("node:assert/strict");
const path = require("node:path");
const {
  chromium,
} = require("C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const base = "http://localhost:3041",
  uid = "11111111-1111-4111-8111-111111111111",
  bid = "recGLMhJYXTRE46st";
const profile = {
  name: "Cuenta de prueba",
  phone: "+573000000000",
  whatsapp: "",
  municipality: "Nechí",
  neighborhood: "Centro",
  address: "",
  instructions: "",
  addresses: [],
  notifications: { orders: true, deliveries: true, marketing: false },
};
const user = {
  id: uid,
  email: "local@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: "2026-01-01",
  created_at: "2026-01-01",
  app_metadata: { provider: "email" },
  user_metadata: { delivery_profile: profile },
};
const enc = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), iss: "https://mercau-account-test.supabase.co/auth/v1" })}.local-test`;
const session = {
  access_token: token,
  refresh_token: "local-only",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const business = {
  id: bid,
  name: "Negocio de prueba local",
  category: "Comidas y bebidas",
  municipality: "Nechí",
  neighborhood: "Sector de prueba",
  description: "Datos simulados. No se publican ni generan pedidos.",
  hours: "5 p. m. a 10 p. m.",
  whatsapp: "3000000000",
  status: "Publicado",
  photoUrl: "/demo-burger.jpg",
  photoKind: "photo",
  photoVersion: "test",
  source: "test",
  publicSlug: "negocio-de-prueba-local",
};
let settings = {},
  version = 0,
  patches = [],
  uploads = 0,
  recoveries = 0,
  expired = false;
async function fixtures(page, authenticated) {
  const remoteFavorites = [];
  let galleryPhotos = [];
  if (authenticated)
    await page.addInitScript(
      ({ session }) => {
        if (localStorage.getItem("local-test-initialized")) return;
        localStorage.setItem("local-test-initialized", "yes");
        localStorage.setItem(
          "sb-mercau-account-test-auth-token",
          JSON.stringify(session),
        );
        localStorage.setItem(
          "mercau.favorites.guest.v2",
          JSON.stringify(["recGLMhJYXTRE46st"]),
        );
      },
      { session },
    );
  await page.route(
    "https://mercau-account-test.supabase.co/**",
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/signup"))
        throw new Error(
          "Registration must remain blocked without approved legal documents",
        );
      if (url.pathname.includes("/recover")) recoveries++;
      if (url.pathname.includes("/rest/v1/favorites")) {
        const request = route.request();
        if (request.method() === "POST")
          for (const row of [request.postDataJSON()].flat()) {
            if (
              !remoteFavorites.some(
                (f) =>
                  f.user_id === row.user_id &&
                  f.business_id === row.business_id,
              )
            )
              remoteFavorites.push({
                ...row,
                created_at: new Date().toISOString(),
              });
          }
        if (request.method() === "DELETE") {
          const id = url.searchParams.get("business_id")?.replace(/^eq\./, "");
          const index = remoteFavorites.findIndex((f) => f.business_id === id);
          if (index >= 0) remoteFavorites.splice(index, 1);
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(remoteFavorites),
        });
        return;
      }
      const body = url.pathname.includes("/user")
        ? user
        : url.pathname.includes("/token")
          ? session
          : url.pathname.includes("/rest/v1/favorites")
            ? []
            : {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(body),
      });
    },
  );
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname;
    let body = {},
      status = 200;
    if (p === "/api/negocios") body = { businesses: [business] };
    else if (p === "/api/mi-cuenta") {
      if (expired) {
        status = 401;
        body = { error: "expired" };
      } else if (req.method() === "PATCH") {
        const payload = req.postDataJSON();
        patches.push(payload);
        Object.assign(profile, payload.profile);
        body = { ok: true, version: 1 };
      } else
        body = {
          profile,
          version: 0,
          roles: ["buyer", "business_owner"],
          businesses: [
            {
              business_id: bid,
              business_name: business.name,
              status: "Activo",
            },
          ],
        };
    } else if (p === "/api/mi-cuenta/envios") body = { deliveries: [] };
    else if (p === "/api/mi-cuenta/pedidos") body = { orders: [] };
    else if (p === "/api/mi-cuenta/notificaciones")
      body = { notifications: [] };
    else if (p === `/api/mi-cuenta/negocio/${bid}`) {
      if (req.method() === "PATCH") {
        const payload = req.postDataJSON();
        patches.push(payload);
        settings = payload.settings;
        body = { ok: true, version: ++version };
      } else body = { business, settings, version, status: "Publicada" };
    } else if (p === `/api/mi-cuenta/negocio/${bid}/actividad`)
      body = {
        measuredSince: null,
        summary: { views: 0, whatsapp: 0, calls: 0 },
        favorites: 0,
        requestsCount: 0,
        requests: [],
      };
    else if (p === `/api/mi-negocio/${bid}/galeria`) {
      if (req.method() === "POST") {
        const payload = req.postDataJSON();
        assert(payload.file.length > 0);
        galleryPhotos.push({
          id: "attGalleryLocal",
          kind: payload.kind,
          url: "/demo-burger.jpg",
          hidden: false,
        });
      }
      if (req.method() === "PATCH")
        galleryPhotos = galleryPhotos.map((photo) => ({
          ...photo,
          hidden: req.postDataJSON().hidden,
        }));
      body = { photos: galleryPhotos, limit: 8 };
    } else if (p === `/api/mi-negocio/${bid}/foto`) {
      assert.equal(req.method(), "POST");
      assert(req.postDataJSON().file.length > 0);
      uploads++;
      body = {
        photoUrl: "/demo-burger.jpg",
        photoKind: "logo",
        photoVersion: "new-test",
      };
    } else if (p === `/api/mi-negocio/${bid}`)
      body = { business, version: "a".repeat(64) };
    else if (p === "/api/inscripciones") {
      const submitted = req.postDataJSON();
      assert.equal(submitted.businessName, "Negocio ficticio local");
      assert.equal(submitted.category, "Comidas y bebidas");
      body = {
        linked: true,
        message: "Inscripción recibida y vinculada a tu cuenta.",
      };
    } else if (p === "/api/piloto/restaurante") {
      status = 403;
      body = { error: "Test account has no pilot dispatch access" };
    } else if (req.method() !== "GET" && p !== "/api/metricas")
      throw new Error("Unexpected mutation: " + p);
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
async function chooseBusinessSection(page, label) {
  const menu = page.getByLabel("Sección de mi negocio", { exact: true });
  if (await menu.isVisible()) await menu.selectOption({ label });
  else await page.getByRole("button", { name: label, exact: true }).click();
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    for (const width of [320, 390, 768, 1440]) {
      settings = {};
      version = 0;
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      page.setDefaultTimeout(45000);
      await fixtures(page, false);
      await page.goto(base + "/mi-cuenta");
      await page
        .getByRole("heading", { name: "Qué bueno verte de nuevo" })
        .waitFor();
      await page
        .getByLabel("Contraseña", { exact: true })
        .fill("LocalPassword123");
      await page
        .getByRole("button", { name: "Mostrar contraseña", exact: true })
        .click();
      assert.equal(
        await page
          .getByLabel("Contraseña", { exact: true })
          .getAttribute("type"),
        "text",
      );
      await page.screenshot({
        path: `account-v2-login-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Crear cuenta", exact: true })
        .click();
      await page
        .getByRole("radio", { name: "Soy comprador", exact: false })
        .check();
      assert.equal(
        await page.getByLabel("Teléfono o WhatsApp", { exact: true }).count(),
        1,
      );
      assert.equal(
        await page.getByLabel("Dirección de entrega", { exact: true }).count(),
        0,
      );
      await page
        .getByLabel("Nombre completo", { exact: true })
        .fill("Registro de prueba local");
      await page.getByLabel('Fecha de nacimiento',{exact:true}).fill('2020-01-01');
      await page.getByRole('alert').filter({hasText:'18 años cumplidos'}).waitFor();
      await page.getByLabel('Fecha de nacimiento',{exact:true}).fill('2000-01-01');
      await page
        .getByLabel("Teléfono o WhatsApp", { exact: true })
        .fill("3000000000");
      await page
        .getByLabel("Correo electrónico", { exact: true })
        .fill("local@example.invalid");
      await page
        .getByLabel("Contraseña", { exact: true })
        .fill("LocalPassword123");
      await page.getByLabel("Barrio o sector", { exact: true }).fill("Centro");
      await page
        .getByRole("radio", { name: "Soy dueño de negocio", exact: false })
        .check();
      for (const checkbox of await page.getByRole("checkbox").all())
        await checkbox.check();
      await page
        .getByRole("button", { name: "Crear mi cuenta", exact: true })
        .click();
      await page
        .getByText(
          "El nuevo registro está pendiente de los documentos legales",
          { exact: false },
        )
        .waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `account-v2-register-${width}.png`,
        fullPage: true,
      });
      if (width === 390) {
        await page
          .getByRole("button", { name: "Olvidé mi contraseña", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Enviar instrucciones", exact: true })
          .click();
        await page
          .getByText("Si existe una cuenta con este correo", { exact: false })
          .waitFor();
        assert.equal(recoveries, 1);
        await page
          .getByRole("button", { name: "Volver a entrar", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Entrar a Mercáu", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Hola, Cuenta", exact: true })
          .waitFor();
      }
      await page.close();

      const buyer = await browser.newPage({
        viewport: { width, height: 1000 },
      });
      buyer.setDefaultTimeout(45000);
      await fixtures(buyer, true);
      await buyer.goto(base + "/mi-cuenta/comprador");
      await buyer
        .getByRole("heading", { name: "Hola, Cuenta", exact: true })
        .waitFor();
      assert(
        await buyer
          .getByRole("link", { name: "Solicitar envío", exact: true })
          .first()
          .isVisible(),
      );
      assert(
        await buyer.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await buyer.screenshot({
        path: `account-v2-buyer-${width}.png`,
        fullPage: true,
      });
      if (width < 768)
        await buyer
          .getByRole("button", { name: "Abrir menú de mi cuenta" })
          .click();
      await buyer
        .getByLabel("Estoy usando Mercáu como:")
        .selectOption("business_owner");
      await buyer
        .getByRole("heading", { name: "Panel de mi negocio", exact: true })
        .waitFor();
      await buyer
        .getByRole("heading", { name: business.name, exact: true })
        .waitFor();
      assert(
        await buyer.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await buyer.screenshot({
        path: `account-v2-business-${width}.png`,
        fullPage: true,
      });
      await chooseBusinessSection(buyer, "Horarios");
      await buyer
        .getByRole("checkbox", { name: "Cerrado", exact: true })
        .first()
        .uncheck();
      await buyer.getByLabel("Apertura Lunes 1").fill("11:00");
      await buyer.getByLabel("Cierre Lunes 1").fill("14:00");
      await buyer
        .getByRole("button", { name: "Agregar segundo horario", exact: true })
        .click();
      if (width === 390) {
        await buyer
          .getByRole("button", { name: "Agregar fecha especial", exact: true })
          .click();
        await buyer
          .getByLabel("Fecha especial 1", { exact: true })
          .fill("2026-12-24");
      }
      await buyer
        .getByRole("button", { name: "Guardar horarios", exact: true })
        .click();
      await buyer
        .getByText("Configuración guardada.", { exact: true })
        .waitFor();
      assert.equal(settings.schedule[0].periods.length, 2);
      await chooseBusinessSection(buyer, "Entregas");
      await buyer
        .getByLabel("Modalidad", { exact: true })
        .selectOption("mercau");
      await buyer
        .getByRole("checkbox", { name: "Disponible para recogidas con Mercáu" })
        .check();
      await buyer
        .getByRole("button", { name: "Guardar entregas", exact: true })
        .click();
      await buyer
        .getByText("Configuración guardada.", { exact: true })
        .waitFor();
      assert.equal(settings.logistics.mode, "mercau");
      await chooseBusinessSection(buyer, "Estadísticas");
      await buyer
        .getByText("Todavía no hay eventos medidos", { exact: false })
        .waitFor();
      assert.equal(
        await buyer.getByText("Términos de búsqueda", { exact: true }).count(),
        0,
      );
      if (width === 390) {
        await chooseBusinessSection(buyer, "Fotos y logo");
        await buyer
          .getByLabel("Seleccionar imagen", { exact: true })
          .setInputFiles(path.resolve("public/logo-mercau.png"));
        await buyer
          .getByRole("button", { name: "Guardar imagen", exact: true })
          .waitFor();
        await buyer
          .getByRole("button", { name: "Guardar imagen", exact: true })
          .click();
        await buyer.waitForTimeout(500);
        assert.equal(uploads, 1);
        await buyer
          .getByLabel("Seleccionar foto adicional", { exact: true })
          .setInputFiles(path.resolve("public/demo-burger.jpg"));
        await buyer
          .getByRole("button", { name: "Guardar foto adicional", exact: true })
          .click();
        await buyer
          .getByRole("button", { name: "Ocultar", exact: true })
          .click();
        await buyer
          .getByRole("button", { name: "Mostrar", exact: true })
          .waitFor();
        await buyer.goto(base + "/mi-cuenta/favoritos");
        await buyer
          .getByRole("button", { name: `Quitar ${business.name} de favoritos` })
          .waitFor();
        await buyer
          .getByRole("button", { name: `Quitar ${business.name} de favoritos` })
          .click();
        await buyer.reload();
        await buyer
          .getByRole("heading", {
            name: "Aún no tienes actividad en Mercáu.",
            exact: true,
          })
          .waitFor();
        await buyer.goto(base + "/mi-cuenta/inscribir-negocio");
        await buyer
          .getByLabel("Nombre del negocio", { exact: true })
          .fill("Negocio ficticio local");
        await buyer
          .getByLabel("Nombre del propietario / administrador", { exact: true })
          .fill("Persona local");
        await buyer.getByLabel("WhatsApp", { exact: true }).fill("3000000000");
        await buyer
          .getByLabel("Categoría principal", { exact: true })
          .selectOption("Comidas y bebidas");
        await buyer
          .getByLabel("Municipio", { exact: true })
          .selectOption("Nechí");
        await buyer
          .getByLabel("Descripción corta del negocio", { exact: true })
          .fill("Descripción ficticia para probar el formulario.");
        await buyer
          .getByRole("button", { name: "Continuar", exact: true })
          .click();
        await buyer
          .getByLabel("Etiquetas o servicios", { exact: true })
          .fill("Prueba");
        await buyer
          .getByRole("button", { name: "Continuar", exact: true })
          .click();
        await buyer
          .getByRole("button", {
            name: "Enviar inscripción para revisión",
            exact: true,
          })
          .click();
        await buyer
          .getByText("Inscripción recibida y vinculada a tu cuenta.", {
            exact: false,
          })
          .waitFor();
      }
      await buyer.goto(base + "/mi-cuenta/perfil");
      await buyer
        .getByRole("heading", { name: "Tus datos, a tu manera" })
        .waitFor();
      assert.equal(
        await buyer
          .getByLabel("Dirección principal (opcional)", { exact: true })
          .getAttribute("required"),
        null,
      );
      await buyer
        .getByLabel("Barrio o sector", { exact: true })
        .fill("Sector actualizado");
      await buyer
        .getByRole("button", { name: "Guardar mis datos", exact: true })
        .click();
      await buyer
        .getByText("Tus datos quedaron guardados.", { exact: true })
        .waitFor();
      assert(
        await buyer.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await buyer.screenshot({
        path: `account-v2-profile-${width}.png`,
        fullPage: true,
      });
      await buyer.close();
    }
    const expiredPage = await browser.newPage();
    await fixtures(expiredPage, true);
    expired = true;
    await expiredPage.goto(base + "/mi-cuenta/comprador");
    await expiredPage
      .getByText("Tu sesión terminó. Entra nuevamente.", { exact: true })
      .waitFor();
    assert.equal(
      await expiredPage
        .getByRole("heading", { name: "Hola, Cuenta", exact: true })
        .count(),
      0,
    );
    await expiredPage.close();
    console.log(
      "PASS isolated browser 320/390/768/1440: login, password visibility, both registration intents, legal gate, buyer/owner switch, profile edit, optional address, schedule split, logistics, empty metrics, photo upload fixture, expired session. API/Auth mocked; no production writes, emails, orders or Shipday dispatch.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
