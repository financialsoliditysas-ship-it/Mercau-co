const assert = require('assert');
const businesses = require('../data/directory-fallback.json');

assert.equal(businesses.length, 46);
assert.equal(new Set(businesses.map(business => business.id)).size, 46);
assert.equal(businesses.filter(business => business.pilotRestaurant).length, 1);
assert.ok(businesses.every(business => ['Verificado', 'Destacado', 'Publicado'].includes(business.status)));
assert.ok(businesses.every(business => business.name && business.category && business.municipality));
assert.ok(businesses.every(business => business.source === 'Airtable (copia de continuidad 2026-11-06)'));
assert.ok(!JSON.stringify(businesses).includes('Token de actualización'));
assert.ok(!JSON.stringify(businesses).includes('Link privado de actualización'));

console.log('PASS: 46 published businesses, unique IDs, pilot separation, and public-only continuity data.');
