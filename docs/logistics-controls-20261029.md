# Controles logísticos: candidato local, no publicado

## Estado y alcance

- Rama: `fix/logistics-safety-20261029`, basada en producción `74023d2`.
- No se ha hecho push, despliegue, SQL remoto, cambio de secretos ni pedido/despacho real.
- No publicar este código con el esquema anterior: necesita la propuesta SQL validada y autorizada.
- Sin proveedores, dependencias ni suscripciones nuevas. Se reutilizan Supabase, Shipday y PGlite existentes. No se verificaron cuotas remanentes de producción; no se cambió facturación.

## Correcciones preparadas

1. **Un intento externo por envío**: reserva atómica en PostgreSQL antes del POST a Shipday. Un segundo proceso o una llamada con datos desactualizados no obtiene otra reserva. La reserva no vence ni se borra automáticamente tras timeout, caída del proceso o fallo al guardar la respuesta. La confirmación del proveedor y su historial se guardan en una transacción. Un webhook temprano puede vincular el ID externo al envío reservado.
2. **Cancelación coherente**: solo se permite cancelar localmente un envío que no salió ni tuvo un intento externo. La reserva y la cancelación bloquean la misma fila. Para envíos enviados o inciertos, la API rechaza la cancelación local y la interfaz indica resolver en Shipday. `ORDER_DELETE` aplica la confirmación recibida. No se implementó un DELETE automático al proveedor.
3. **Eventos ordenados**: token obligatorio conservado, fecha válida, bloqueo por fila, deduplicación antes de modificar, fecha del último evento y control de regresiones/estados terminales. Estado e historial se guardan juntos. Los eventos ignorados quedan registrados sin reemplazar el estado vigente. Se preservan las rutas de metadata existentes, el domiciliario y las fechas operativas.
4. **Instrucciones económicas comprobadas**: primer envío y reintento usan la misma validación de snapshot y persistencia. Ante error de lectura, valores incongruentes o escritura fallida no se contacta al proveedor. Se copia el neto registrado, sin recalcular comisión. Se conservan efectivo, Bre-B al recibir, beneficiario Financial Solidity S.A.S. y el comportamiento previo para pagos confirmados.

Shipday documenta reversiones explícitas `ORDER_UNASSIGNED`, `ORDER_PIKEDUP_REMOVED` y `ORDER_ONTHEWAY_REMOVED`. Se admiten cuando son posteriores y coherentes con su destino, sin reabrir estados terminales. Desasignar limpia el domiciliario anterior. No se confunden con eventos normales atrasados.
Referencia: https://docs.shipday.com/reference/order-status-update-2

## SQL propuesto, todavía sin aplicar

Archivo: `supabase/drafts/logistics_controls_v2.sql`. El borrador anterior `delivery_safety.sql` se conserva, no debe ejecutarse junto con este como si fueran una única migración.

- Dos columnas aditivas: `dispatch_attempted_at` y `shipday_event_at`.
- Cuatro RPC privadas, `security invoker`, ejecutables solo por `service_role`.
- Se mantienen RLS y autorizaciones de las rutas. No se otorgan permisos a compradores ni negocios sobre estas RPC.
- La primera incorporación de la columna marca las filas históricas como no reenviables automáticamente, porque un ID de Shipday vacío no demuestra que nunca se enviaron. No altera sus importes ni estados. Reaplicar el borrador no marca filas nuevas pendientes.
- No cambia tablas financieras, funciones de cálculo, tarifas, porcentajes ni políticas de pago.
- Si ya estuviera aplicado el borrador antiguo, revisar sus marcas antes de activar; no asumir que sus datos son equivalentes.

Antes de producción: comparar por lectura el esquema efectivo, permisos, triggers y funciones con los scripts versionados; validar la propuesta en Supabase aislado. Esta entrega no ha hecho esa comprobación remota ni sustituye una prueba de contención entre procesos PostgreSQL independientes.

## Pruebas y evidencia

`scripts/test-logistics-controls.cjs` utiliza el esquema real `delivery_orders.sql` y la migración `shipday_carriers.sql` en PostgreSQL embebido PGlite; aplica dos veces el SQL propuesto. No usa un esquema reducido de envíos.

- Reservas repetidas/solapadas, registros históricos y reaplicación sin bloquear registros nuevos.
- Exclusión de cancelación/despacho, confirmación externa, webhook anterior a la respuesta del POST.
- Eventos repetidos, antiguos, regresivos, desconocidos, terminales y reversiones explícitas.
- Un fallo del historial revierte también el cambio de estado y su fecha.
- Permisos negativos para `anon`/`authenticated` y permisos de ejecución de `service_role`.
- Servicio real de despacho con base/proveedor simulados: error SQL, lectura financiera fallida, timeout y fallo de persistencia no producen un segundo POST.
- Preparación financiera con datos ficticios: efectivo, Bre-B al recibir/prepagado, neto cero, valores incongruentes, relación ausente y error de escritura.
- Manejadores HTTP reales en memoria: administración sin autorización, conflictos 409, token webhook incorrecto/ausente y fallo temporal 503.

`qa/check-logistics-controls.cjs` ejecuta las 25 suites, lint, build y typecheck con servicios externos bloqueados, sin credenciales productivas. Resultados generados: `outputs/logistics-controls/results.json` y logs. Lint conserva avisos previos sobre imágenes y dependencias de hooks; no hay errores. No hay nuevas pruebas físicas Android/iPhone.

Se conserva `production-backend-contract.json` como referencia histórica; `logistics-controls-contract.json` delimita los tres archivos operativos que sustituyen explícitamente ese contrato. Los hashes de pagos, QR, autenticación, payload del proveedor, manifest y service worker siguen comprobándose contra la base anterior.

## Límites que no deben ocultarse

- Esto limita intentos de **un mismo envío**; no demuestra ausencia de duplicados entre dos solicitudes nuevas con IDs distintos.
- Los pedidos de restaurante conservan su `request_key` y restricción única existentes. La persistencia de esa intención tras recargas/cambio de dispositivo y la idempotencia de creación de mensajería independiente requieren un cierre separado antes de permitir reenvíos offline.
- La conciliación incierta es manual: buscar el número MCU en Shipday. Si existe, no reenviar; recibir/reprocesar un evento auténtico puede vincularlo. Si no aparece, su ausencia visual no autoriza borrar la reserva. Falta un procedimiento autorizado de consulta y resolución antes de habilitar reintentos de esos casos. No hay botón para liberar reservas ni SQL de reinicio automático.
- La cancelación de un envío ya enviado se inicia en Shipday. Su notificación real y sus tiempos no fueron probados contra producción. Hasta confirmarla, Mercáu no afirma que está cancelado.
- No se implementó verificación bancaria automática. Los controles manuales de recaudo y conciliación financiera siguen siendo necesarios.
- Estados terminales contradictorios quedan registrados como ignorados para revisión, no se corrigen silenciosamente.

## Activación y reversión

1. Autorizar y preparar la migración definitiva desde este borrador, después de verificar el esquema efectivo y las pruebas aisladas pendientes.
2. Revisar envíos inciertos/históricos con el operador; no rearmarlos en lote.
3. Aplicar SQL solo con autorización explícita, sin cambiar secretos ni políticas de clientes.
4. Autorizar el despliegue del candidato exacto; comprobar accesos y errores sin pedidos reales. Coordinar aparte un pedido real controlado si se autoriza.
5. La producción actual permanece sin cambios. Si posteriormente fuera necesario revertir, conservar columnas y trazabilidad. El backend antiguo ignora las reservas: volver a él sin restringir reintentos reintroduce el riesgo conocido. Preferir corrección hacia delante o pausa operativa del despacho y autorización expresa de la reversión. No borrar marcas para volver a enviar.
