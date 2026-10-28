const fs=require('node:fs');
const photos=fs.readFileSync('app/api/admin/catalogos/fotos/route.ts','utf8');
const photoUi=fs.readFileSync('components/admin/AdminCatalogPhotos.tsx','utf8');
const orders=fs.readFileSync('lib/admin-business-orders.ts','utf8');
const ordersUi=fs.readFileSync('app/admin/negocios/page.tsx','utf8');
function has(source,value,message){if(!source.includes(value))throw new Error(message);}
has(photos,"x-admin-password",'Las fotos administrativas deben exigir autenticación.');
has(photos,'importedProductId','La carga múltiple debe relacionar fotos por código estable.');
has(photos,'validatePhoto','Las fotos deben reutilizar la validación existente.');
has(photoUi,'multiple','Debe permitirse seleccionar varias fotos.');
has(photoUi,"replace(/\\.[^.]+$/",'El nombre del archivo debe convertirse en código de producto.');
has(orders,"enabled:false",'Los negocios preparados deben comenzar con pedidos pausados.');
has(orders,'listPendingBusinessOrderConfigs','Deben mostrarse las fichas pendientes de configuración.');
has(ordersUi,'Preparar para recibir pedidos','El administrador debe poder preparar una ficha del directorio.');
has(ordersUi,'Dirección de recogida','La configuración debe permitir completar la recogida.');
console.log('PASS admin product photos and order onboarding contract.');
