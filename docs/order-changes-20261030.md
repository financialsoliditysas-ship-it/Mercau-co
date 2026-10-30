# Propuestas de cambio y avisos al comprador

Estado actual: publicado con autorizacion, segun el cierre siguiente. Rama `feat/order-change-proposals-20261030`, sobre el corte `217c140` y su registro de activacion `5326703`. Se conserva mas abajo la documentacion de diseno y validacion local anterior a publicar.

## Publicacion autorizada, 30 de octubre de 2026

Este cierre sustituye el estado local inicial del desarrollo. El usuario autorizo publicar despues de aprobar el resumen compacto.

- Commit publicado: `be724dd33c31f1646d2c4ba062c997bdf86c41b3`. Rama propia subida sin forzar ni cambiar main.
- Vercel: `dpl_7kskyMWCnP2pwVbQx2htGoDMbRyq`, `mercau-d0t56p17m-financial-soliditys-projects.vercel.app`, READY y asignado a www.mercau.co y mercau.co. Se utilizo el despliegue Git autorizado `dpl_B4LQtMXGNFKVCnfgYhfwGAL3teTn` como origen y se reconstruyo expresamente con target production mediante create_deployment/deploymentId. No se falsearon autorias ni se cambiaron miembros, planes o conexiones para evitar el bloqueo previo del CLI.
- Migracion aplicada por MCP: version remota `20261030190918`, nombre `order_change_proposals`, archivo local `20261030174526_order_change_proposals.sql`, SHA256 `8FD059C87E6508AEDD4F3CA1D27CC3361C9E15374D6E4DD98B38A3E9CA1657FF`.
- Configuracion nueva no secreta: ORDER_CHANGES_ENABLED=true, unicamente production, creada antes del build. Las claves WEB_PUSH actuales se comprobaron por metadatos, sin leer ni modificar sus valores. Sin nuevos proveedores, planes, facturacion, claves ni suscripciones.
- Preflight de solo lectura: 47 pedidos y 47 snapshots, 46 envios entregados y uno cancelado, sin envios activos. Columnas y permisos del esquema actual compatibles. Se verificaron las funciones existentes de transicion y snapshot financiero; sus definiciones conservaron las huellas anteriores tras el SQL.
- Verificacion de permisos productivos: tablas nuevas con RLS, sin SELECT para anon/authenticated ni DELETE para service_role; el servidor puede actualizar status, pero no old_lines de la auditoria. Tres funciones SECURITY INVOKER con search_path vacio, ejecutables por el servidor y no por clientes; trigger de bloqueo habilitado.
- Las huellas de pedidos, finanzas e historiales anteriores permanecieron iguales. No se generaron pedidos, cobros, avisos ni despachos reales durante la publicacion.
- HTTP publico: /, /comprar, /comprar/pedidos y /piloto/restaurante 200; /api/push/comprador sin sesion 401; POST sin sesion a /api/pedidos/cambios y webhook 401; /qa y /api/qa 404. Los once scripts publicos del piloto incluyen el detalle compacto y su accion; /mercau-sw.js sirve ambos eventos push con public, max-age=0, must-revalidate. La consulta agrupada de errores/fatales del despliegue no devolvio grupos en los diez minutos consultados.
- Pruebas previas: 29 suites, lint con advertencias anteriores, typecheck y build, mas Chrome emulado en 320/390 px. No equivalen a probar la entrega del push ni dispositivos fisicos.
- Pendientes: primer pedido/propuesta real coordinado y permiso/recepcion en Android/iPhone. El telefono que mostraba el panel anterior sigue igual; su minimizacion por tipo de entrega requiere una decision separada.
- Advisors: solo dos avisos informativos nuevos de RLS sin politicas para las tablas de servidor, sin acceso de clientes. Se mantienen dos advertencias anteriores de search_path y una de proteccion de contrasenas filtradas; no se cambiaron fuera de este alcance. Referencias: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy y https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Reversion identificada: `dpl_B7FLn59GVmayW3w3exw2SPKhVXAX`. Antes de revertir o apagar la opcion, comprobar que no quedan propuestas pending/declined y resolverlas mediante acciones autorizadas. Conservar tablas e historial. No quitar el trigger para forzar un despacho. La version previa conserva los controles de duplicidad, pero no ofrece interfaz para estas propuestas.

## Funcionamiento

- Negocio: en Opciones del pedido puede seleccionar productos agotados y proponer reemplazos del menu disponible o retirar lineas. No hay chat, mensajes libres ni nuevos enlaces de contacto. La cantidad de cada linea se conserva: esta V1 no divide cantidades de una misma linea.
- Los reemplazos reutilizan la validacion de productos y personalizaciones del pedido actual. El servidor toma los precios del menu, nunca los importes enviados por el navegador. Las observaciones originales se muestran al comparar; no se trasladan silenciosamente a otro producto.
- Comprador: ve pedido original, propuesta, opciones y total con el mismo domicilio. Aceptar exige confirmacion explicita. No aceptar rechaza la propuesta, no cancela automaticamente la compra. El negocio debe proponer otra alternativa, retirar la propuesta si puede atender el original, o usar el rechazo de pedido existente cuando corresponda.
- Solo pedidos pendientes o aceptados sin envio vinculado. Pagos confirmados, liquidaciones o movimientos financieros existentes impiden modificar importes: requieren soporte. No se cambia la politica de pagos, QR, tasas pactadas ni integracion Shipday.
- Una propuesta pendiente o no aceptada bloquea la aceptacion/despacho por trigger SQL, incluso si alguien omite los botones. El rechazo comercial existente cancela la propuesta. El silencio no autoriza cambios.
- Aceptar actualiza productos y snapshot financiero en una transaccion con bloqueo de fila. Usa la comision original del snapshot, conserva el domicilio y sus repartos, y guarda las versiones financieras anterior y posterior en la propuesta privada. No modifica el libro de cobros ya asentados, recibos de idempotencia ni referencia del pedido.
- Reintentos de la misma propuesta usan su UUID; respuestas repetidas no vuelven a recalcular ni duplican el historial. Las pruebas locales comprueban esto, no constituyen una garantia sobre todas las condiciones operativas.

## Push y consumo

Se reutilizan web-push, las claves VAPID actuales, el worker y Supabase existentes. No se instala proveedor ni dependencia nueva, no se cambian claves, planes ni suscripciones. No se verificaron saldos de cuota o limites actuales de consumo en esta tarea: NO afirmar costo adicional cero. Su eventual habilitacion debe revisar las cuotas del plan actual antes de publicar.

La suscripcion del comprador es privada y esta vinculada a su cuenta. El permiso del navegador solo se solicita tras tocar Activar notificaciones. En dispositivos no compatibles se conserva el acceso a Mis pedidos y se ofrece ayuda de instalacion. La notificacion no incluye telefono, direccion, productos, total ni nombre del cliente; conduce a su detalle autenticado en /comprar/pedidos. Poseer el enlace no autoriza consultar pedidos ajenos.

Limites: hasta cinco dispositivos consultados por aviso, TTL de cinco minutos, timeout de envio de cinco segundos y hasta diez propuestas por pedido. La lista del comprador actualiza cada 15 segundos solo con la pagina visible, ademas de foco y avisos del worker. El push puede fallar o no entregarse: el pedido conserva la propuesta en la plataforma. Un reintento ya registrado no emite otro push; si el primer aviso falla no hay un sistema nuevo de reenvio automatico en esta V1.

En un dispositivo compartido, el permiso push pertenece al navegador. Los mensajes son genericos y abrirlos exige la cuenta del pedido. Desactivar los avisos de comprador no desuscribe globalmente el endpoint, porque podria compartirlo con los avisos de restaurante. No se ha redisenado el cierre de sesion ni la administracion de dispositivos.

El worker solo distingue MERCAU_CUSTOMER_ORDER_CHANGE de MERCAU_NEW_ORDER_PUSH. Conserva caché, navegacion de notificaciones y comportamiento de las alertas de negocio. No se modifica manifest ni identidad PWA. La actualizacion real del worker y la recepcion con Android/iPhone fisicos siguen pendientes.

## Permisos y activacion futura

- Migracion aditiva preparada, sin ejecutar: `supabase/migrations/20261030174526_order_change_proposals.sql`. Tablas privadas con RLS y sin acceso anon/authenticated; funciones SECURITY INVOKER con search_path vacio, disponibles solo al servidor. Se revocan permisos predeterminados antes de conceder los estrictamente usados.
- Flag de servidor `ORDER_CHANGES_ENABLED=true`; por defecto esta desactivado. Con flag apagado, las consultas actuales no dependen de tablas nuevas. No se incorporan datos ficticios a las rutas reales.
- Antes de activar: revisar cuotas/configuracion sin exponer claves; aprobar migracion y despliegue; comprobar esquema, aplicar migracion, desplegar y habilitar el flag. No habilitarlo antes de que existan sus tablas/funciones.
- Para revertir: NO apagar el flag ni volver a una interfaz sin propuestas mientras queden propuestas pendientes/no aceptadas. Resolverlas primero con las acciones autorizadas. Conservar tablas, auditoria y controles de bloqueo; no borrar recibos ni retirar protecciones para forzar un despacho.

## Privacidad pendiente de decision

El panel productivo anterior ya muestra telefono, nombre y direccion al administrador del negocio. Se encontro en `components/RestaurantPilot.tsx` y su consulta autorizada de gerente. Esta funcion NO agrega datos de contacto ni abre comunicacion directa, pero tampoco retira ese acceso existente. Para el objetivo comercial de no facilitar contacto externo, falta decidir una minimizacion por tipo de entrega (Mercau o domiciliario propio) y por estado. No presentar esta V1 como si ya hubiera ocultado todos los telefonos del panel anterior.

## Evidencia y limites de prueba

`scripts/test-order-changes.cjs`: esquema SQL versionado en PGlite aislado, autorizacion, bloqueo de despacho incluso al insertar un envio dentro de una transaccion revertida, aceptacion y repeticion, cambios rechazados, pedidos rechazados/pagados, comision pactada, importes grandes sin desbordamiento, auditoria, RLS, precios/opciones de catalogo en servidor, suscripcion privada, endpoints push restringidos y separacion de eventos del worker. Llamadas externas simuladas.

`qa/test-order-changes-ui.cjs`: componentes de negocio y comprador en Chrome a 320/390 px; servicios/sesion ficticios e interceptados. No declarar estos recorridos como pruebas fisicas ni como integracion con Supabase alojado o push entregado.

La galeria generada en `outputs/order-changes/galeria-cambios-pedido.html` incluye imagenes base64 y solo datos ficticios. Es un artefacto local fuera del paquete de produccion.

### Ajuste visual compacto aprobado

Se muestran primero solamente las lineas afectadas y los totales anterior/propuesto. El pedido completo, ingredientes, personalizaciones y desglose siguen disponibles en Ver ingredientes y detalle, cerrado inicialmente. Los botones Aceptar cambio y No aceptar permanecen fuera del desglose. La edicion del negocio continua plegada en Opciones del pedido. No cambia el POST, la confirmacion explicita, SQL, precios, permisos ni despacho. Si una linea historica no tiene identidad estable, no se inventa una correspondencia: su informacion sigue en el detalle completo.

El archivo `outputs/order-changes/galeria-cambios-pedido-antes-compactar.html` conserva la galeria anterior. `scripts/test-order-change-presentation.cjs` comprueba el resumen, retiros, opciones modificadas y detalle/editor plegados; el recorrido Chrome verifica que el detalle se abre y cierra antes de responder.

Verificacion del ajuste compacto: 29 suites, lint, build y typecheck aprobados. Recorrido Chrome emulado aprobado en 320 y 390 px, incluida apertura/cierre del desglose y las confirmaciones existentes. Galeria actualizada con vistas del negocio cerrado/abierto y del comprador. Sin push, despliegue ni cambios de base de datos.

Resultado local: 28 suites aisladas aprobadas, lint aprobado con advertencias anteriores, build y typecheck aprobados. Prueba adicional del rol service_role: puede proponer/aceptar mediante las funciones autorizadas, pero no reescribir los productos originales de la auditoria. La comprobacion Chrome paso en 320 y 390 px: propuesta del negocio, bloqueo del boton de aceptacion mientras espera, apertura del detalle mediante enlace, confirmacion cancelada sin escritura, aceptacion con una sola respuesta, rechazo del permiso push con alternativa en Mis pedidos y ausencia de desbordamiento horizontal. Se corrigio una interferencia del CSS anterior que ocultaba el texto del boton de enviar; el test ahora verifica su fondo rojo y texto blanco. Se comprobo que la accion de aceptar es accesible mediante desplazamiento del dialogo y no queda tapada. No se enviaron pushes reales ni se probaron dispositivos fisicos.
