# Recepción móvil y despacho programado

## Corte local

La rama `feature/restaurant-auto-dispatch-20261106` prepara el flujo, pero no aplica la migración, no envía WhatsApp, no llama Shipday y no publica.

## Programación

Al aceptar un pedido Mercáu, la migración `20261106193000_restaurant_auto_dispatch.sql` guarda una hora estimada y crea un único `delivery_orders` en estado `created`. El valor piloto es 15 minutos de preparación y 3 minutos de margen, por lo que la búsqueda queda programada para 12 minutos después de aceptar. Los campos `preparation_minutes` y `dispatch_lead_minutes` permiten configurar el margen por negocio.

El endpoint interno `POST /api/internal/restaurant-dispatch-scheduler` procesa los registros vencidos. Requiere `RESTAURANT_DISPATCH_SCHEDULER_SECRET`. Todavía no se conectó a un cron externo porque el repositorio no tiene un programador configurado y activar uno requiere decidir proveedor, plan y costo.

El scheduler reutiliza `syncOrderToShipday` y su RPC `claim_delivery_dispatch_v2`. El reclamo de una sola vez permanece como control de concurrencia. Un resultado incierto queda para conciliación y no se reintenta a ciegas.

## Enlace móvil

Al crear un pedido nuevo se prepara un token aleatorio de un solo pedido con vencimiento de siete días. La ruta `/gestionar-pedido/<token>` no muestra dirección, teléfono ni datos del comprador. Solo presenta referencia, productos, observaciones y el valor registrado para el negocio.

La tabla privada `restaurant_order_messages` deja una sola salida `NEW_ORDER` por pedido. En este corte queda `blocked_provider` porque no existe integración WhatsApp Business configurada. La dirección se guarda como ruta relativa en el registro privado y el mensaje usa `MERCAU_PUBLIC_URL` o `https://www.mercau.co` como base. No se ejecutó ningún envío real.

## Pruebas

- `node scripts/test-restaurant-auto-dispatch.cjs`: máquina de estados simulada, sin proveedor externo.
- `node scripts/test-restaurant-auto-dispatch-sql.cjs`: PGlite con el esquema del repositorio y la migración nueva, sin datos de producción.
- `node scripts/test-logistics-controls.cjs`: regresión del reclamo e idempotencia de Shipday con proveedor simulado.
- `pnpm exec tsc --noEmit`, `pnpm exec next lint` y `pnpm run build`: ejecutados localmente. El build conserva advertencias preexistentes de `<img>` y hooks; no son de este flujo.
- Vista móvil ficticia: `qa/restaurant-order-mobile-review.html`. No está dentro de `public` ni es una ruta de Next.
