# Correcciones solicitadas tras la publicacion

Estado: cambios locales para revision antes de desplegar. No autoriza push, publicacion, migracion o cambios de configuracion operativa.

## Cambios acotados

1. En Mercau a un toque se elimina el enlace Android que abria /instalar. El boton existente usa beforeinstallprompt desde el mismo clic cuando el navegador lo permite. Si Chrome no ofrece el evento o falla, la ayuda aparece en la pagina, sin redireccion. No se puede obligar al navegador a mostrar su dialogo nativo. La ayuda iPhone/copiar enlace no se modifica.
2. El encabezado del comprador incorpora Portada solo en navegador, tanto movil como escritorio. En modo standalone o navigator.standalone se oculta; la PWA instalada sigue orientada a comprar. No se cambia manifest, worker, puente de apertura ni enlaces directos.
3. Carga: lecturas independientes de Airtable en paralelo y enlaces/catalogos del directorio tambien en paralelo. En el cliente se reutiliza el ultimo listado publico por hasta 30 segundos mientras se actualiza en segundo plano; solicitudes simultaneas comparten una promesa. No se persisten datos en disco ni se guardan precios, pedidos o estados privados. No se consulta el directorio al abrir cuenta/pedidos. El menu y la confirmacion siguen utilizando las consultas operativas existentes sin cache nueva. No se certifica una mejora de latencia productiva antes de publicar.
4. Solo Explorar ordena primero negocios con contenido publicado y, dentro de cada grupo, los que tienen imagen/logo. Los empates conservan orden original. No se ocultan fichas ni cambian favoritos, filtros, precio o criterios de publicacion.
5. En el menu visual la barra de categorias queda fija al desplazar productos. Cuando esta seleccionado Todo, el desplazamiento destaca la categoria del producto visible sin ocultar productos. El clic manual sigue filtrando como antes y lleva al inicio de esa seleccion. No modifica productos, calculos, personalizaciones o carrito.
6. /piloto/restaurante-mercado recibe visualMenu. Conserva los avisos de prueba, la autenticacion y el acceso por invitacion existente. /piloto/restaurante, panel que recibe pedidos, no cambia.

## Choli: diagnostico de solo lectura

El endpoint publico consultado en produccion devuelve para `recZQzu4If5VE0Egr`: HTTP 200, live true, enabled false, 22 productos. Kikiriki devuelve enabled true y 5 productos; el restaurante de demostracion enabled true y 9 productos.

El boton bloqueado de Choli coincide con la pausa guardada, no demuestra un fallo del carrito. En /admin/negocios hay un checkbox Recibir pedidos y una accion Guardar configuracion separada. El servidor exige ficha vinculada, telefono operativo, direccion de recogida cuando utiliza Mercau y al menos un producto publicado disponible. Los errores se muestran y no habilitan pedidos si falta un requisito.

No se pudo verificar con esta lectura si el usuario no guardo, recibio una validacion o alguien pauso despues. No se consultaron clientes, propietarios, pedidos, secretos ni historial privado. No se cambio enabled ni se retiraron validaciones.

Impacto si se autoriza activar Choli posteriormente: permitira recibir solicitudes reales y utilizara sus condiciones/logistica vigentes al despachar. Esa operacion no forma parte de estos cambios visuales y no se ejecuto.

## Costos y limites

Sin servicios, dependencias, mapas, planes o suscripciones nuevos. Se reutiliza la infraestructura actual; las lecturas existentes pueden consumir su cuota. No se modifican pagos, QR, comisiones, API de pedidos ni Shipday.

## Verificacion prevista

Suite existente, contrato productivo, typecheck, lint y build en exportacion limpia del commit. Test adicional de ranking, TTL, solicitudes concurrentes y modo de demostracion. Navegador emulado en 320/390/768/1440: prompt simulado y ayuda sin evento, mismo URL, retorno Portada solo en navegador, categorias sticky, cambio activo por scroll sin filtrar y filtro manual preservado. No equivale a una instalacion real en Redmi Note 15 Pro o iPhone.

No generar pedidos, cobros o despachos. Presentar resultados y el punto de Choli pendiente antes de solicitar autorizacion de publicacion.
