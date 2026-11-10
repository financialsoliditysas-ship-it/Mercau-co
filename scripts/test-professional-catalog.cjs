const fs=require('fs');const assert=require('assert');
const validation=fs.readFileSync('lib/catalog-validation.ts','utf8');
const templates=fs.readFileSync('lib/catalog-templates.ts','utf8');
const detail=fs.readFileSync('components/CommerceProductDetail.tsx','utf8');
const catalog=fs.readFileSync('components/PublicCatalog.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261110120000_professional_commerce_catalog.sql','utf8');
const cart=fs.readFileSync('components/CommerceCartPanel.tsx','utf8');
const orderAction=fs.readFileSync('lib/commerce-order-action.ts','utf8');
const variantPhoto=fs.readFileSync('app/api/mi-negocio/[businessId]/catalogo/[productId]/variante-foto/route.ts','utf8');
const managementMigration=fs.readFileSync('supabase/migrations/20261110170000_commerce_order_management.sql','utf8');
assert.match(validation,/variants:CatalogVariant\[\]/);assert.match(validation,/attributes:CatalogAttribute\[\]/);
for(const category of ['Moda y accesorios','Ferretería y construcción','Hogar, tecnología y reparación','Profesionales y servicios'])assert.ok(templates.includes(`'${category}'`));
assert.match(detail,/variant\?\.available/);assert.match(detail,/Más de/);assert.match(detail,/w-\[calc\(50%-6px\)\]/);
assert.match(catalog,/type="search"/);assert.match(migration,/add column if not exists variants jsonb/);assert.match(migration,/add column if not exists subcategory/);
assert.match(cart,/api\/comprar\/catalogo/);assert.match(cart,/municipality/);assert.match(migration,/business_catalog_orders/);
assert.match(detail,/variant\?\.imagePath/);assert.match(variantPhoto,/setCatalogVariantImage/);
assert.match(orderAction,/sendRestaurantOrderTemplate/);assert.match(managementMigration,/action_token_hash/);assert.match(managementMigration,/business_catalog_order_history/);
console.log('Catálogo profesional: estructura, compatibilidad y vistas verificadas.');

