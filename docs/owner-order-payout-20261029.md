# Neto de productos en los pedidos del negocio

Estado: implementado y verificado localmente; sin push ni despliegue.
Rama: fix/owner-order-payout-20261029.
Checkout limpio del mismo repositorio: work/owner-order-payout-20261029. Base productiva f65a7f2. Los borradores preexistentes de work/buyer-experience-20261027 se preservaron intactos.

## Presentacion y datos

Cada tarjeta del panel del negocio muestra Valor a recibir por productos, el subtotal de productos y la comision registrada, con la aclaracion No incluye el domicilio.

El importe es order_financial_snapshots.merchant_net, el mismo campo utilizado al construir la instruccion de recogida para Shipday. No se recalcula el 15 %, no se agrega merchant_delivery_share ni se actualiza ningun registro financiero. La tasa visible corresponde a merchant_commission_rate_bps del pedido, no a la configuracion actual del negocio. Esto conserva pedidos historicos y acuerdos con tasas distintas.

Se admite la relacion financiera como objeto o arreglo de un elemento. Si falta el neto o no es un entero seguro no negativo, se muestra no disponible, sin inventar un valor o reemplazarlo por cero. Un neto registrado de cero es valido. Los pedidos rechazados/cancelados muestran neto calculado y aclaran que no indica un pago pendiente. La nueva informacion no bloquea aceptar, rechazar o despachar.

## Permisos

Se conserva pilotMember antes de consultar pedidos. El administrador solo consulta el restaurante autorizado, incluido el piloto privado cuando tiene rol manager. La seleccion financiera se amplia solo en mode=manager. El comprador conserva su filtro customer_id y los dos campos anteriores de pago; ademas se aplica una proyeccion explicita para excluir importes/comisiones incluso si una respuesta incluye mas columnas de las solicitadas.

No se cambia JWT, roles, propietarios, privacidad de seguimiento, creacion/transicion de pedidos, totales, forma de pago, QR, Shipday, manifest o worker. El contrato de backend permite exclusivamente el import del helper, la seleccion segun perfil y la proyeccion de pago; el resto del archivo sigue comparandose con el hash original.

## Configuracion y costos

Consulta de solo lectura a information_schema confirmo en produccion las seis columnas utilizadas, sin leer clientes, pedidos, pagos o cuentas. No hay migracion, nueva tabla, nueva API, dependencia, servicio o plan. Se reutiliza la relacion financiera existente dentro de la misma consulta de pedidos.

## Comprobaciones

Runtime comprobado: bcdc2a6. Pasaron las 24 suites aisladas, lint, build, typecheck, Home/PWA, navegacion, recorridos integrales y restricciones QA. Una primera compilacion encontro que Supabase no inferia los campos de una cadena dinamica; se corrigio conservando selecciones literales tipadas.

scripts/test-owner-order-payout.cjs cubre permisos efectivos de la funcion, aislamiento restaurante/comprador, datos financieros excluidos del comprador, objeto/arreglo, tarifas negociadas, neto autoritativo sin recalculo, cero, datos ausentes/invalidos y render.

qa/test-owner-payout-ui.cjs comprobo la tarjeta y Actualizar en 320/390/768/1440 px, sin overflow. Se uso una sesion ficticia y respuestas simuladas sobre los componentes reales. No equivale a una prueba con cuenta productiva o dispositivo fisico. No se crearon pedidos, cobros o despachos.

Capturas y resultados: outputs/owner-payout. Informe de suites: outputs/final-verification/results.json. Pendiente: autorizacion de publicacion y comprobacion de lectura con una cuenta real autorizada. Reversion: restaurar el despliegue f65a7f2; no hay datos o SQL que deshacer.
