const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

const consent=read('components/MarketingConsent.tsx');
const pixel=read('lib/meta-pixel.ts');
const commerce=read('lib/commerce-tracking.ts');
const restaurant=read('components/RestaurantPilot.tsx');
const catalog=read('app/negocios/[id]/catalogo/page.tsx');
const metrics=read('app/api/metricas/route.ts');
const adminMetrics=read('app/api/admin/metricas/route.ts');
const adminPage=read('app/admin-metricas/page.tsx');
const installLanding=read('components/InstallLandingMetrics.tsx');
const installPage=read('app/instalar/page.tsx');

assert(consent.includes('NEXT_PUBLIC_META_PIXEL_ID'),'Pixel no configurable por entorno');
assert(pixel.includes('marketingConsent() !== "accepted"'),'Pixel puede cargar sin consentimiento');
assert(consent.includes('No enviamos a Meta tu nombre, teléfono ni dirección.'),'Falta información clara de privacidad');
assert(!commerce.includes('phone')&&!commerce.includes('address')&&!commerce.includes('customer'),'La medición comercial incluye datos personales');
assert(restaurant.includes("trackCommerceEvent('Menu visto','ViewContent'"),'Falta vista de menú');
assert(restaurant.includes("trackCommerceEvent('Producto agregado','AddToCart'"),'Falta producto agregado');
assert(restaurant.includes("trackCommerceEvent('Carrito iniciado','InitiateCheckout'"),'Falta inicio de checkout');
assert(restaurant.includes("trackCommerceEvent('Pedido confirmado','Lead'"),'Falta pedido confirmado');
assert(restaurant.includes("trackMetaEvent('OrderSubmitted'"),'Falta evento de pedido enviado');
assert(!restaurant.includes("'Pedido confirmado','Purchase'"),'Pedido enviado se marca falsamente como compra');
for(const type of ['Menu visto','Producto visto','Producto agregado','Carrito iniciado','Pedido revisado','Pedido confirmado'])assert(metrics.includes(`"${type}"`),`Métrica no permitida: ${type}`);
assert(catalog.includes('<CatalogShareActions'),'Faltan acciones para compartir menú');
assert(catalog.includes('openGraph:'),'Faltan metadatos sociales del menú');
assert(adminMetrics.includes('menusVistos: countType("Menu visto")'),'El administrador no cuenta menús vistos');
assert(adminMetrics.includes('pedidosConfirmados: countType("Pedido confirmado")'),'El administrador no cuenta pedidos confirmados');
assert(adminPage.includes('label="Pedidos confirmados"'),'El embudo no aparece en el panel administrativo');
assert(metrics.includes('"Pagina instalacion visitada"'),'La API no permite registrar visitas a instalación');
assert(installLanding.includes('trackPublicMetric("Pagina instalacion visitada")'),'La landing no registra la visita');
assert(installLanding.includes('sessionStorage'),'La visita puede duplicarse por recargas durante la misma sesión');
assert(installPage.includes('<InstallLandingMetrics />'),'La medición no está montada en la página de instalación');
assert(adminMetrics.includes('visitasQrTarjeta'),'El administrador no calcula visitas desde el QR físico');
assert(adminPage.includes('label="Visitas desde QR físico"'),'La métrica del QR no aparece en el panel');

console.log('PASS launch tracking: compact catalog identity, share actions, consent-gated Meta Pixel and non-PII funnel events. Static verification only; no event sent.');
