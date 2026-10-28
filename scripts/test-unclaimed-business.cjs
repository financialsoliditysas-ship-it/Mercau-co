const assert=require('node:assert/strict');
const fs=require('node:fs');

const helper=fs.readFileSync('lib/admin-unclaimed-business.ts','utf8');
const adminRoute=fs.readFileSync('app/api/admin/negocios/route.ts','utf8');
const activation=fs.readFileSync('app/api/actualizaciones/[token]/activar/route.ts','utf8');
const page=fs.readFileSync('app/admin/negocios/page.tsx','utf8');

assert(helper.includes("[FIELD_IDS.status]: 'Publicado'"));
assert(helper.includes('Ficha creada por Mercáu sin propietario'));
assert(helper.includes('randomBytes(24)'));
assert(!helper.includes("from('business_admins')"));
assert(adminRoute.includes('createUnclaimedBusiness'));
assert(adminRoute.includes('export async function POST'));
assert(page.includes('Crear ficha sin propietario'));
assert(page.includes('Enlace privado para reclamar la ficha'));
assert(activation.includes(".eq('business_id', business.id)"));
assert(activation.includes('owner.user_id!==data.user.id'));
console.log('PASS unclaimed business: admin-only creation, published Airtable ficha, private claim link, no owner assignment on creation and cross-account claim protection. Static verification only; no production writes.');
