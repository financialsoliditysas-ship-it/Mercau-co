const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.MERCAU_VERIFY_URL || 'http://localhost:3039';
function load(file, mocks = {}) {
  const mod = new Module(file);
  mod.require = id => id in mocks ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, file + '.cjs');
  return mod.exports;
}
const urls = load('lib/business-public-url.ts');
const business = {
  id: 'recGLMhJYXTRE46st', publicSlug: 'financial-solidity-sas', name: 'Financial Solidity sas',
  category: 'Profesionales y servicios', municipality: 'Nechí', neighborhood: 'Centro',
  description: 'Servicios contables. Datos de prueba local, sin publicaciones.',
  whatsapp: '3147637745', status: 'Publicado', hours: 'Consultar', source: 'test',
  photoUrl: '/logo-mercau.png', photoKind: 'logo', hasCatalog: true, tags: []
};
const Link = { default: ({ children, ...props }) => React.createElement('a', props, children) };
const photo = load('components/BusinessImage.tsx');
const catalogPhoto = load('components/CatalogProductImage.tsx');
const publicCatalog = load('components/PublicCatalog.tsx', { './CatalogProductImage': catalogPhoto });
const common = {
  'next/link': Link, 'next/navigation': { notFound() { throw Error('NOT_FOUND'); }, permanentRedirect() { throw Error('Unexpected redirect'); } },
  '@/lib/public-business': { loadPublicBusiness: async () => business }, '@/lib/business-public-url': urls,
  '@/components/BusinessImage': photo, '@/components/BusinessLocation': { default: () => null },
  '@/components/PilotBusinessNotice': { default: () => null },
  '@/lib/catalog-availability': { catalogBusinessIds: async ids => new Set(ids) }, '@/lib/catalog-validation': { catalogLabel: () => 'Ver catálogo', catalogNoun: () => 'Catálogo' }
};
const listing = load('app/negocios/[id]/page.tsx', common);
const catalog = load('app/negocios/[id]/catalogo/page.tsx', {
  ...common, '@/lib/business-catalog': { publicCatalog: async id => { assert.equal(id, business.id); return { products: [] }; } },
  '@/lib/restaurant-pilot': { pilotRestaurant: async id => { assert.equal(id, business.id); return { is_live: false }; } },
  '@/components/PublicCatalog': publicCatalog, '@/components/RestaurantPilot': { default: () => null },
  '@/components/BackToMyCatalog': { default: () => null }
});

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.sharedBusiness = data; } });
      });
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(path === '/api/negocios' ? { businesses: [business] } : {}) });
      });
      await page.goto(base);
      const ficha = page.getByRole('link', { name: 'Ver ficha completa' });
      await ficha.waitFor(); assert.equal(await ficha.getAttribute('href'), urls.businessPath(business));
      await page.getByRole('button', { name: `Ver ficha de ${business.name}` }).click();
      await page.getByRole('button', { name: 'Compartir', exact: true }).click();
      const shared = await page.evaluate(() => window.sharedBusiness);
      assert.equal(shared.title, business.name); assert.equal(shared.url, urls.businessPublicUrl(business));
      assert(!shared.text.includes('localhost')); assert(!shared.text.includes(business.id));
      assert.equal(await page.getByRole('link', { name: 'Ver catálogo', exact: true }).getAttribute('href'), urls.businessCatalogPath(business));

      const css = await page.locator('link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(node => node.href));
      const shell = html => `<html><head><meta charset="utf-8"><base href="${base}">${css.map(url => `<link rel="stylesheet" href="${url}">`).join('')}</head><body>${html}</body></html>`;
      await page.setContent(shell(renderToStaticMarkup(await listing.default({ params: { id: business.publicSlug } }))));
      await page.getByRole('img', { name: `Logo de ${business.name}` }).scrollIntoViewIfNeeded();
      await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0));
      const whatsapp = page.getByRole('link', { name: 'Compartir por WhatsApp' });
      assert.equal(new URL(await whatsapp.getAttribute('href')).searchParams.get('text'), urls.businessShareMessage(business));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `business-named-page-${width}.png`, fullPage: true });
      await page.setContent(shell(renderToStaticMarkup(await catalog.default({ params: { id: business.publicSlug } }))));
      assert.equal(await page.getByRole('link', { name: 'Volver a la ficha' }).getAttribute('href'), urls.businessPath(business));
      assert(await page.getByText('Este negocio aún no ha publicado productos', { exact: false }).isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `business-named-catalog-empty-${width}.png`, fullPage: true });
      await page.close();
    }
    console.log('PASS 320/390/1440: actual directory JS uses named listing/catalog links and canonical share URL; listing WhatsApp message and logo render; empty catalog links back correctly, no horizontal overflow. Isolated browser, mocked data, no real messages or orders.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
