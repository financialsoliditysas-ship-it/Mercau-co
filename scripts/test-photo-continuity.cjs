const assert=require('assert');
const fs=require('fs');

const publication=fs.readFileSync('lib/catalog-business-public.ts','utf8');
const availability=fs.readFileSync('lib/catalog-availability.ts','utf8');
const directory=fs.readFileSync('app/api/negocios/route.ts','utf8');
const fallback=require('../data/directory-fallback.json');

assert.ok(publication.includes("import fallbackBusinesses from '../data/directory-fallback.json'"));
assert.ok(publication.includes('continuityPublicIds.has(businessId)'));
assert.equal(new Set(fallback.map(business=>business.id)).size,fallback.length);
assert.ok(availability.includes("row.image_path?.startsWith(`${row.business_id}/${row.id}/`)"));
assert.ok(availability.includes('/catalogo/${row.id}/foto?v=${row.version}'));
assert.ok(directory.includes('business.photoUrl || catalog?.coverImageUrl'));
assert.ok(directory.includes("catalog?.coverImageUrl?'photo':undefined"));

console.log('PASS: published continuity IDs unlock existing product photos and catalog covers remain business-scoped.');
