# Acabado de presentacion V2

Fecha: 2026-10-28. Solo vista temporal local, sin publicacion. Misma estructura y secciones aprobadas. No se reemplaza la Home ni se cambia la apertura PWA.

## Seis ajustes

1. Tipografia. No se encontraron archivos de una fuente comercial especifica en public. La inspeccion inicial de Chrome informaba una pila sans-serif; no se reprodujo una fuente serif real en esos elementos. Se dejo una pila local explicita Arial, Helvetica y alternativas sans-serif en la presentacion, sin cambiar la tipografia del comprador o del sitio compartido. CDP CSS.getPlatformFontsForNode confirmo Arial Black para titulo y nombres; Arial para el texto territorial y preguntas. No se contrato un proveedor de fuentes ni se descargo una tipografia.
2. Portada movil. Recurso independiente hero-mobile.webp mediante picture/source hasta 430 px, con encuadre completo de hamburguesa y plato y mercado menos dominante. Se usa contain para evitar recorte por cover y se desplaza ligeramente el telefono a 320 px. No se aumentaron las alturas, min-height o padding de la portada. La imagen de escritorio no se reemplazo.
3. Acciones comerciales. El usuario autorizo expresamente consultar solo los catalogos y fotos de Choli, Kikiriki y SanStiSar. Consulta SELECT filtrada por los tres business_id y status=published: 22, 5 y 1 productos publicados respectivamente. Segunda consulta limitada a tres referencias de foto publicadas por negocio, sin clientes, propietarios, pedidos, precios, pagos o credenciales. No hubo escrituras. Snapshot verificado en content/presentation/review-businesses.json. commercialLabel se conserva y produce Ver menu, Ver menu y Ver catalogo. No se afirma que los productos esten disponibles para entrega o que el conteo sea en tiempo real.
4. Fotos y logos. Se descargaron las tres imagenes por sus rutas publicas existentes, con respuesta HTTP de imagen, y se guardaron como copias WebP. Los productos pasan a ser la imagen protagonista; las identidades existentes quedan como distintivos secundarios de 44 px. No se generaron productos falsos para esos negocios ni se alteraron sus fotos originales.
5. Negocios. Se sustituyo exclusivamente la imagen de SanStiSar en el bloque Tienes un negocio por merchant-illustrative.webp, recurso independiente generado. El alt la identifica como ilustrativa. No representa una comerciante real, no incluye nombre o testimonio, y no se recorto la maqueta. Se conservaron el texto, boton y distribucion. Posicion de imagen centrada en rostro y contexto del establecimiento.
6. iPhone. La variante muestra una sola accion Como instalar en iPhone. Abre una ayuda nativa dialog con Safari, Compartir mediante el cuadro/flecha hacia arriba y Agregar a Inicio; contempla el menu Mas y la opcion Abrir como app web cuando aparezcan. No dispara instalacion ni duplica otro enlace equivalente. Las instrucciones contienen espacios explicitos alrededor de los saltos de linea, tambien cuando esos br se ocultan en movil. El componente compartido InstallMercau no se modifico.

Fuente de instrucciones iPhone consultada: https://support.apple.com/es-lamr/guide/iphone/iphea86e5236/ios. La pantalla real y la instalacion dependen de la version y navegador. Este hito prueba la ayuda, no una instalacion en un iPhone fisico.

## Procedencia de fotos publicadas

- Choli: producto ede6b747-bd7f-40e9-9bbd-630026593bf4, Punta de Anca Especial 450 gr, estado publicado, version 5.
- Kikiriki: producto 42862b88-ee91-4a15-b363-364e1d3866a4, Pollo Kikiri entero a la broaster de 8 presas, estado publicado, version 4.
- SanStiSar: producto 136b0b79-91ad-4a5b-ae61-00e1481c2618, Conjunto nina desde la talla 6 hasta la 16, estado publicado, version 2.
- Acceso utilizado: GET /api/negocios/{businessId}/catalogo/{productId}/foto. Su implementacion existente valida estado publicado y publicacion del negocio antes de devolver la imagen. No se copiaron claves ni se accedio directamente al bucket privado.

Las fotos se usaron tal como las publico cada negocio. Su publicacion no acredita por si misma autoria fotografica o disponibilidad de inventario. No se modificaron los registros alojados. No se agregaron proveedores ni servicios facturables al sitio.

## Recursos ilustrativos nuevos

Herramienta integrada image_gen, no API/CLI con claves externas. Se conservaron los originales y se crearon copias WebP locales.

### Comerciante

Destino: public/presentation/merchant-illustrative.webp.
Original: C:/Users/isver/.codex/generated_images/01a00201-3681-7460-83e7-502a1579a777/exec-60f04484-17c1-457d-b049-dc6f684a85c2.png.

Prompt: Create an independent high-resolution photorealistic illustrative photograph for the small merchant section of a Colombian local-commerce website, 1536x1024 landscape. A friendly Colombian woman shopkeeper aged around 35, dark hair tied back, natural everyday appearance, teal short-sleeve blouse and simple dark apron, stands behind her small neighborhood store counter and looks toward the camera. Medium waist-up framing. Her entire face, hair and shoulders are fully visible and centered, with shelves of colorful household and grocery items clearly visible behind and on both sides. Warm natural daylight, bright clean store, authentic and professional, inviting without an exaggerated advertising grin. Keep face and store context within central 60 percent so the image remains useful as a small responsive thumbnail. No readable product branding, no Mercau logo, no captions or words, no testimony, no watermark. This is a fictional illustrative person, not an actual merchant or customer endorsement. Match the compact merchant image in the user-approved red black white landing-page reference, not a screenshot or collage.

### Portada movil

Destino: public/presentation/hero-mobile.webp.
Original: C:/Users/isver/.codex/generated_images/01a00201-3681-7460-83e7-502a1579a777/exec-18de2b91-2869-4720-b884-f36bbb6dbe13.png.
Referencia de edicion: original de la portada inicial, exec-4a0798d2-9938-497f-85ac-d69d2d7c8273.png.

Prompt: Edit this generic illustrative commerce hero photograph into a responsive mobile composition. Preserve the same realistic burger on a white plate, paper grocery bag, bright lighting, red curved backdrop and light wood tabletop. Recompose ONLY: show the ENTIRE burger and plate inside the frame with clear white/wood margin on the left; make the burger/plate occupy the lower-left 34 percent of the image width. Reduce the grocery bag to the rightmost 28 percent of image width, with produce completely inside the top and right frame boundaries. Keep the middle 35 percent clear of objects for a real phone overlay that the website adds. No phone in this bitmap. Leave calm white negative space in the upper-left. Balanced food and groceries, grocery bag should not dominate. Landscape 4:3 composition, full objects not cropped, no text, no logos, no captions, no added people. Maintain all subject identities and photo realism; this is the mobile variant only, not a redesign of the desktop asset.

## Verificacion

- Pruebas automatizadas de Chrome a 320, 390, 768 y 1440 px. Sin desbordamiento horizontal o imagenes rotas. Son tamaños emulados, no dispositivos fisicos.
- Se comprobaron las tres acciones comerciales confirmadas, fotos de productos y fuente declarada. Comprobacion CDP adicional de fuentes realmente dibujadas en Chrome.
- Se comprobaron una unica accion de ayuda iPhone, contenido del dialogo, cierre con Escape y espacios de instrucciones en movil; se conservaron las pruebas de menu, municipios y FAQ.
- Build de Next completo correcto, incluyendo lint y tipos. Persisten advertencias img y de dependencias de hooks, sin convertirlas en refactorizaciones fuera del alcance.
- Guardia del build local: presentacion-revision devuelve 404 en modo produccion incluso con flag encendido, Home 200 y API QA 404. No es una prueba de produccion desplegada.
- 158 archivos protegidos sin cambios. Copias de cortes de cuenta y pedidos se comprueban aparte; no se regeneran.
- La cache de desarrollo antigua registro fallos de manifiesto/webpack al compilar rutas existentes durante iteraciones. Se renovo solo el servidor temporal con una carpeta de compilacion nueva, sin borrar archivos ni modificar rutas operativas. La entrega se comprueba sobre ese servidor limpio.
- El recorrido completo se repitio en el servidor limpio y paso en los cuatro tamanos. Se retiraron los includes temporales que Next agrego a tsconfig.json, preservando su contenido previo.

## Entrega

- URL: http://127.0.0.1:3080/presentacion-revision.
- Galeria: outputs/mercau-presentacion-galeria-v2-autocontenida.html. Incluye capturas completas, viewports, ayuda iPhone y comparacion 320 px antes/despues. Es estatica; los controles se prueban en la URL local.
- Evidencia automatizada: outputs/presentation-review/results.json y production-guard.json.
- Version anterior conservada en outputs/presentation-before-finish.
- Archivos funcionales de este ajuste: components/presentation/Presentation.tsx, app/presentacion-revision/presentation.css, content/presentation/review-businesses.json, public/presentation/*product.webp, merchant-illustrative.webp y hero-mobile.webp. Ademas se actualizaron scripts de activos, galeria y pruebas y esta documentacion.

No se cambiaron estructura, Home, autenticacion, perfil, direcciones, menus, carrito, checkout, pagos, QR, pedidos, estados, Shipday, paneles, manifest o service worker. No hay migraciones ni despliegue. Pendiente la aprobacion del acabado por el usuario y la comprobacion en celulares reales.
