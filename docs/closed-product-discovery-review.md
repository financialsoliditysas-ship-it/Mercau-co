# Productos visibles fuera del horario comercial

Propuesta local autorizada, no publicada.

Solo se cambia la visibilidad por cierre de horario: se mantienen las restricciones
de negocio pausado administrativamente, prueba privada, producto no publicado,
agotado/no disponible, precio invalido y municipio. No se modifican esos datos.

La consulta agrupada de horarios existente ahora clasifica, no oculta. Primero
pagina todos los productos de negocios abiertos y despues los cerrados, conservando
el intercalado entre restaurantes dentro de cada grupo y miniaturas optimizadas.
No se descargan todos los catalogos para ordenar. Las categorias incluyen oferta
cerrada publicada y las busquedas pueden encontrarla.

El cursor conserva el instante de orden inicial para evitar duplicar/perder productos
si un negocio cierra mientras se pagina. La disponibilidad de cada producto se
evalua con el reloj actual, no con ese instante. Los cursores anteriores se aceptan.

Las tarjetas cerradas mantienen fotografia y precio, muestran Cerrado y permiten
abrir el detalle. El icono de consulta sustituye al signo de agregar. La proxima
apertura solo se muestra cuando se encuentra un turno valido guardado en los
siguientes siete dias, respetando dias especiales. No se predice reapertura durante
un cierre temporal ni se inventa un horario ausente.

El detalle cerrado usa el componente existente en modo de consulta: descripcion,
precio y opciones visibles; no se puede agregar al carrito. El bloqueo de nuevas
compras en el servidor permanece sin cambios. Los pedidos ya recibidos siguen su
curso. Sin reservas, pedidos programados, pagos nuevos ni cambios de Shipday.

Sin librerias, proveedores, migraciones, permisos o planes nuevos. Se utilizan las
consultas agrupadas existentes y el mismo limite de productos por pagina. Mas
oferta visible puede implicar mas miniaturas si el usuario sigue desplazandose;
no se afirma ahorro de datos por ocultar menos contenido.

Pruebas: visibilidad de cerrados, abiertos antes de cerrados, todos cerrados,
busqueda, paginacion sin duplicados al cruzar un cierre, apertura calculada desde
turnos y excepciones guardados, bloqueo de compra existente y verificacion visual
emulada. No se generan pedidos reales. Pendiente aprobacion y despliegue.

Reversion: restaurar el despliegue anterior; no hay cambios de datos que revertir.
