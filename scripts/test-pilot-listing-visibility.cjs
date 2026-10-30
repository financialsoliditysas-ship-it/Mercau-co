const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks) {
  const mod = new Module(file);
  mod.require = id => id in mocks ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, file + '.cjs');
  return mod.exports;
}
const real = { id: 'real', name: 'Negocio real' };
const pilot = { id: 'demo', name: 'Prueba', pilotRestaurant: 'restaurante-mercado' };
const directory = [real, pilot];
const mocks = {
  '@/lib/airtable-directory': { loadDirectoryBusinesses: async () => directory },
  '@/lib/business-public-links': { withPublicBusinessLinks: async rows => rows },
  '@/lib/catalog-availability': { catalogBusinessAvailability: async ids => {
    assert.deepEqual(ids, ['real']); return new Map();
  } },
  '@/lib/business-public-url': { businessPublicUrl: b => `https://www.mercau.co/negocios/${b.id}` },
};
(async () => {
  const route = load('app/api/negocios/route.ts', mocks);
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).businesses.map(b => b.id), ['real']);
  const sitemap = await load('app/sitemap.ts', mocks).default();
  assert(sitemap.some(row => row.url.endsWith('/real')));
  assert(!sitemap.some(row => row.url.endsWith('/demo')));
  const direct = load('lib/public-business.ts', {
    react: { cache: fn => fn },
    './airtable-directory': { loadDirectoryBusinesses: async () => directory },
    './business-public-links': { withPublicBusinessLinks: async rows => rows },
    './business-public-url': { validBusinessSlug: () => true },
  });
  assert.equal((await direct.loadPublicBusiness('demo')).id, 'demo');
  assert.equal(directory.length, 2);
  console.log('PASS: pilot excluded from listings and sitemap; direct access preserved.');
})().catch(error => { console.error(error); process.exitCode = 1; });
