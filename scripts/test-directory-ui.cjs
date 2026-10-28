const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const businesses = Array.from({ length: 8 }, (_, index) => ({
  id: `rec-test-${index + 1}`,
  name: index === 0 ? 'Restaurante con un nombre suficientemente largo' : `Negocio local ${index + 1}`,
  category: index % 2 === 0 ? 'Comidas y bebidas' : 'Moda y accesorios',
  municipality: 'Nechí',
  neighborhood: index % 2 ? 'Centro' : 'Las Palmas',
  description: 'Negocio simulado para verificar la interfaz responsive.',
  hours: '8:00 a. m. a 6:00 p. m.',
  whatsapp: '3000000000',
  status: index === 1 ? 'Destacado' : 'Publicado',
  source: 'test',
  hasCatalog: true,
  catalogItemCount: 4,
  commercialSearchTerms: ['producto de prueba'],
}));

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const viewport of [{ width: 320, height: 900 }, { width: 1440, height: 1000 }]) {
      const page = await browser.newPage({ viewport });
      await page.route('**/api/negocios', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ businesses }) }));
      await page.route('**/api/metricas', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      await page.goto(process.env.TEST_BASE_URL || 'http://localhost:3045/', { waitUntil: 'networkidle' });
      const cards = page.locator('#directorio article');
      await cards.first().waitFor();
      assert.equal(await cards.count(), 8);
      const boxes = await cards.evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) }; }));
      if (viewport.width === 320) {
        assert.equal(boxes[0].y, boxes[1].y, 'En móvil deben aparecer dos fichas en la primera fila.');
        assert.notEqual(boxes[0].x, boxes[1].x, 'Las dos fichas móviles no deben superponerse.');
      } else {
        assert.equal(new Set(boxes.slice(0, 4).map(box => box.y)).size, 1, 'En escritorio ancho deben aparecer cuatro fichas por fila.');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(overflow, false, `No debe existir desbordamiento horizontal a ${viewport.width}px.`);
      assert.equal(await page.getByText('Ver menú', { exact: true }).count() > 0, true);
      assert.equal(await page.getByText('Ver catálogo', { exact: true }).count() > 0, true);
      await page.screenshot({ path: path.join('outputs', `directory-responsive-${viewport.width}.png`), fullPage: true });
      await page.close();
    }
    console.log('PASS directory UI at 320px and 1440px. Screenshots saved in outputs.');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exit(1); });
