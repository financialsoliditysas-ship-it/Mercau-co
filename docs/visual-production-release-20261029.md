# Entrega visual compatible con produccion

Autorizacion del usuario: separar del candidato los controles logisticos no publicados que requieren `claim_delivery_dispatch`, `request_key`, `request_fingerprint` y `dispatch_attempted_at`; conservar rediseño, configuracion y protecciones; desplegar si las comprobaciones pasan.

Confirmacion explicita posterior: el usuario acepta que el riesgo vigente de duplicados no se corrige en este lanzamiento visual; autoriza diferir SOLO los nuevos controles SQL. No autoriza retirar controles publicados ni aumentar el riesgo respecto de la operacion productiva. Se mantienen token y seguimiento protegido. Pendiente prioritario: validar e implementar los controles de idempotencia/reclamacion y su migracion en un trabajo separado, con pruebas de concurrencia y conciliacion. No se declaran terminados en esta salida.

## Conservacion y alcance

- Corte previo completo: `72b1c38`, conservado en `feat/buyer-integration-20261028` y `archive/logistics-safety-20261029`. No se reescribieron esos commits.
- Rama de salida: `release/visual-production-20261029`. Cambios locales ajenos, prototipo BuyerCheckout y SQL no aprobado no se incorporan al commit.
- Fuente productiva de referencia: `dpl_2icwrVFoA54LAmFdAsaq8WBG6yWb`, proyecto Vercel `mercau.co`. Su archivo completo lib/deliveries.ts se consulto mediante CLI y se verifico por SHA-1 `9e35e1c6d8c529f9e6d9e838149a3b2fbfd3863c`; coincide con la base conservada 4342ee0 normalizando solo CRLF. No contiene los controles SQL nuevos; si valida el token configurado del webhook.
- Se retiran SOLO los campos, validacion y RPC diferidos del camino de despacho, y la respuesta administrativa asociada al bloqueo diferido. Se restituye el payload Shipday publicado. No se añaden reintentos automaticos ni se promete una idempotencia distribuida nueva.
- Se conservan la autenticacion del webhook y el seguimiento autorizado, sin exponer datos de otros usuarios ni eliminar esas rutas. La variable SHIPDAY_WEBHOOK_TOKEN figura en production; no se leyo su valor ni se modifico. La validacion conserva la comparacion constante y el rechazo cuando falta configuracion, en lugar de retirar protecciones para publicar.
- El formulario de envio puede seguir enviando su identificador cliente existente; el backend vigente no lo inserta en columnas nuevas. No requiere migracion.
- Inicio, Home V3, listados, menu visual, personalizacion, carrito, revision, seguimiento, perfil/cuenta y puente PWA permanecen. Manifest, worker, QR, autenticacion de cuentas, comisiones y pagos no cambian.

## Verificacion

`data/production-backend-contract.json` fija hashes del contrato publicado conservado. `scripts/test-production-visual-contract.cjs` compara despacho, payload, servidor de restaurantes, controller de pedidos, auth, QR, manifest y SW; tolera exclusivamente el endurecimiento de validacion del token ya documentado. Prueba tambien rechazo de webhook no autorizado y aislamiento del seguimiento. No hace llamadas operativas.

La suite sustituye el ensayo del SQL diferido por esta regresion del contrato vigente. Los ensayos del endurecimiento y su SQL permanecen en el historial/archivo; no se los declara implementados en produccion. Las otras suites se mantienen. La exportacion exacta del commit se verifica con typecheck, lint, build y recorridos de navegador a cuatro tamaños. Los servicios del recorrido comercial son ficticios, sin confirmar pedidos.

## Despliegue controlado y reversion

1. Exportar solo el commit aprobado, sin env ni estado local. Revisar archivos de subida excluyendo QA, outputs, secretos, prototipos y SQL; no subir el build QA con valores ficticios.
2. Confirmar nuevamente que el deployment productivo anterior sigue siendo el indicado. Registrar su ID antes de modificar aliases.
3. Crear un deployment con target production y skip-domain, usando el proyecto, configuracion y variables productivas existentes, sin nuevos planes o servicios. Comprobar las rutas de solo lectura antes de promover. No generar pedidos, cobros, mensajes o despachos.
4. Promover el deployment autorizado al dominio actual y repetir smoke de Home, comprador, catalogos, navegacion y acceso. Si falla un recorrido critico, restaurar el deployment anterior con rollback autorizado por el usuario.
5. Entregar ID/URL/commit y resultados. La apertura PWA instalada Android/iPhone y el pedido real controlado quedan a cargo de la comprobacion coordinada posterior con el usuario; no se simula haberla realizado.

Costos: se reutilizan Vercel y servicios existentes; no se cambia plan ni contrata otro proveedor. El build y trafico consumen la asignacion del proyecto. No se consultaron valores de claves ni se activaron cargos de otra infraestructura.
