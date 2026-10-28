const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.MERCAU_VERIFY_URL || 'https://www.mercau.co';
const label = process.env.MERCAU_VERIFY_LABEL || 'production';
const origin = 'https://www.mercau.co';
async function request(path, options = {}) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(45000), ...options });
  return response;
}
(async () => {
  const response = await request('/api/negocios');
  assert.equal(response.status, 200);
  const { businesses } = await response.json();
  assert(businesses.length > 0);
  assert(businesses.every(b => b.publicSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.publicSlug)));
  assert.equal(new Set(businesses.map(b => b.publicSlug)).size, businesses.length);
  const ids = ['recGLMhJYXTRE46st', 'rece62hjPb3DM0l8P', 'recbnxV3UMB9u0ZyI'];
  const selected = ids.map(id => businesses.find(b => b.id === id));
  assert(selected.every(Boolean));
  for (const business of selected) {
    const old = await request(`/negocios/${business.id}`, { redirect: 'manual' });
    assert.equal(old.status, 308, `Old listing: ${business.name}`);
    assert.equal(new URL(old.headers.get('location'), base).pathname, `/negocios/${business.publicSlug}`);
    const named = await request(`/negocios/${business.publicSlug}`);
    assert.equal(named.status, 200, `Named listing: ${business.name}`);
    if (business.hasCatalog) {
      const oldCatalog = await request(`/negocios/${business.id}/catalogo`, { redirect: 'manual' });
      assert.equal(oldCatalog.status, 308, `Old catalog: ${business.name}`);
      assert.equal(new URL(oldCatalog.headers.get('location'), base).pathname, `/negocios/${business.publicSlug}/catalogo`);
      const namedCatalog = await request(`/negocios/${business.publicSlug}/catalogo`);
      assert.equal(namedCatalog.status, 200, `Named catalog: ${business.name}`);
    }
  }
  const sitemap = await request('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  const sitemapText = await sitemap.text();
  for (const b of businesses) assert(sitemapText.includes(`${origin}/negocios/${b.publicSlug}`));

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const business = selected[0];
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      await page.route('**/api/metricas', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      await page.goto(`${base}/negocios/${business.id}`);
      await page.getByRole('heading', { name: business.name, exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, `/negocios/${business.publicSlug}`);
      assert.equal(await page.title(), `${business.name} | Mercáu`);
      const canonical = `${origin}/negocios/${business.publicSlug}`;
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), `${business.name} | Mercáu`);
      assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical);
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
      assert(ogImage.includes(`/api/negocios/${business.id}/foto`));
      const photo = await fetch(ogImage, { signal: AbortSignal.timeout(30000) });
      assert.equal(photo.status, 200); assert(photo.headers.get('content-type').startsWith('image/'));
      const share = new URL(await page.getByRole('link', { name: 'Compartir por WhatsApp' }).getAttribute('href'));
      assert(share.searchParams.get('text').includes(business.name));
      assert(share.searchParams.get('text').includes(canonical));
      assert(!share.searchParams.get('text').includes(business.id));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `business-named-${label}-${width}.png`, fullPage: true });
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 950 } });
    let menuId = '';
    await page.route('**/api/metricas', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/piloto/restaurante*', async route => {
      assert.equal(route.request().method(), 'GET', 'No order creation is allowed in this check');
      menuId = new URL(route.request().url()).searchParams.get('restaurant') || '';
      await route.continue();
    });
    const live = selected[1];
    await page.goto(`${base}/negocios/${live.id}/catalogo`);
    await page.getByRole('heading', { name: live.name, exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('button').length > 0);
    await page.getByRole('button', { name: /^Agregar / }).first().waitFor();
    assert.equal(menuId, live.id, 'Ordering uses original business ID, not slug');
    assert.equal(await page.getByRole('link', { name: 'Volver a la ficha' }).getAttribute('href'), `/negocios/${live.publicSlug}`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `business-named-catalog-${label}-390.png`, fullPage: true });
    await page.close();
  } finally { await browser.close(); }
  console.log(JSON.stringify({ checked: base, businesses: businesses.length, uniqueNamedUrls: businesses.length, verifiedListings: selected.map(b => b.publicSlug), oldLinks: '308', catalogs: '200 and original ordering ID', metadataAndImage: 'ok', whatsappShareLink: 'ok', mobileDesktop: 'ok', sitemap: 'ok', realOrdersCreated: 0 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
