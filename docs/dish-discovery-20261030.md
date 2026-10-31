# Descubrir platos antes del restaurante

Estado: propuesta local, sin push, despliegue, migraciones ni pedidos reales.
Rama: `feat/dish-discovery-20261030`, parte del corte publicado `f32f070`.

## Alcance

- `/comprar/restaurantes`: entrada Platos, pestaña Restaurantes con el listado anterior.
- Destino existente, búsqueda por nombre de plato o restaurante, filtros de secciones publicadas.
- Dos columnas en móvil, tres en tablet, cuatro en escritorio; miniaturas existentes 320/640/960.
- Enlaces internos con `restaurante` y `plato`, compatibles con historial de Next, sin cambiar Home ni PWA.
- `RestaurantPilot` abre el producto solicitado y conserva validación de opciones, cantidades, notas y cálculos.
- Después de agregar conserva el menú actual del negocio y muestra subtotal de productos en la barra.
- El carrito usa las claves `mercau:catalog-cart:<id>:v1` existentes. Al regresar se puede retomarlo.
- En este recorrido, agregar a otro restaurante requiere confirmación antes de retirar borradores anteriores.
- Un intento pendiente de comprobar conserva su referencia y su carrito; no se borra para iniciar otro a ciegas.
- El formulario de acceso existente se muestra al pulsar continuar, no antes de explorar.
- El checkout, precios de pedido, pagos, QR, estados, idempotencia y despachos siguen con su implementación actual.

## Consulta pública

`GET /api/comprar/platos?municipio=Nech%C3%AD&q=...&categoria=...&cursor=...`

Reutiliza Airtable/directorio publicado y Supabase administrativo exclusivamente en servidor.
Excluye el piloto, negocios ajenos al municipio, no gastronómicos, pausados, no públicos,
sin pedidos inicializados o sin relación válida con su ficha. Productos publicados,
disponibles y con precio positivo. No devuelve rutas privadas de Storage, propietarios,
clientes, pedidos ni grupos completos de personalización.

Cada página consulta como máximo doce restaurantes, en paralelo, y una fila por restaurante.
El cursor recorre rondas estables por identificador de negocio y posición/identificador de producto.
El conjunto de secciones se obtiene con metadatos paginados, no descargando los catálogos completos.
Los grupos se consultan en servidor solo para calcular la menor combinación válida y si hay variación real.
El detalle usa el endpoint de menú existente solo para el restaurante elegido.
La confirmación del pedido mantiene su validación del lado del servidor.

No requiere SQL ni permisos nuevos. No incorpora proveedor, paquete, facturación ni costo fijo nuevo.
Consume consultas y transferencia de la infraestructura actual. No se ha medido costo incremental
monetario en producción ni se han modificado límites o planes. Las peticiones se limitan a doce
consultas de platos por página y no se hacen peticiones por tarjeta de imagen para obtener su menú.

## Límites reales

- El flujo operativo actual anuncia Nechí como cobertura. Otros municipios mantienen el listado de
  restaurantes, pero no se anuncian platos como comprables fuera de esa cobertura.
- `enabled` es el control operativo existente. Los horarios del directorio son texto; no se inventa
  un motor de apertura/cierre ni se afirma que el sistema actual los evalúe automáticamente.
- La detección de carritos anteriores se aplica al agregar desde el nuevo descubrimiento. Los menús
  directos conservan su comportamiento previo de borradores separados por negocio; un pedido nunca
  combina restaurantes. No se ha extendido silenciosamente una regla nueva a Comercios.
- La edición posterior conserva las acciones actuales de cantidad y eliminación. No se ha añadido
  un nuevo editor de opciones de una línea ya agregada.
- El orden es estable mientras no cambie la oferta publicada; una actualización del comerciante puede
  retirar un producto. El menú y la confirmación siguen validando la oferta actual.

## Analítica

Se reutiliza `directory_filter_used` con `discovery=platos|restaurantes` al seleccionar pestaña,
y `Producto visto` con `discovery=platos; product_id=...` al abrir una tarjeta. El editor mantiene
sus eventos actuales de producto y carrito. No envía datos personales ni exige herramientas nuevas.
Los eventos de selección no deben sumarse como compras confirmadas.

## Verificación y revisión

- `scripts/test-dish-discovery.cjs`: datos ficticios aislados, elegibilidad, proyección pública,
  paginación estable y equilibrada, búsquedas, secciones, vacío/error, precios mínimos y borradores.
- `qa/check-logistics-controls.cjs`: suites existentes, lint, build y TypeScript con servicios externos
  bloqueados. Resultados exactos en `outputs/logistics-controls/results.json`.
- `qa/test-dish-discovery-ui.cjs`: Chrome emulado 320/390/768/1440, componentes reales y un adaptador
  local que sirve una captura de productos y fotografías públicos. No usa sesión de producción.
  Comprueba agregar con opciones, importe, cantidades, eliminación, confirmación/cancelación del
  cambio de restaurante, borrador al navegar/recargar, Atrás/Adelante, búsqueda, filtros,
  carga progresiva, barra fija, acceso al formulario existente y ausencia de desbordamiento.
- Una prueba adicional usa una opción obligatoria expresamente ficticia, solo para validar el bloqueo
  y desbloqueo del botón. No aparece como oferta real ni en la galería. También simula error y reintento.
- No son pruebas físicas de Android/iPhone ni una consulta de la ruta nueva contra la base productiva.
- Las lecturas productivas realizadas fueron GET públicos de directorio, menús y fotografías.

Galería autocontenida: `outputs/dish-discovery/galeria-platos.html`.
Incluye maqueta ilustrativa, capturas de viewport y capturas completas, todas en base64.
Vista local: `node qa/dish-review-server.cjs`, solo `127.0.0.1:3190`.
El adaptador está fuera de las rutas públicas de la app, bloquea métodos de escritura operativos,
push, mensajes, cuentas y proveedores. Los enlaces a fichas/rutas ajenas al descubrimiento quedan
bloqueados en esta vista, no en la aplicación. La oferta capturada puede cambiar posteriormente.

## Archivos

Nuevos: `lib/dish-discovery.ts`, `lib/dish-pricing.ts`, `lib/dish-cart.ts`,
`app/api/comprar/platos/route.ts`, `components/buyer/RestaurantDishes.tsx`,
`components/buyer/restaurant-dishes.css`, `scripts/test-dish-discovery.cjs`,
`qa/capture-dish-public-fixture.cjs`, `qa/dish-review-server.cjs`,
`qa/test-dish-discovery-ui.cjs` y este documento.

Modificados: `components/buyer/BuyerExperience.tsx`, `components/RestaurantPilot.tsx`,
`scripts/test-account-suite.cjs`.

Pendiente: aprobación visual y verificación autorizada de la consulta agregada con configuración
real antes de publicar; no hacen falta migraciones para esta propuesta.
