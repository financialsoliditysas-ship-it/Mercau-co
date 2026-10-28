# Piloto privado: Restaurante Mercado

## Rutas
- `/piloto/restaurante-mercado`: menu, carrito, acceso y pedidos propios del cliente.
- `/piloto/restaurante`: acceso del restaurante y aceptar/rechazar/listo.
- `/api/piloto/restaurante`: JWT verificado con Supabase Auth, permisos consultados en servidor.

El restaurante ficticio no se agrega a Airtable, al directorio, sitemap ni a la Home.
Las fotos son ilustrativas. Pedidos y despacho son persistentes; comida y cobros son de prueba.
Solo cuentas invitadas en `pilot_restaurant_members` pueden pedir. No hay registro abierto de clientes en este piloto.
Un manager puede hacer un pedido de prueba desde la vista cliente, usando la misma cuenta.

## Base de datos
Ejecutar el CONTENIDO de `supabase/restaurant_pilot.sql` en SQL Editor.
Las tablas nuevas tienen RLS, sin permisos para anon/authenticated. Las rutas usan service role solo en servidor.
`pilot_food_transition` bloquea la fila y guarda pedido logistico e historial en una transaccion.
La doble pulsacion en Listo devuelve dispatch=false en la segunda llamada.
El carrito tiene clave de idempotencia; las repeticiones devuelven el pedido existente.
Precios y tarifa se calculan del menu guardado, no de los importes del navegador.

## Acceso
Vincular SOLO el usuario autorizado de auth.users a la membresia manager.
No asignar manager a partir de datos enviados por el navegador ni user_metadata.
No cambiar una contrasena existente. Ingresar con la misma cuenta Supabase del proyecto.
Si necesita recuperarla, el titular debe completar el flujo de recuperacion y escribir su contrasena.

## Shipday
Reutiliza `syncOrderToShipday`, el webhook y `delivery_orders` actuales.
Solo se crea el envio cuando el restaurante acepta y luego marca Listo.
Se envian productos, cantidades, precios, tarifa y total. Shipday Drive realiza las etapas logisticas.
El cliente consulta el estado del delivery asociado dentro de Mis pedidos cada 12 segundos.
No recibe botones de operacion ni IDs internos. Puede ver si el restaurante rechazo su solicitud.
El panel usa los estados del webhook existente; no implementa liquidacion del mensajero.
Pedido listo con integration_error: revisar en Admin / Envios antes de reintentar.
Si hubo timeout o respuesta ambigua, comprobar primero en Shipday el MCU correspondiente.
No realizar un reintento ciego: la API de Shipday no se trata aqui como idempotente.
Si el proceso cae despues de guardar Listo pero antes de invocar Shipday, el MCU queda created:
reconciliar manualmente en administracion, sin repetir la transicion del restaurante.

## Prueba
1. Titular entra en la vista cliente y crea un pedido con destino urbano real coordinado.
2. Abrir panel restaurante en otra pestana, misma cuenta autorizada.
3. Rechazar un pedido: no debe aparecer envio en Shipday.
4. En otro pedido, aceptar y marcar Listo una vez.
5. Confirmar el MCU/Shipday ID en panel y que exista una sola orden.
6. Mensajero usa Shipday Drive para recoger, ir en camino y entregar.
7. Cliente verifica los estados en Mis pedidos; no debe operar el restaurante.
8. Repetir Listo no debe generar otro despacho.

## Limites
No restaurante real, preparacion real, pagos, transferencias, comisiones ni cierres contables.
No API de cancelacion comercial ni promesa de tiempo de entrega. Sin alertas push/WhatsApp:
el panel consulta cada 12 segundos mientras esta abierto; no hay notificaciones en segundo plano.
Horario 17:00-22:00 informativo para el ejemplo, no bloquea pruebas fuera de ese horario.
No abrir membresias ni quitar la marca de prueba hasta la validacion completa.
Variables privadas existentes: SUPABASE_SERVICE_ROLE_KEY, SHIPDAY_API_KEY, SHIPDAY_WEBHOOK_TOKEN.
No se agregan variables ni proveedores. No incluir .env.local en Git o despliegue.
