const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks = {}) {
  const mod = new Module(file);
  mod.require = id => id in mocks ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 }
  }).outputText, file + '.cjs');
  return mod.exports;
}
const urls = load('lib/business-public-url.ts');
const business = {
  id: 'recGLMhJYXTRE46st', name: 'Financial Solidity sas', publicSlug: 'financial-solidity-sas',
  municipality: 'Nechí', category: 'Profesionales y servicios', neighborhood: 'Centro',
  description: 'Servicios contables', whatsapp: '3147637745', photoUrl: '/logo-mercau.png', tags: []
};
const rows = [{ business_id: business.id, slug: business.publicSlug, is_canonical: true }];
let readError = false, rpcError = false, rpcCalls = [];
const db = {
  from() {
    const filters = [];
    const query = {
      select() { return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      then(resolve, reject) { return Promise.resolve({ data: rows.filter(row => filters.every(f => f(row))), error: readError }).then(resolve, reject); },
      async maybeSingle() { return { data: rows.find(row => filters.every(f => f(row))) || null, error: readError }; }
    };
    return query;
  },
  async rpc(name, args) {
    assert.equal(name, 'ensure_business_public_links'); rpcCalls.push(args.p_businesses);
    if (rpcError) return { error: true };
    const data = args.p_businesses.map(item => {
      const row = { business_id: item.business_id, slug: item.base_slug, is_canonical: true };
      rows.push(row); return row;
    });
    return { data };
  }
};
const links = load('lib/business-public-links.ts', {
  './supabase-admin': { getSupabaseAdminClient: () => db }, './business-public-url': urls
});
let directory = [business];
const resolver = load('lib/public-business.ts', {
  react: { cache: fn => fn }, './airtable-directory': { loadDirectoryBusinesses: async () => directory },
  './business-public-links': links, './business-public-url': urls
});
const stub = () => null;
const Link = { default: ({ children, ...props }) => React.createElement('a', props, children) };
const navigation = {
  notFound() { throw new Error('NOT_FOUND'); },
  permanentRedirect(path) { throw new Error('REDIRECT:' + path); }
};
let pageBusiness = business, catalogId, pilotId;
const pageMocks = {
  'next/link': Link, 'next/navigation': navigation,
  '@/lib/public-business': { loadPublicBusiness: async () => pageBusiness }, '@/lib/business-public-url': urls,
  '@/components/BusinessImage': { default: ({ name, photoUrl }) => React.createElement('img', { alt: name, src: photoUrl }) },
  '@/components/BusinessLocation': { default: stub }, '@/components/PilotBusinessNotice': { default: stub },
  '@/components/account/BusinessActivity': { default: stub },
  '@/lib/public-business-settings': { publicBusinessSettings: async()=>null },
  '@/lib/business-gallery': { businessGallery: async()=>[] },
  '@/lib/catalog-availability': { catalogBusinessIds: async ids => new Set(ids) },
  '@/lib/catalog-validation': { catalogLabel: () => 'Ver catálogo', catalogNoun: () => 'Catálogo' }
};
const listing = load('app/negocios/[id]/page.tsx', pageMocks);
const catalog = load('app/negocios/[id]/catalogo/page.tsx', {
  ...pageMocks,
  '@/lib/business-catalog': { publicCatalog: async id => { catalogId = id; return { products: [] }; } },
  '@/lib/restaurant-pilot': { pilotRestaurant: async id => { pilotId = id; return { is_live: true }; } },
  '@/components/PublicCatalog': { default: stub },
  '@/components/CatalogShareActions': { default: ({ catalogUrl }) => React.createElement('span', { 'data-catalog-share': catalogUrl }) },
  '@/components/InstallMercau': { default: stub },
  '@/components/BackToMyCatalog': { default: ({ businessId }) => React.createElement('span', { 'data-owner-business': businessId }) },
  '@/components/RestaurantPilot': { default: ({ restaurantId }) => React.createElement('div', { 'data-restaurant': restaurantId }) }
});

async function sqlTests() {
  const { PGlite } = require('@electric-sql/pglite');
  const pg = new PGlite();
  try {
    await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const sql = fs.readFileSync('supabase/business_public_links.sql', 'utf8');
    await pg.exec(sql);
    await pg.exec(sql);
    const reserve = async values => (await pg.query('select * from public.ensure_business_public_links($1::jsonb)', [JSON.stringify(values)])).rows;
    const item = (number, base = 'mismo-negocio') => ({ business_id: 'rec' + String(number).padStart(14, '0'), base_slug: base, municipality_slug: 'nechi' });
    const results = await reserve([item(1), item(2), item(3)]);
    assert.deepEqual(results.map(row => row.slug), ['mismo-negocio', 'mismo-negocio-nechi', 'mismo-negocio-nechi-rec00000000000003']);
    assert.equal((await reserve([item(1, 'nombre-nuevo')]))[0].slug, 'mismo-negocio');
    assert.equal((await reserve([item(2), item(2)]))[0].slug, 'mismo-negocio-nechi');
    await pg.query("insert into public.business_public_links values ('enlace-anterior', $1, false, now())", [item(1).business_id]);
    assert.equal((await reserve([item(4, 'enlace-anterior')]))[0].slug, 'enlace-anterior-nechi');
    assert.equal((await pg.query('select count(*)::int as n from public.business_public_links where business_id=$1 and is_canonical', [item(1).business_id])).rows[0].n, 1);
    await assert.rejects(() => reserve([{ ...item(5), business_id: 'invalid' }]));
    await assert.rejects(() => reserve([{ ...item(5), base_slug: '../private' }]));
    await pg.exec('set role anon;');
    await assert.rejects(() => pg.query('select * from public.business_public_links'), /permission denied/);
    await assert.rejects(() => reserve([item(6)]), /permission denied/);
    await pg.exec('reset role; set role authenticated;');
    await assert.rejects(() => pg.query('select * from public.business_public_links'), /permission denied/);
    await pg.exec('reset role; set role service_role;');
    assert.equal((await reserve([item(7)]))[0].slug, 'mismo-negocio-nechi-rec00000000000007');
    console.log('PASS SQL on local PostgreSQL: migration twice, collisions, stable names, aliases, uniqueness, validation, anon/authenticated denied, service_role allowed.');
  } finally { await pg.close(); }
}

(async () => {
  assert.equal(urls.businessSlugBase('Al Revés Digital / Nechí'), 'al-reves-digital-nechi');
  assert.equal(urls.businessSlugBase('  A & B, S.A.S. '), 'a-b-s-a-s');
  assert.equal(urls.businessSlugBase('***'), 'negocio');
  assert(urls.businessSlugBase('recGLMhJYXTRE46st').startsWith('negocio-'));
  assert.equal(urls.businessSlugBase('a'.repeat(100)).length, 64);
  assert(!urls.validBusinessSlug('../private')); assert(!urls.validBusinessSlug('CAPITAL')); assert(!urls.validBusinessSlug('a'.repeat(151)));
  assert.equal(urls.businessPath(business), '/negocios/financial-solidity-sas');
  assert.equal(urls.businessCatalogPath(business), '/negocios/financial-solidity-sas/catalogo');
  assert.equal(urls.businessPublicUrl(business), 'https://www.mercau.co/negocios/financial-solidity-sas');
  assert.equal(urls.businessPath({ ...business, publicSlug: undefined }), '/negocios/recGLMhJYXTRE46st');
  assert.equal(urls.businessPath({ ...business, publicSlug: '../private' }), '/negocios/recGLMhJYXTRE46st');
  assert(urls.businessShareMessage(business).startsWith('Financial Solidity sas\n'));

  assert.equal((await links.withPublicBusinessLinks([{ ...business, name: 'Nombre cambiado', publicSlug: undefined }]))[0].publicSlug, business.publicSlug);
  assert.equal(rpcCalls.length, 0);
  const second = { ...business, id: 'rec00000000000001', name: 'Al Revés Digital', publicSlug: undefined };
  assert.equal((await links.withPublicBusinessLinks([business, second]))[1].publicSlug, 'al-reves-digital');
  assert.deepEqual(rpcCalls[0].map(item => item.business_id), [second.id]);
  rpcError = true;
  const third = { ...second, id: 'rec00000000000002' };
  const degraded = await links.withPublicBusinessLinks([business, third]);
  assert.equal(degraded[0].publicSlug, business.publicSlug); assert.equal(degraded[1].publicSlug, undefined);
  rpcError = false; readError = true;
  assert.equal((await links.withPublicBusinessLinks([second]))[0].publicSlug, undefined);
  await assert.rejects(() => links.publicLinkBusinessId(business.publicSlug));
  readError = false;
  assert.equal(await links.publicLinkBusinessId('../private'), null);
  assert.equal((await resolver.loadPublicBusiness(business.id)).id, business.id);
  assert.equal((await resolver.loadPublicBusiness(business.publicSlug.toUpperCase())).id, business.id);
  rows.push({ business_id: business.id, slug: 'nombre-anterior', is_canonical: false });
  assert.equal((await resolver.loadPublicBusiness('nombre-anterior')).publicSlug, business.publicSlug);
  assert.equal(await resolver.loadPublicBusiness('no-existe'), null);
  directory = []; assert.equal(await resolver.loadPublicBusiness('nombre-anterior'), null); directory = [business];
  readError = true; await assert.rejects(() => resolver.loadPublicBusiness('nombre-anterior')); readError = false;

  const metadata = await listing.generateMetadata({ params: { id: business.id } });
  assert.equal(metadata.title, 'Financial Solidity sas | Mercáu');
  assert.equal(metadata.alternates.canonical, urls.businessPath(business));
  assert.equal(metadata.openGraph.images[0].url, `https://www.mercau.co/api/negocios/${business.id}/og?v=1`);
  await assert.rejects(() => listing.default({ params: { id: business.id } }), /REDIRECT:\/negocios\/financial-solidity-sas$/);
  const listingHtml = renderToStaticMarkup(await listing.default({ params: { id: business.publicSlug } }));
  assert(listingHtml.includes(urls.businessCatalogPath(business)));
  assert(listingHtml.includes(encodeURIComponent(urls.businessShareMessage(business))));
  await assert.rejects(() => catalog.default({ params: { id: business.id } }), /REDIRECT:.*\/catalogo$/);
  const catalogHtml = renderToStaticMarkup(await catalog.default({ params: { id: business.publicSlug } }));
  assert.equal(catalogId, business.id); assert.equal(pilotId, business.id);
  assert(catalogHtml.includes(`data-restaurant="${business.id}"`));
  assert(catalogHtml.includes(`data-owner-business="${business.id}"`));
  pageBusiness = { ...business, publicSlug: undefined };
  assert(renderToStaticMarkup(await listing.default({ params: { id: business.id } })).includes(business.name));
  pageBusiness = null;
  await assert.rejects(() => listing.default({ params: { id: 'no-existe' } }), /NOT_FOUND/);
  const sitemap = load('app/sitemap.ts', { '@/lib/airtable-directory': { loadDirectoryBusinesses: async () => directory }, '@/lib/business-public-links': links, '@/lib/business-public-url': urls });
  assert((await sitemap.default()).some(item => item.url === urls.businessPublicUrl(business)));
  console.log('PASS URL helpers, registry fallback, bulk reservation, rename stability, alias/public visibility, 308 targets, metadata, share content, catalog/pilot original IDs, missing businesses, sitemap.');
  if (process.argv.includes('--sql')) await sqlTests();
})().catch(error => { console.error(error); process.exitCode = 1; });
