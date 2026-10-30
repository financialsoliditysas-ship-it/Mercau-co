# Duplicidad y conciliación: cierre local del 30 de octubre de 2026

Estado: implementado y probado localmente. No publicado, sin push, SQL remoto, pedidos, cobros ni despachos reales. Rama `fix/logistics-safety-20261029`, base productiva `74023d2`.

Este informe actualiza los pendientes de creación y conciliación del informe `logistics-controls-20261029.md`. No convierte el candidato en una configuración productiva verificada.

## Comportamiento autorizado

1. **Misma referencia:** consulta del recibo persistido y devolución del pedido original. No crea otro pedido, snapshot financiero ni aviso al negocio. El plazo de cinco minutos no vence esta idempotencia. Una referencia reutilizada con datos incompatibles no crea otra compra.
2. **Referencias distintas:** se compara el mismo comprador autenticado y negocio contra pedidos de los últimos cinco minutos. Se incluyen producto, cantidades agrupadas, ingredientes/adiciones elegidas, notas, dirección/sector y punto confirmado. Se ignoran IDs de línea y orden de opciones. Un cambio de precio, tarifa o método de pago no elude la comparación semántica. No se utiliza geolocalización aproximada ni se deduce que dos direcciones escritas de forma diferente sean el mismo lugar.
3. **Aviso exacto:** «Ya tienes un pedido reciente igual. ¿Quieres revisarlo o hacer otro?».
4. **Revisar pedido anterior:** abre su detalle real filtrado por usuario, negocio y referencia, sin depender del límite del listado general.
5. **Hacer otro pedido igual:** solicita confirmación nativa explícita. Solo tras aceptarla genera una referencia nueva; registra la referencia original en el recibo privado. El servidor comprueba el pedido coincidente más reciente bajo bloqueo transaccional. Dos confirmaciones concurrentes del mismo original no crean dos compras adicionales en los escenarios probados.
6. **Cancelados/rechazados:** se excluyen de la comparación de cinco minutos. Reintentar su referencia original sigue devolviendo ese pedido, no uno nuevo.
7. **Resultado incierto:** se conserva la referencia en el navegador, separada por cuenta y negocio y sin dirección ni datos de pago. Al reintentar, primero se consulta el resultado. Si existe se abre; si la consulta falla no se genera otra referencia. Si no hay recibo todavía, solo se reintenta la misma referencia, protegida por la transacción. Un despacho externo incierto no ofrece la acción de repetir la compra; ese bloqueo no caduca al cumplirse los cinco minutos.

La presentación y las reglas económicas existentes se conservan. No se modificaron `lib/finance.ts`, el payload de creación `lib/shipday.ts`, el QR, manifest o service worker. No se construyó un nuevo marketplace ni verificación bancaria automática.

## Mensajería independiente

El formulario existente conserva su referencia al recargar, consulta antes de repetir y usa la misma protección de recibos. Los invitados utilizan una cookie esencial HttpOnly/SameSite para el ámbito del navegador; no se consideran usuarios autenticados ni se deduce identidad por teléfono o IP.

La detección entre dispositivos corresponde a una cuenta autenticada. Dos navegadores invitados sin identidad compartida no pueden identificarse como la misma persona con estos controles. Si se borran las cookies, no se devuelve una solicitud de otro ámbito; la restricción única de referencia evita recrearla bajo otro ámbito, pero puede requerir soporte para recuperarla.

Los consumidores externos WHATSAPP/ADMIN de `POST /api/deliveries` deben enviar `requestKey` UUID estable. El formulario versionado ya lo envía. No se verificaron consumidores externos no contenidos en el repositorio: comprobarlos antes de activar, no generar una referencia nueva desde el servidor en cada reintento para aparentar compatibilidad.

## Procedimiento de conciliación

En Admin / Envíos, un intento externo sin ID de Shipday muestra **Consultar y conciliar**. No es un botón de reenviar.

- Hace únicamente GET al endpoint documentado por número MCU, con la configuración existente de Shipday. No enumera todos los clientes.
- Comprueba una coincidencia única, número, destinatario, teléfonos, direcciones de recogida/entrega, productos/cantidades/precios y domicilio. No basta el número público. La respuesta administrativa no expone el payload personal del proveedor.
- **Coincidencia única y datos concordantes:** vincula atómicamente el ID externo al envío existente y registra el resultado. No borra el intento ni crea otro despacho.
- **Sin coincidencias, varias, datos distintos o consulta no disponible:** registra la incidencia, conserva el bloqueo e indica revisión con el operador. Una consulta vacía no prueba que el POST anterior no llegó.
- No hay liberación automática de reservas, SQL de reinicio para usuarios ni reintentos periódicos. Si la consulta sigue sin resolverlo, escalar al operador/soporte de Shipday con la referencia MCU, conservar evidencia y resolver el caso sin reenviar a ciegas. No declarar entregado/cancelado por ausencia del registro.
- Vincular el despacho no inventa sus eventos ni una hora de entrega. Los estados reales continúan por el webhook autenticado. Si falta su evento, su recuperación operativa debe comprobarse con el proveedor; no se simula como si hubiera llegado.

Documentación consultada: https://docs.shipday.com/reference/retrieve-order-details y https://docs.shipday.com/reference/delivery-order-object.

## Costos y configuración

No se incorporaron paquetes, proveedores, suscripciones, planes ni facturación nuevos. Se reutilizan Supabase, Shipday y el PostgreSQL embebido PGlite disponible. Las consultas manuales consumen el API existente de Shipday; no se verificaron sus cuotas remanentes, disponibilidad de este GET para la cuenta ni una tarifa adicional específica. No se hizo una consulta real con la clave productiva.

## SQL y activación pendiente

- Propuestas: `supabase/drafts/logistics_controls_v2.sql`, después `supabase/drafts/order_receipts_v3.sql`.
- Recibos privados, funciones con `security invoker`, sin ejecución ni lectura para `anon`/`authenticated`. Solo el servidor usa las funciones tras autorizar al usuario o administrador.
- Bloqueos transaccionales por ámbito; recibo, compra, historial y triggers financieros en la misma transacción. No cambia funciones de asignación financiera.
- Índice único de ID Shipday. Si hay duplicados históricos, el SQL falla y revierte; no los borra ni los corrige silenciosamente.
- El borrador antiguo `delivery_safety.sql` se conserva archivado, no se mezcla con estas propuestas.
- Antes de activar: lectura autorizada del esquema/permisos/triggers efectivos, revisar duplicados existentes por ID externo y consumidores externos, probar en Supabase/PostgreSQL aislado con conexiones independientes y autorizar por separado SQL y despliegue. Coordinar el cambio para no mezclar instancias antiguas creadoras de pedidos sin estos controles con el nuevo código.
- Una reversión no debe borrar recibos, reservas ni trazabilidad. El backend antiguo no utiliza estos controles; restablecerlo sin restringir reintentos reintroduciría el riesgo anterior.

## Pruebas y límites

- **26 suites**, lint, build y typecheck pasaron sobre el candidato. Lint mantiene avisos previos. Un primer build falló con EPERM al crear su carpeta; el reintento local con el permiso necesario pasó.
- Esquemas y triggers versionados reales de envíos, pedidos, cuentas y finanzas ejecutados en PGlite. Se verificó una sola compra y snapshot por referencia, conflictos, ventanas, confirmaciones, cantidades/opciones, rechazados/cancelados, ámbitos y permisos negativos. PGlite serializa conexiones: no equivale a una prueba de contención entre procesos PostgreSQL reales ni prueba los permisos productivos efectivos.
- Servicio real de pedidos con base/push simulados: mantiene precios e identidad del servidor, no repite avisos por reintento, exige confirmación y devuelve el mensaje aprobado.
- Chrome, viewport móvil de 390 px, componentes reales y servicios/sesión simulados: revisar abre el pedido anterior sin POST adicional; cancelar la confirmación no crea otro; aceptar crea una compra adicional con otra referencia; tras respuesta perdida y recarga se consulta y abre el original sin segundo POST; si la consulta falla no se ofrece repetir ni se reenvía. Sin errores de página ni desbordamiento en esos escenarios.
- Evidencias: `outputs/logistics-controls/results.json`, `outputs/order-intent-ui/results.json` y capturas en esa última carpeta. No son pruebas físicas Android/iPhone ni pedidos en producción.

Conclusión: controles preparados y verificados para los escenarios descritos. Su presencia en producción y comportamiento real con Shipday siguen pendientes de activación autorizada y comprobación controlada. No se promete ausencia absoluta de duplicados fuera de la identidad, ventana y condiciones definidas.
