const assert = require("node:assert/strict");
const {
  chromium,
} = require("C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const base = process.env.TEST_BASE_URL || "http://localhost:3044";

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${base}/negocios/registro`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", {
    name: "Tu negocio merece una vitrina digital",
  }).waitFor();
  await page.getByRole("button", { name: "Crear cuenta" }).waitFor();
  assert.equal(await page.getByText("¿Cómo quieres usar Mercáu?").count(), 0);
  assert.equal(await page.getByText("Soy comprador", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Crear cuenta" }).count(), 1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert(overflow <= 1, `La vista móvil desborda ${overflow}px`);
  await page.screenshot({
    path: "outputs/business-registration-mobile.png",
    fullPage: true,
  });

  await page.goto(`${base}/mi-cuenta?next=inscribir-negocio`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL(`${base}/negocios/registro`);
  assert.equal(new URL(page.url()).pathname, "/negocios/registro");

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto(`${base}/negocios/registro`, { waitUntil: "domcontentloaded" });
  await desktop.getByRole("heading", {
    name: "Tu negocio merece una vitrina digital",
  }).waitFor();
  const desktopOverflow = await desktop.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert(desktopOverflow <= 1, `La vista de computador desborda ${desktopOverflow}px`);
  await desktop.screenshot({
    path: "outputs/business-registration-desktop.png",
    fullPage: true,
  });

  await browser.close();
  console.log("Business registration UI: mobile, desktop and legacy redirect OK");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
