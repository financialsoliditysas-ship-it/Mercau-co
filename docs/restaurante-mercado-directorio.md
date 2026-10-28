# Restaurante Mercado en el directorio

Ficha ficticia marcada [PRUEBA], sin sellos de verificacion o destacado.
Estado Publicado indica publicacion, no comprobacion comercial.
No se publica el celular ni la direccion exacta del punto privado de recogida.
El punto de recogida existente se conserva para despachos coordinados con Shipday.

## Configuracion y preparacion

Ejecutar supabase/restaurant_directory.sql: agrega asociaciones opcionales del piloto
con su ficha y sus productos; no reemplaza el menu original, pedidos ni negocios existentes.
Solo service_role puede adquirir el bloqueo de preparacion de dos minutos.

Desde /piloto/restaurante, un administrador confirmado del piloto puede preparar y
publicar la ficha. POST /api/piloto/restaurante/publicacion busca o crea una sola ficha
privada, registra su asociacion, conserva el administrador actual, prepara los productos
del menu original y sus fotos existentes en el bucket privado del catalogo y publica.
Una operacion incompleta se puede reintentar. Los IDs deterministas y el bloqueo de
preparacion evitan duplicados secuenciales y preparaciones simultaneas durante su vigencia.
No borra fotos, productos ni pedidos. Un proceso que exceda el bloqueo requiere revision.

La opcion Publicado del campo Estado se crea al publicar mediante typecast de Airtable,
si la cuenta configurada tiene permisos para agregar opciones. Si no, se debe agregar
esa opcion manualmente; la ficha permanece sin publicarse hasta completar el paso.

## Un solo menu

Tras preparar la asociacion, /api/piloto/restaurante?mode=menu y la validacion de pedidos
leen los productos publicados y disponibles del catalogo de la ficha.
Editar precio, foto, disponibilidad o publicar/archivar desde Mi catalogo actualiza
el mismo menu usado por el piloto. Las lineas de pedidos anteriores se conservan.
Otros negocios siguen siendo catalogos sin carrito o pedidos habilitados.

## Accesos

- Directorio: Restaurante Mercado [PRUEBA].
- Ficha y menu: /negocios/[businessId] y /negocios/[businessId]/catalogo.
- Cliente de prueba: /piloto/restaurante-mercado. Solo cuentas invitadas pueden confirmar.
- Administrador: /piloto/restaurante. Solo administradores del piloto pueden operar.
- Panel de mi negocio muestra Mi catalogo y Pedidos y visibilidad de la prueba.

## Ocultar

Boton Ocultar prueba del directorio en /piloto/restaurante.
PATCH /api/piloto/restaurante/publicacion pausa nuevos pedidos y pone Estado Inactivo.
No borra ni cancela historiales o entregas. Mostrar vuelve a poner Publicado y habilita
pedidos coordinados. Si falla alguno de los pasos se informa, no se declara completado.

Publicar, editar el catalogo o mostrar la ficha NO crea una orden de Shipday.
Confirmar un pedido lo guarda primero en Mercau; aceptar y marcar Listo solicita el
despacho mediante la integracion existente. El mensajero es real: coordinar antes.
La comida, el recaudo y los precios del restaurante de prueba son ilustrativos.
