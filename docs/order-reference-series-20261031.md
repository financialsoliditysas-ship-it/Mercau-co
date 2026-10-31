# Serie de pedidos MCU-1

## Alcance autorizado

Nuevos pedidos: `MCU-1-000001`, `MCU-1-000002`, etc. Secuencia global de
`pilot_food_orders`, incluidos pedidos del restaurante de demostracion.
No modifica referencias existentes, UUID, importes, clientes, permisos de pedidos,
idempotencia, propuestas de cambio ni transiciones. Los envios conservan su
serie independiente `MCU-000001` y su vinculacion existente con Shipday.

La secuencia PostgreSQL puede tener saltos por transacciones abortadas; no es
numeracion fiscal ni una promesa de consecutivos sin huecos.

## Orden de activacion

1. Publicar el codigo compatible con `PRB-...` y `MCU-1-...`.
2. Aplicar `supabase/order_reference_series.sql` mediante migracion autorizada.
3. Verificar default, secuencia sin consumir y ausencia de cambios al historial.

El script no reinicia una secuencia existente. Usa limite 999999 y NO CYCLE para
fallar antes de truncar o repetir referencias. No crea pedidos de comprobacion.
Los reintentos siguen consultando los recibos existentes.

## Pruebas

`test-order-receipts.cjs`: esquema versionado en PGlite, pedido antiguo intacto,
migracion repetible, primera compra nueva MCU-1-000001, idempotencia y comparacion
de duplicados conservadas. Proveedor y push simulados.
`test-order-changes.cjs`: propuestas y permisos con las dos referencias.
La excepcion del contrato de produccion normaliza solo las alternativas regex
autorizadas, sin sustituir hashes operativos.

## Reversion

Conservar el codigo compatible si ya existen pedidos MCU-1. Para detener la nueva
serie, restaurar solo el default anterior de `pilot_food_orders.public_id`:
`('PRB-' || lpad(nextval('public.pilot_food_public_seq')::text, 6, '0'))`.
No borrar ni reiniciar secuencias o pedidos. No volver al codigo exclusivamente
PRB si ya hay referencias nuevas. La reversion de base de datos requiere una
accion explicita y no se ejecuta automaticamente con un rollback de Vercel.
