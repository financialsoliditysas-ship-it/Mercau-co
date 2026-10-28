# Revision visual del Inicio y listados

Entrega local sobre feat/buyer-experience-20261027. No despliega ni modifica
checkout, base de datos, secretos, manifest, service worker o Home publica.

## Cambios

- Entrada visible Usar mi ubicacion / Elegir municipio cuando no hay destino.
  No se solicita GPS al montar la pantalla, abrir la seleccion manual, navegar
  ni restaurar el municipio. El permiso se pide solo por el boton de GPS.
- Seleccion mediante dialog accesible y municipios manuales. El GPS no sustituye
  el municipio seleccionado; el caso Medellin fisico / Nechi destino se simula.
  El rechazo de GPS permite continuar con seleccion manual. No hay geocodificador
  ni calculo de cercania o cobertura nuevo.
- Comercios utiliza fotografia, fondo claro y acentos rojos. Misma dimension de
  imagen que Restaurantes; no usa el anterior bloque verde de iconos.
- Inicio ofrece Tiendas, Mercados, Farmacias y Servicios con iconos. Cada acceso
  abre Comercios con un filtro. Se utilizan las subcategorias/tags actuales para
  mercados y farmacias, sin incluir consultorios como farmacias por su categoria
  general. Explorar conserva las once categorias completas.
- Tarjetas sin foto: miniatura compacta de 54 px, sin gran superficie vacia.
  El contenedor de fotografia recorta el contenido y evita que cubra el nombre.
- Navegacion inferior medida con ResizeObserver. Su altura real reserva espacio
  en la pagina, incluyendo safe-area. Acciones con margenes de scroll superiores
  e inferiores. Las pruebas comprueban geometria y hit testing de cada accion,
  ademas de acceso a la ultima tarjeta al final de la pagina.
- Aviso Vista de prueba / Datos ficticios conservado. El endpoint entrega fixtures
  y flag preview solo en development con MERCAU_BUYER_PREVIEW=1. Se prueba que
  NODE_ENV=production no entrega ese flag aun con la variable de preview activa.

## Variantes comerciales

Datos exclusivamente ficticios:

| Ejemplo | Variante |
| --- | --- |
| Asados de prueba | Ver menu |
| Tienda de prueba | Ver catalogo |
| Servicios de prueba | Ver servicios |
| Ficha sin catalogo, dentro de Explorar | Sin CTA comercial |

El tipo services se declara explicitamente en el fixture. No se infiere de una
categoria ni convierte el catalogo real en otro flujo. Para negocios reales sin
tipo comercial explicito se conservan las reglas actuales menu/catalogo. La
definicion persistente de servicios sigue pendiente; esta entrega demuestra la
variante visual sin cambiar el esquema ni inventar contenido publicado.

## Fotografia y costos

Archivo local: public/buyer-commerce.jpg, 19.3 KB descargados. Solo representa
el acceso generico Comercios, no es una foto de un negocio real.

Autor: Polina Tankilevitch. Pexels, foto 5719885:
https://www.pexels.com/photo/close-up-shot-of-vegetables-in-a-reusable-bag-5719885/
Licencia consultada: https://www.pexels.com/license/

Pexels permite usar sus fotos en una web o app sin tarifa de licencia. No se
incorporo su API, suscripcion, generacion de imagen ni servicio remoto al cargar
la pagina. El archivo se sirve por la infraestructura ya existente, cuyo
consumo de almacenamiento/transferencia depende del plan contratado. No se
activaron planes ni facturacion adicional.

## Evidencia local

- node scripts/test-buyer-visual.cjs: variantes, contenido sin CTA, filtros cortos
  y exclusión del modo de prueba en la rama de produccion, con API simulada.
- node scripts/test-buyer-ui.cjs: Chrome headless, tamaños 320x900, 390x667,
  768x900 y 1440x900. Navegacion, filtros, fotos cargadas, ausencia de overflow,
  favoritos, dimensiones de las dos imagenes, tarjetas compactas, GPS por accion,
  conservacion del destino manual, fallback tras rechazo, y acciones alcanzables.
- Galeria: outputs/buyer-visual-review.html.
- Capturas por pantalla: outputs/buyer-{home,restaurants,commerce,destination,
  cta-variants}-{ancho}-{viewport,full}.png.
- Captura adicional al final del Inicio: outputs/buyer-home-{ancho}-bottom.png.
- Resultados estructurados: outputs/buyer-visual-results.json.

Son tamaños emulados y GPS simulado, no dispositivos Android/iPhone reales ni
verificacion de produccion. No hay cuentas, pedidos, pagos ni despachos reales.
El checkout permanece sin rediseñar, pendiente de la revision visual del usuario.

La suite completa tiene 22 grupos aislados. Typecheck y build local pasan; el
lint conserva avisos de imagenes y hooks ya presentes en el proyecto. Durante
la revision se detecto y corrigio el desbordamiento de una foto sobre el nombre
y un margen que dejaba parcialmente ocultos los accesos cortos en 390x667.
La galeria incluye 40 capturas de viewport/pagina completa y 4 adicionales del
final del Inicio. No se cuentan como pruebas en telefonos reales.
