# Mi catalogo V1

## Alcance

Productos por negocio, con nombre, descripcion, precio entero en COP, seccion,
disponibilidad, orden y una foto. Estados: borrador, publicado y archivado.
El selector de foto aparece al crear y al editar. Guardar producto conserva primero
sus datos y luego sube la foto seleccionada. Si falla la foto, el producto sigue
guardado y la seleccion permanece para reintentar sin crear otro producto.
No activa carrito, pedidos comerciales, pagos, comisiones ni Shipday.
El piloto de Restaurante Mercado sigue separado y sus pedidos no se modifican.

## Configuracion

Ejecutar el contenido de supabase/business_catalog.sql en el SQL Editor del proyecto
Mercau. Crea una tabla nueva y el bucket privado business-catalog. No reclasifica,
borra ni modifica fichas de Airtable. No se necesitan nuevas claves o proveedores.
Reutiliza NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del servidor.

Las operaciones de productos son exclusivas del backend; anon y authenticated
no tienen permisos directos sobre la tabla. Cada escritura reutiliza la comprobacion
de sesion, correo confirmado, business_admins activo y vinculacion privada de la ficha.
Nunca autorizar propietarios mediante user_metadata ni un business_id del formulario.

## Rutas

- /mi-negocio/[businessId]/catalogo: panel privado, con retorno a Mi cuenta y Mi negocio.
- /negocios/[id]/catalogo: catalogo publico del negocio publicado.
- /api/mi-negocio/[businessId]/catalogo: GET productos propios; POST crear.
- /api/mi-negocio/[businessId]/catalogo/[productId]: PATCH con version y fields.
- /api/mi-negocio/[businessId]/catalogo/[productId]/foto: POST imagen.
- /api/negocios/[businessId]/catalogo: GET productos publicados.
- /api/negocios/[businessId]/catalogo/[productId]/foto: imagen del producto publicado.

El directorio y la ficha muestran Ver menu para Comidas y bebidas o Ver catalogo
para otras categorias, solo si hay productos publicados. No agregan categorias.
Un producto agotado permanece visible pero no ofrece el enlace de consulta individual.
Consultar por WhatsApp inicia una conversacion, no crea ni confirma un pedido.

## Persistencia y errores

Cada producto recibe un UUID generado una vez al iniciar su formulario. Reintentar
una creacion con ese UUID y los mismos datos devuelve el producto guardado.
Las ediciones usan version y una actualizacion condicional; el trigger incrementa version.
Archivar no borra registros y permite restaurar como borrador.

Fotos: JPG/PNG/WebP, maximo 2 MB preparados por el navegador (1600 px, sin recorte).
La carga usa un nombre con UUID y hash, sin sobrescribir archivos. Si la respuesta
de la carga falla, se comprueba el archivo completo antes de continuar un reintento.
Actualizar la foto conserva las anteriores; una carga que no llega a vincularse puede
dejar un archivo huerfano. La limpieza requiere un trabajo posterior autorizado.
No se realiza una transaccion unica entre Postgres y Storage.

Las fotos privadas de administracion usan URLs firmadas de diez minutos.
Las fotos publicas pasan por el servidor y solo se sirven si producto y ficha estan
publicados. Las URLs firmadas ya entregadas al propietario siguen validas hasta expirar.
Para no consultar todo el directorio por cada foto, el servidor comprueba solo su
registro y comparte la comprobacion de publicacion hasta diez segundos por instancia.
Ocultar una ficha puede tardar ese intervalo en retirar el acceso a sus imagenes;
archivar un producto se comprueba directamente en cada solicitud, sin esa cache.
Una politica restrictiva niega el acceso directo de anon y authenticated a este bucket,
sin cambiar el acceso a otros buckets. El servicio del servidor conserva su acceso.

Si Supabase falla, el directorio conserva sus fichas y oculta los accesos a catalogos
que no puede comprobar. La pagina del catalogo distingue error de catalogo vacio.
No contiene productos ficticios ni migra automaticamente el menu de demostracion.

## Referencias oficiales

- https://supabase.com/docs/reference/javascript/storage-from-upload
- https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
- https://supabase.com/docs/guides/storage/buckets/creating-buckets
