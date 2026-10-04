# Estructura de categorías de Mercáu en Airtable

Este documento deja la base lista para reclasificar negocios sin borrar la categoría anterior ni romper búsquedas existentes.

## Campos nuevos sugeridos en la tabla `Negocios`

| Campo | Tipo sugerido | Uso |
| --- | --- | --- |
| `Categoría principal nueva` | Selección única | Categoría principal dentro de las 11 categorías nuevas. |
| `Subcategoría` | Selección única | Actividad específica según la categoría principal. |
| `Categorías secundarias` | Selección múltiple | Otras categorías donde el negocio también puede aparecer. |
| `Etiquetas / servicios` | Selección múltiple | Servicios concretos, palabras de búsqueda o beneficios. |
| `Categoría anterior` | Texto de una línea | Respaldo de la categoría original antes de reclasificar. |
| `Otra actividad` | Texto largo | Actividad escrita por el negocio cuando no encaja en las opciones. |
| `Revisar categoría` | Casilla o selección única | Marca interna para negocios que necesitan revisión manual. |

## Variables de entorno esperadas

Cuando los campos existan en Airtable, copia sus `fieldId` y configura estas variables en Vercel:

```txt
AIRTABLE_CATEGORIA_PRINCIPAL_FIELD_ID=fldovZfFsNdoL2007
AIRTABLE_SUBCATEGORIA_FIELD_ID=fldIoDN2fV4Fbo3di
AIRTABLE_CATEGORIAS_SECUNDARIAS_FIELD_ID=fldaUQHG6uh9pudJj
AIRTABLE_ETIQUETAS_FIELD_ID=fldSBzRUqagoiCWIV
AIRTABLE_CATEGORIA_ANTERIOR_FIELD_ID=fldjCEgBIc6EUJbGP
AIRTABLE_OTRA_ACTIVIDAD_FIELD_ID=fldrQhQby6W0s0kCm
```

Mientras estas variables no existan, Mercáu sigue funcionando con el campo actual `Categoria` y guarda subcategoría, categorías secundarias, etiquetas y otra actividad dentro de notas internas.

## Categorías principales

1. Comidas y bebidas
2. Tiendas y comercio
3. Ferretería y construcción
4. Motos y vehículos
5. Salud y bienestar
6. Belleza y cuidado personal
7. Moda y accesorios
8. Hogar, tecnología y reparación
9. Transporte y movilidad
10. Agro, campo y alimentos
11. Profesionales y servicios

## Reglas de reclasificación manual

- No borrar el campo anterior `Categoria`.
- Antes de cambiar una ficha, copiar el valor anterior en `Categoría anterior`.
- Si el negocio estaba en `Emprendimientos`, asignarlo a su categoría real y agregar la etiqueta `Emprendimiento local`.
- Si no hay información suficiente, usar `Profesionales y servicios`, agregar `Emprendimiento local` si aplica y marcar `Revisar categoría`.
- Si un negocio atiende varias actividades, usar una categoría principal y las demás en `Categorías secundarias`.
- Usar `Etiquetas / servicios` para términos concretos que la gente buscaría, por ejemplo `Domicilios`, `Repuestos`, `Papelería`, `Reparación de celulares`.

## Mapeo base

| Categoría anterior | Categoría nueva sugerida |
| --- | --- |
| Comidas y Bebidas | Comidas y bebidas |
| Hogar y Tecnología | Hogar, tecnología y reparación |
| Salud | Salud y bienestar |
| Belleza | Belleza y cuidado personal |
| Moda | Moda y accesorios |
| Ferreteria | Ferretería y construcción |
| Servicios | Profesionales y servicios |
| Transporte | Transporte y movilidad |
| Emprendimientos | Revisar según actividad real |

## Casos que requieren atención

- Negocios de variedades, misceláneas o papelería que hoy estén en `Hogar y Tecnología` probablemente deben pasar a `Tiendas y comercio`.
- Técnicos, reparación de celulares, reparación de ventiladores o electrodomésticos deben ir a `Hogar, tecnología y reparación`.
- Talleres, repuestos o lavaderos deben ir a `Motos y vehículos`.
- Pesca, tilapia, insumos rurales o producción agrícola deben ir a `Agro, campo y alimentos`.
- Fotografía, publicidad, contabilidad, educación y trámites deben ir a `Profesionales y servicios`.
