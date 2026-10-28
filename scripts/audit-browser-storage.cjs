const {
  chromium,
} = require("C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const context = await browser.newContext();
    const page = await context.newPage(),
      hosts = new Set(),
      blocked = [];
    page.on("request", (request) => hosts.add(new URL(request.url()).hostname));
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        const url = new URL(request.url());
        blocked.push({
          method: request.method(),
          host: url.hostname,
          path: url.pathname,
        });
        return route.fulfill({ status: 204, body: "" });
      }
      return route.continue();
    });
    const response = await page.goto("https://www.mercau.co/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(5000);
    console.log(
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          status: response.status(),
          pageTitle: await page.title(),
          hosts: [...hosts].sort(),
          cookies: (await context.cookies()).map(
            ({ name, domain, expires, httpOnly, secure }) => ({
              name,
              domain,
              expires,
              httpOnly,
              secure,
            }),
          ),
          storage: await page.evaluate(() => ({
            localStorage: Object.keys(localStorage),
            sessionStorage: Object.keys(sessionStorage),
          })),
          blockedMutations: blocked,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
