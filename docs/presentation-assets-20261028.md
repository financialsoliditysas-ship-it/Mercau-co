# Activos de la presentacion

Solo recursos nuevos, sin sobrescribir logo, fotografias originales o activos del comprador. Imagenes optimizadas con Sharp disponible en el runtime local; no se agrego una dependencia a package.json. Se uso la herramienta integrada image_gen, no el modo CLI/API ni una clave OpenAI.

## Imagenes generadas ilustrativas

### public/presentation/hero.webp

Original conservado: C:/Users/isver/.codex/generated_images/01a00201-3681-7460-83e7-502a1579a777/exec-4a0798d2-9938-497f-85ac-d69d2d7c8273.png.

Prompt:

Create a polished photoreal commercial still-life hero BACKGROUND asset for a Colombian local commerce website. Landscape 1536x1024. No text, no lettering, no logo, no watermarks, no interface, NO PHONE. White studio background with an architectural solid vivid red #E21412 curved backdrop rising on the right. A delicious realistic artisan cheeseburger on a simple white plate with a few fries occupies bottom-left foreground, a natural brown paper grocery bag overflowing with fresh broccoli, carrots, tomatoes, green lettuce, baguette and bananas occupies the right. Food and groceries crisp, bright, appetizing, very well lit, high-end professional ecommerce photography. The objects occupy the lower 70 percent, empty white top left. Soft grounded shadows, subtle light oak tabletop along the bottom. Keep the center foreground free for a real website screenshot to be overlaid as a phone by the developer. This is generic illustrative promotional photography, not attributed to any restaurant. Match the visual simplicity, exact subject matter, and vivid red black white branding of the user reference. No extra ornament.

El telefono final se implemento como composicion HTML decorativa con el logo oficial y accesos ilustrativos, sin datos de negocios o productos simulados. No se presenta como captura operativa.

### public/presentation/category-food.webp

Original conservado: C:/Users/isver/.codex/generated_images/01a00201-3681-7460-83e7-502a1579a777/exec-c2ea6c4c-ae49-4055-9c47-b833c747c3f2.png.

Prompt:

Create one horizontal 1536x1024 ecommerce category photograph, pure white studio background, no text or logos. A generous Colombian grilled-food platter arranged on a round white plate: browned grilled chicken pieces, golden fried potatoes and small arepas, grilled sausages and a little colorful fresh salad. Bright appetizing high-end commercial food photography. Position the entire platter in the right two thirds of the composition, with the left third clean empty white space for real HTML text overlay. Photoreal, sharp, soft contact shadow, no dark ambience, no graphic symbols, no border. Generic illustrative restaurant photograph, no attribution to any real restaurant. Camera slightly elevated three-quarter view. Food fully inside the frame, professional realistic proportions.

### public/presentation/category-shops.webp

Original conservado: C:/Users/isver/.codex/generated_images/01a00201-3681-7460-83e7-502a1579a777/exec-17d39bed-3089-466d-828f-79b3f72db0e9.png.

Prompt:

Create a horizontal 1536x1024 professional ecommerce category photograph on pure white studio background. A small woven shopping basket packed with fresh vegetables, tomatoes, broccoli, carrots, yellow bananas, a clear milk bottle with white cap, a baguette and a simple unbranded household product container. Bright, sharp, inviting, high-end commercial photography, natural rich colors and soft grounded shadows. Composition: basket occupies the right two thirds, left third entirely white and empty for HTML text. Generic illustration for a Colombian local commerce platform. No text, no words, no logos, no watermark, no border. All items fully visible within frame. Slightly elevated three-quarter camera angle. Match polished food-category photography.

## Recursos reales del directorio

- public/presentation/choli.webp: Foto principal de Asados el Choli Bar & Grill, registro recZQzu4If5VE0Egr, adjunto att9xZb8PFspBfncw.
- public/presentation/kikiriki.webp: Foto principal de Kikiriki y Quesudos, registro rece62hjPb3DM0l8P, adjunto attZ84t42DSBwkdT2.
- public/presentation/sanstisar.webp: imagen horizontal de SanStiSar, registro recUVIMp2TSDKQ79F, adjunto attY3Jt9w1IPtcFPQ. No se invento una fotografia del local o de su dueno.
- public/logo-mercau.png: activo oficial existente, reutilizado sin editar.

Los adjuntos se consultaron en Airtable el 2026-10-28. Se modificaron solo formato y dimensiones de las copias locales; no se sustituyeron identidades o productos de esos negocios por generacion artificial.

## Cartografia

content/presentation/bajo-cauca-map.json se deriva de la geometria simplificada de geoBoundaries COL ADM2 gbOpen, commit 9469f09. Fuente original DANE, ano 2020, licencia CC BY 4.0. Metadatos y enlaces incluidos en el JSON, atribucion visible en pantalla. Conversion geometrica reproducible en scripts/prepare-presentation-assets.cjs. No se copio la geometria inventada de la maqueta.
