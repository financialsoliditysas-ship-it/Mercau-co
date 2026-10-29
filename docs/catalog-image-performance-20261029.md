# Optimizacion local de imagenes y catalogos

Base: produccion 401fc47. Rama local: perf/catalog-images-20261029. Sin push ni publicacion.

## Alcance

- Variante w=320/640/960 solo en la ruta de fotos de productos. Sin parametro conserva el original. Sin recortes, ampliaciones ni reemplazo de archivos guardados.
- WebP cuando el navegador lo anuncia; JPEG/PNG cuando no. Si falla el procesamiento o no reduce bytes, conserva el original.
- Las tarjetas usan srcset/sizes y las primeras imagenes tienen prioridad. Las siguientes mantienen carga diferida. El detalle de producto mantiene la imagen original.
- Logos/fotos del directorio: se priorizan las primeras tarjetas y se difiere el resto; no se alteran los adjuntos o su ruta.
- Respuesta privada con ETag y revalidacion obligatoria. Antes de responder 200 o 304 se comprueban producto publicado, pertenencia de la imagen y publicacion del negocio. No hay cache compartida de CDN ni TTL positivo nuevo en el navegador.
- Se conserva el agrupamiento previo de 10 segundos en catalogBusinessPublic. No se afirma que el cambio de estado del negocio se lea de Airtable en cada peticion. El producto y su ruta/version se consultan en cada peticion.
- Cache de bytes por proceso: 16 MiB, 64 entradas, 60 segundos. Clave derivada de negocio/producto/ruta/version/ancho/formato. No contiene permisos, perfiles, precios o estados de pedidos. Cambio de ruta/version cambia la clave; borrador/archivo/ruta nula o ajena se rechazan antes de usarla.
- Dos trabajos simultaneos por proceso, hasta 16 pendientes; si se supera el limite conserva la entrega original sin transformacion. Maximo 2 MiB de entrada y 8 megapixeles para transformar. Sin tareas masivas sobre Storage.
- Lectura del directorio reutilizada por render con React.cache cuando existe, sin cache persistente entre compradores. Entornos React que no lo ofrecen conservan el lector original.
- Catalogo y configuracion existente de restaurante se leen en paralelo manteniendo las funciones, errores y condiciones originales. No se cambia pilotRestaurant ni ninguna escritura de pedidos.

## Costos y dependencia

Sharp 0.35.5, proveedor proyecto open-source Sharp/lovell, licencia Apache-2.0: sin tarifa de licencia, suscripcion o llamada a API. Ejecuta en la funcion existente de Node; CPU, memoria y trafico siguen sujetos a la cuota/cobro del alojamiento actual. No se certifico el margen restante del plan. No se activaron facturacion, planes, optimizadores de pago, bucket publico, transformaciones Supabase o servicio externo nuevo.

La alternativa sin Sharp es conservar originales y mejorar solo las consultas/prioridades; no reduce los bytes de fotos existentes. El lockfile se actualiza con pnpm y registra los binarios opcionales de plataforma de Sharp. ESLint root:true impide heredar una segunda configuracion ajena al probar la exportacion anidada; no desactiva reglas.

## Medicion local de fotos publicas

Tres archivos publicos de Ocre descargados por lectura a outputs/image-performance-20261029, sin cambiarlos en produccion:

| Original | 320 px WebP | Reduccion | 640 px WebP | Reduccion |
|---|---|---|---|---|
| 573135 bytes | 12424 bytes | 97,8 % | 39754 bytes | 93,1 % |
| 144320 bytes | 5098 bytes | 96,5 % | 13646 bytes | 90,5 % |
| 412745 bytes | 13686 bytes | 96,7 % | 64200 bytes | 84,4 % |

No extrapolar estos porcentajes a toda la velocidad de la aplicacion. No son una medicion de produccion despues de desplegar. Se conserva evidencia del diagnostico publico anterior y del procesamiento local.

## Pruebas y operacion

scripts/test-catalog-performance.cjs comprueba variantes, bytes, formatos, original, revalidacion, retiro de publicacion aun con ETag, borrador/archivo, ruta ajena, cambio de version/ruta, entradas invalidas, deduplicacion, expiracion/eviccion y fallback por imagen corrupta. Datos sinteticos.

qa/test-catalog-images-ui.cjs verifica menus/catalogos con componentes reales y servicios simulados en 320/390/768/1440; tambien compara la misma imagen original/miniatura con red emulada de 1,5 Mbps y 150 ms. No prueba dispositivos fisicos ni produccion; no confirma pedidos ni despacha mensajeros.

Incidencias encontradas durante desarrollo: React.cache ausente en React standalone, corregido con lector alternativo; conflicto de plugins ESLint por configuracion de carpeta superior, corregido delimitando la raiz. Conservar logs de intentos anteriores, sin presentarlos como aprobados.

## Resultados finales

Runtime comprobado: ace37c2. Pasaron 22 suites existentes, prueba especifica de fotos, lint, typecheck, build, ocho recorridos de navegacion, recorridos integrales y restricciones QA/chunks publicos. El contrato de pedidos, pagos, QR y Shipday se conserva.

Navegador emulado: menus y catalogos en 320/390/768/1440, variantes acotadas, carga diferida fuera de primeras tarjetas, sin overflow, respuesta condicional 304 y rechazo de anchos arbitrarios. La prueba se ajusto para permitir que el navegador reutilice una miniatura mayor que ya descargara para la portada; no corresponde exigir siempre la menor variante si otra ya esta disponible.

Red local emulada a 1,5 Mbps y 150 ms, misma foto de Ocre: original 573135 bytes / 3303 ms; miniatura de 320 px 12424 bytes / 242 ms. No es latencia productiva ni prueba fisica de telefono.

Comparacion instrumentada del directorio: 1 lectura en el build anterior y 1 en el nuevo para el recorrido probado. Next.js ya deduplicaba las peticiones fetch identicas de ese render. No atribuir una reduccion de llamadas al cache adicional de React; reutiliza el procesamiento del directorio y conserva el lector alternativo donde no este disponible.

Pendiente antes de publicar: autorizacion del usuario. Despues de desplegar, medir la latencia real y comprobar Android/iPhone; no se certifica hoy una mejora de produccion. Reversion: volver al commit/despliegue 401fc47; no hay SQL ni archivos productivos que deshacer.
