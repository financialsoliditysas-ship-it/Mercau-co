# Rendimiento y cortes de conexion

Estado: candidato local. Sin push, despliegue, SQL, cambios de secretos o planes.
Base productiva conservada: `9d63cd7`, `dpl_6Y6iVq64xCJszpVNbCnQjg7s6m4y`.

## Auditoria y mediciones

El worker publicado tenia notificaciones, pero su listener de fetch no almacenaba recursos.
El directorio solo conservaba una copia en memoria durante 30 segundos. El carrito ya usaba
sessionStorage, separado por restaurante. No existia una compra offline ni se incorpora ahora.

Muestras GET reales anteriores al cambio, desde este computador, tres por ruta:

| Ruta | Primera lectura | Siguientes | Bytes JSON decodificados |
| --- | --- | --- | --- |
| Directorio comprador | 6711 ms | 622 / 558 ms | 42607 |
| Primera pagina de productos | 1867 ms | 885 / 975 ms | 3448 |
| Menu Asados Tic Tac | 636 ms | 492 / 657 ms | 9145 |

No son tiempos universales ni una prueba de carga. No permiten atribuir la primera demora
exclusivamente a Airtable, Supabase, Vercel o a la conexion. Evidencia:
`outputs/resilience/production-baseline.json`. No se promete una latencia fija en milisegundos.

## Cambios

- Directorio, secciones y paginas publicas: reutilizacion de 10 segundos y deduplicacion de
  consultas simultaneas. Los caches son acotados y por instancia, no un almacen distribuido.
- Los bloques siguen trayendo hasta ocho productos; no se descargan todos los menus al entrar.
- Tarjetas memoizadas y formateador monetario reutilizado para no recalcular cada tarjeta al
  agregar bloques o cambiar el indicador de carga. Sin cambio de diseno, cantidades o precios.
- Ficha: catalogo, ajustes publicos y galeria se consultan en paralelo, no de forma consecutiva.
- El navegador reutiliza consultas publicas diez segundos (menu cinco) y conserva respuestas
  consultadas en la sesion hasta quince minutos como respaldo indicado al usuario.
- Solo se admiten los endpoints publicos de directorio, descubrimiento y menu comercial.
  No se almacenan respuestas de perfil, pedidos, pagos, notificaciones, administracion ni tokens.
- Maximo 24 respuestas de sesion, hasta 250000 caracteres por respuesta. El caché no persiste
  indefinidamente ni garantiza conservar todo un catalogo grande.
- Ante un corte permanece visible lo cargado. El menu guardado se identifica como tal; una
  consulta inexistente no se inventa. Errores de permisos o publicacion no usan respaldo antiguo.
- Sin conexion indicada por el navegador, confirmar un pedido se detiene antes de crear una
  referencia nueva. No hay cola ni envio automatico al reconectar. Ante una confirmacion incierta
  se conservan las referencias y controles de idempotencia ya existentes.

Los datos de presentacion pueden demorarse unos segundos en reflejar una edicion; los niveles
de reutilizacion pueden sumarse. No se cambiaron las validaciones actuales del servidor al
crear pedidos, sus precios autorizados, pagos, QR, comisiones, propietarios ni Shipday.

## Worker y privacidad

`mercau-sw.js` incorpora exclusivamente `mercau-public-cache-v1.js`. Los manejadores de push,
click y separacion de cliente/restaurante permanecen identicos; la prueba de contrato conserva
su hash previo descontando esa linea de importacion explicita. Manifest, identidad, scope,
start_url, iconos y splash no cambian.

- Recursos estaticos publicos y miniaturas ya descargadas; no precarga masiva de fotografias.
- Limite de 64 entradas y 12 MiB, sin almacenar respuestas mayores a 1 MiB. Ayuda offline y
  logo protegidos de la limpieza normal; fallo de cuota no impide responder a la red.
- JS/CSS/fonts con nombres de version reutilizados; miniaturas comprobadas por red primero.
  Un 403/404 online elimina la copia. Respaldo de imagenes durante corte: maximo 15 minutos.
- No se usa cache compartido CDN para fotografias ni se retiran verificaciones de publicacion.
- Escritura de cache en segundo plano; cabeceras de compresion/tamano ajustadas al contenido
  ya decodificado. No almacena recursos redirigidos a otra pagina.
- POST/PATCH/DELETE, peticiones con Authorization y APIs privadas no se interceptan.
- No se guardan paginas HTML dinamicas. Una navegacion nueva sin internet muestra `offline.html`,
  no una pantalla de pedido o cuenta potencialmente desactualizada.

Esto NO es navegacion completa offline. Abrir pantallas nuevas, iniciar sesion, consultar un
seguimiento actualizado, conocer disponibilidad actual y confirmar pedidos necesitan conexion.
El carrito conserva su mecanismo de sesion existente: no se garantiza recuperarlo si el sistema
cierra o borra la sesion del navegador, ni sincronizarlo entre dispositivos sin conexion.

## Pruebas

- `test-public-resilience.cjs`: 30 lecturas simultaneas del mismo dato -> una carga en la
  instancia simulada; 20 lecturas de cliente -> un GET. TTL, restauracion, cuota, limites,
  exclusiones privadas, revocacion y errores sin esconder fallos de permisos.
- `test-catalog-performance.cjs`: miniatura de 320 px en imagen sintetica: 1222512 -> 16790
  bytes. Es la optimizacion existente revalidada, no una promesa de ahorro para toda foto real.
- Suites, lint, build y TypeScript del corte. Logs: `outputs/logistics-controls/`.
- Chrome local emulado: corte de red, carrito visible y sin borrarse, ayuda de navegacion offline,
  regreso al Inicio al reconectar; worker instalado, sin respuestas privadas almacenadas.
  Evidencia: `outputs/resilience/browser-results.json`, `offline-cart-390.png`,
  `offline-navigation-390.png`.
- Recorrido de productos/carrito en 320, 390, 768 y 1440 px con snapshot publico aislado;
  se mantienen personalizaciones, precios, cambios de restaurante y navegacion.
- Sin pedidos, cobros, push o despachos reales. No son pruebas fisicas de Android/iPhone.

## Costos, capacidad y pendientes

No hay dependencias, proveedores, suscripciones ni recursos nuevos. No se modificaron planes
ni facturacion. Se usan peticiones y almacenamiento de la infraestructura actual. No se ha
calculado un costo incremental mensual; dependera del trafico real y del plan contratado.

La consulta de metadatos de Vercel confirma Next.js y Node 22.x, pero no expone el plan ni
la cuota disponible. No se verificaron los limites/consumos actuales de todas las cuentas.
No se puede afirmar una cantidad soportada de usuarios simultaneos ni ausencia de saturacion.
No se hicieron pruebas de estres en produccion. Para cifras de capacidad hace falta un escenario
aislado de carga y contrastar el consumo con los limites actuales; no implica contratar servicios.

Otra limitacion detectada: el lector actual de negocios del directorio usa una pagina Airtable
de 100 registros. Si se supera ese numero de fichas publicadas, habra que completar esa
paginacion. No se modifica silenciosamente aqui un lector compartido por administracion.
La consulta publica del 2026-10-31 devolvio 44 fichas: ese limite no se alcanza hoy.

## Publicacion y reversion

Requiere autorizacion de despliegue. Publicar todos los archivos del worker junto con el nuevo
HTML de ayuda y sus componentes. No hay migraciones ni cambios externos.
Comprobar primero GET publicos, luego un dispositivo instalado ya existente y otro navegador.
Verificar offline con contenido previamente consultado, reconexion sin envio automatico y push
en una prueba coordinada, no mediante mensajes reales automaticos.

Restaurar el despliegue anterior si falla un recorrido critico. El worker anterior, servido en
la misma URL, recupera el control al actualizarse online; una app sin red no puede recibir esa
reversion inmediatamente. No cambiar la identidad ni pedir reinstalacion como primer recurso.
El cache publico local puede permanecer ocupando espacio, pero el worker anterior no lo usa.
