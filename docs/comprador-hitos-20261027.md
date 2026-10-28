# Experiencia del comprador: primera entrega de prueba

## Alcance y evidencia

Esta entrega NO esta publicada. No se aplicaron cambios a bases de datos remotas,
secretos, planes, manifest ni service worker. No se generaron pedidos ni despachos
reales. Los nombres y fotografias del modo de vista previa son ficticios.

Se detiene el rediseño antes del checkout para revisar primero Inicio y listados.

## Base de trabajo

- Repositorio existente: https://github.com/financialsoliditysas-ship-it/bajo-cauca-conecta
- Rama local: feat/buyer-experience-20261027. Sin push.
- Commit base consolidado: 4342ee0.
- Produccion inspeccionada: dpl_2icwrVFoA54LAmFdAsaq8WBG6yWb, publicada por CLI.
- Comparacion SHA-1: los 157 archivos disponibles del arbol de fuente de Vercel
  coinciden con account-redesign-20261015. El arbol remoto estaba truncado:
  esta comparacion no prueba identidad de todos los archivos del despliegue.
- Las copias anteriores quedaron intactas. Ningun .env ni .vercel se copio.
- Las dependencias existentes se reutilizan mediante una junction local.

## Rutas de prueba

- http://localhost:3057/comprar
- /comprar/restaurantes, /comprar/comercios, /comprar/explorar
- /comprar/favoritos, /comprar/pedidos, /comprar/cuenta
- /api/comprador/negocios reutiliza el directorio agregado existente.
- MERCAU_BUYER_PREVIEW=1 habilita fixtures SOLO con NODE_ENV=development.
- En esta vista los CTA ficticios son etiquetas, no generan pedidos ni se
  enlazan a fichas inexistentes. Las fichas reales conservan sus enlaces directos.

## Implementado en esta rama

- Inicio orientado a pedir, dos entradas comerciales, busqueda con accion,
  filtros, tarjetas compactas, favoritos secundarios y navegacion de comprador.
- Cuenta existente reutilizada; el acceso al panel comercial es explicito y
  solo aparece cuando la cuenta informa negocios asociados. La autorizacion
  efectiva sigue siendo la de las API existentes.
- Municipio de exploracion persistido localmente; GPS fisico separado en memoria.
  El GPS no decide cobertura ni cambia el municipio manual. Sin geocodificador:
  la accion GPS termina pidiendo elegir municipio, no afirma ordenar por cercania.
- Home sin reemplazo. Accesos protagonistas de envio ocultos en su menu y Nosotros;
  /enviar y herramientas internas siguen existiendo.
- La metrica inicial pasa de Pedido confirmado a Solicitud de pedido recibida.
  Se conserva la clave JSON pedidosConfirmados para compatibilidad y se suman
  eventos historicos y nuevos. El panel muestra Solicitudes de pedido.
- Estado visual de pedidos vertical en la experiencia nueva, usando estados existentes.

## Seguridad: cambios locales y limites

1. /envio/[public_id] ya no obtiene datos privados al renderizar en servidor.
   /api/seguimiento/[publicId] exige usuario confirmado mediante el mecanismo
   existente y verifica customer_user_id o customer_id del pedido comercial.
   Devuelve estado/fechas, no nombres, telefonos, direccion, coordenadas,
   URL del proveedor ni metadata cruda. Cache-Control private,no-store.
   Los identificadores consecutivos permanecen como referencias, no como acceso.
   Pendiente: enlaces revocables para invitados antiguos y acceso operacional
   alternativo desde admin. Invitados sin autoria vinculada deben pedir ayuda;
   no se les concede acceso por telefono o por conocer el identificador.
2. Webhook: exige token tambien cuando el secreto no esta configurado (503).
   Un token incorrecto devuelve 401 antes de procesar el cuerpo o consultar datos.
   Se usa el header token documentado por Shipday, con comparacion de tiempo constante.
   Pendiente: comprobar configuracion efectiva de Shipday y token productivo,
   sin leer ni mostrar el secreto. No esta autorizado desplegar sin esta comprobacion.
3. /api/deliveries requiere requestKey UUID; unicidad y huella normalizada
   impiden crear otro registro al repetir la misma solicitud. Una misma clave
   con datos distintos se rechaza. La clave se conserva en sessionStorage hasta
   respuesta exitosa. El formulario no guarda direcciones en ese almacenamiento.
4. syncOrderToShipday utiliza una reclamacion atomica persistente antes del POST.
   No reenvia si existe ID externo o si ya hubo intento. Un fallo de red o de
   persistencia despues de aceptar el proveedor queda bloqueado para conciliacion.
   No se implementaron reintentos automaticos. Esto favorece detener un despacho
   antes que duplicarlo; no constituye recuperacion automatica completa.
   Pendiente: consola de conciliacion para vincular una orden encontrada en el
   proveedor o autorizar un reintento despues de demostrar que no existe.

## SQL aditivo propuesto

supabase/drafts/delivery_safety.sql es un BORRADOR, no una migracion productiva.
Agrega request_key, request_fingerprint, dispatch_attempted_at, indice unico y
claim_delivery_dispatch, solo ejecutable por service_role. Bloquea pedidos
historicos para conciliacion. No borra tablas, filas, propietarios ni pedidos.

Probado en PostgreSQL local PGlite: dos aplicaciones, unicidad, reclamaciones
repetidas/concurrentes y permisos de funcion. No prueba la configuracion de un
entorno remoto Supabase. Hace falta validar en un entorno aislado aprobado antes
de programar la migracion con historial. No pegar ni ejecutar en produccion aun.

## Shipday y coordenadas

Documentacion: https://docs.shipday.com/reference/insert-delivery-order
El POST /orders admite pickupLatitude, pickupLongitude, deliveryLatitude y
deliveryLongitude. La rama los serializa cuando ambos valores son finitos y
mantiene las instrucciones con enlaces. Se comprobaron valores y omision cuando
no hay coordenadas mediante fetch simulado. No hubo POST real al proveedor.
La confirmacion de destino, ajuste del punto y prueba integrada siguen pendientes
del hito de checkout. No se envia el GPS fisico de exploracion al pedido.

Autenticacion webhook: https://docs.shipday.com/reference/order-status-update-2

## Costos y servicios

- No se agregaron paquetes, servicios, proyectos remotos ni suscripciones.
- Inicio/listados reutilizan React, Next, Airtable y Supabase. La consulta de
  catalogos sigue agregada, no se consulta cada tarjeta por separado.
- Municipio local y GPS usan navegador, sin proveedor nuevo ni tarifa de API.
- La API de tracking consulta cada 15 segundos cuando esta abierta. Es consumo
  de infraestructura existente, no debe presentarse como operacion sin costo.
- Desarrollo usa fixtures y PostgreSQL en memoria, sin consumo de API productiva.
- Supabase: plan Free confirmado por conector. Dos proyectos activos visibles;
  el proyecto Mercau tiene aproximadamente 15.3 MB de base en la consulta hecha.
  Limites publicos Free: 500 MB base, 1 GB archivos, 5 GB egress, 50 mil MAU.
  No se verifico consumo restante de almacenamiento, egress ni MAU.
- Vercel: proyecto y dominio confirmados; plan, saldo y limites efectivos no
  disponibles en la respuesta de la cuenta. No se cambio configuracion de gasto.
- Airtable, Shipday y correo: sus planes/cuotas actuales siguen sin verificar.
- No se incorporo mapa. Antes de incorporarlo se debe presentar proveedor,
  licencia/condiciones, costo fijo, costo por uso, limites y alternativa.
- No se configuraron limites productivos: requiere conocer el plan y permiso
  para cambiar configuracion. No hay nueva facturacion activada.

Fuentes: https://supabase.com/pricing y https://vercel.com/pricing

## Pruebas y alcance

- node scripts/test-account-suite.cjs: 21 suites aisladas.
- node scripts/test-buyer-security.cjs: autenticacion de webhook, API sin sesion,
  aislamiento entre usuarios, salida minimizada, pedido comercial vinculado,
  duplicados, fallo al persistir tras respuesta de proveedor, campos de coordenadas,
  permisos SQL y bloqueo de un segundo intento. Proveedor completamente simulado.
- node scripts/test-buyer-ui.cjs: Chrome de escritorio headless a 320,390,768,1440.
  Prueba imagenes cargadas, columnas, ausencia de overflow, filtros, busqueda,
  favoritos, municipio persistido, GPS Medellin simulado con destino Nechi,
  tracking sin sesion 401 y webhook sin configuracion 503.
- Typecheck, lint y build local. Lint conserva avisos de img y hooks heredados.
- Se corrigio una asercion heredada que esperaba el antiguo logo global en
  Open Graph, aunque la fuente base ya devolvia el endpoint por negocio.
- No se probaron dispositivos Android/iPhone reales, PWA instalada, cuentas
  reales, compras completas, push real, pagos, ni despachos reales.

Capturas: outputs/buyer-home-<ancho>.png, buyer-restaurants-<ancho>.png,
buyer-commerce-<ancho>.png. No se versionan archivos de salida.

## Pendiente despues de revision visual

- Precisar tipo comercial de servicios: el catalogo actual no tiene un campo de
  tipo de item. Se conservan Ver menu/Ver catalogo, sin inferir Ver servicios.
- Destino confirmado del pedido, campo barrio opcional, formulario y mapa.
- Recogida habilitable por negocio, sin despacho, costo o estados de transporte.
- Nueva revision del pedido, recalculo de cobertura/destino en servidor.
- Seguimiento, novedades, demora y ayuda de pedido mas completos.
- Cuentas autenticadas reales en entorno de prueba sin datos productivos.
- Configuracion efectiva de webhook, conciliacion y recuperacion segura.

## PWA, despliegue y reversion

- Manifest, start_url, scope, id y service worker permanecen intactos.
- /comprar funciona como ruta explicita desde navegador; no hay deteccion de
  instalado como unico criterio de entrada. Las PWA actuales siguen abriendo /.
- Antes de actualizar PWA: registrar identidad actual y probar actualizacion
  en instalaciones reales, enlaces profundos, sesion y caché. No cambiar id o
  start_url sin revisar duplicados y recuperacion.
- Antes de publicar: revision visual, resolver pendientes criticos, entorno
  de prueba con esquema y variables aisladas, SQL aprobado, pruebas integradas,
  preview en el proyecto existente y aprobacion explicita de produccion.
- No se hizo push: el control de publicacion no se activa por esta rama local.
- Reversion de prueba: volver al commit base 4342ee0 en otra rama, sin resetear
  las carpetas originales. En una futura publicacion, conservar el deployment
  anterior y promoverlo solo con autorizacion. Las columnas aditivas pueden
  permanecer, no se borran datos para revertir la interfaz.
- Tras empezar a usar la proteccion de despacho, no revertir a codigo que la
  ignore: podria reintentar envios inciertos. La reversion debe mantener el
  bloqueo operativo o desactivar despachos hasta conciliar.
