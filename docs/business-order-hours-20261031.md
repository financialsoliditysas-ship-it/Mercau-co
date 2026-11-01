# Recepcion de pedidos segun horario guardado

Usa solo `business_account_settings.data`: schedule (lunes a domingo), specialHours
y temporaryClosed. Zona horaria America/Bogota. Cada turno incluye la hora inicial
y excluye la final. No interpreta texto libre ni modifica horarios de negocios.
No se cambia el domingo de Ocre 08:08 por 08:00.

Sin horario estructurado, conserva la habilitacion administrativa existente; no
inventa horarios. Horario estructurado invalido o lectura fallida: no ofrece nuevas
compras hasta comprobarlo. El menu sigue consultable fuera de horario.

El listado de productos comprables filtra negocios cerrados con una consulta agrupada.
El menu expone disponibilidad efectiva y el motivo. Una consulta ligera comprueba
disponibilidad cada 30 segundos mientras la pantalla esta visible y al volver o
reconectar, sin descargar de nuevo productos e imagenes.

La creacion comprueba los horarios del servidor. Si esta cerrado, consulta el recibo
propio del intento: solo un intento ya registrado pasa al RPC existente, que conserva
su validacion de fingerprint. Una compra nueva se rechaza antes de crear un pedido.
La gestion y el seguimiento de pedidos existentes no dependen de estar abierto.
No modifica pagos, precios, QR, estados, despachos, permisos o SQL.

Costos: infraestructura existente, sin dependencias ni servicios nuevos. La consulta
ligera y la lectura agrupada usan los limites actuales; no se cuantifica un costo
mensual adicional sin datos de trafico. No se cambian planes.

Pruebas aisladas: turnos partidos, limites de cierre, Colombia, domingo 08:08, lunes,
excepciones y cierre temporal, menu cerrado, ofertas excluidas, rechazo de nuevas
compras y recuperacion de recibos existentes sin otro push. Ningun pedido real.

Reversion: restaurar el despliegue anterior; no hay migraciones ni cambios de datos.
