# Seguimiento de pedidos del cliente

## Cambios

- Mi cuenta > Mis pedidos apunta a `/mi-cuenta/pedidos`, no al restaurante ficticio.
- GET `/api/mi-cuenta/pedidos` usa el usuario del JWT verificado, sin aceptar otro customer_id.
- Lista hasta 50 pedidos propios de todos los negocios, incluso si el negocio pausa su menu.
- Devuelve solo datos del pedido del cliente; excluye IDs internos, telefonos y datos de otros clientes.
- Al entrar al menu, el historial queda oculto y accesible mediante Ver mis pedidos.
- Despues de confirmar, se muestra solo el pedido recien creado y se oculta el menu mientras se consulta su estado.
- Hacer otro pedido vuelve al menu; los pedidos previos se conservan en Mi cuenta > Mis pedidos.
- Refresco cada 12 segundos. Un fallo conserva la ultima respuesta y muestra un aviso.
- Cambio de cuenta o cierre de sesion retira los datos anteriores.

## Estados

Pedido recibido > En preparacion > Listo para recoger > Mensajero asignado > Recogido > En camino > Entregado.
Preparacion viene de la aceptacion del negocio. La parte logistica lee los estados existentes de delivery_orders.
No se calcula ETA ni se inventa ubicacion del mensajero. Rechazo, cancelacion, fallo de entrega y error de despacho
se muestran como excepciones, no como entregas completadas.

No requiere migracion. No modifica tarifas, pagos, comisiones, despachos ni configuracion de Shipday.

## WhatsApp pendiente de diagnostico en la cuenta de Shipday

El adaptador actual envia customerPhoneNumber en formato +57 para celulares colombianos.
No hay un proveedor WhatsApp propio ni una instruccion de supresion de avisos en createOrder.
La causa del mensaje ausente no se ha confirmado. Se solicito un pedido afectado y una captura
de Customer notifications para comprobar configuracion y disponibilidad en el plan de esa cuenta.
No atribuirlo a vencimiento de prueba, saldo o configuracion sin evidencia.

Fuentes oficiales revisadas:
- https://www.shipday.com/pricing
- https://docs.shipday.com/reference/order-status-update-2

## Validacion

Pruebas locales con DB/API simuladas: estados, aislamiento por usuario, ausencia de datos internos,
persistencia ante error, cambio de cuenta y resoluciones 320/390/1440.
Pendiente desplegar y verificar un pedido real existente, sin crear un despacho nuevo.
