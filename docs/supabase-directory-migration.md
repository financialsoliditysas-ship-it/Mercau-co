# Migracion del directorio a Supabase

## Estado actual

- Supabase ya es la fuente de autenticacion, catalogos, fotos de productos, carritos, pedidos, domicilios, favoritos, push y configuracion operativa.
- Airtable sigue siendo la fuente del directorio publico, logos/fotos de ficha, horarios, actualizaciones de ficha, inscripciones y parte de metricas.
- Los IDs publicos actuales tienen formato de registro de Airtable (`rec...`) y se conservan durante la migracion.

## Primera entrega

`supabase/migrations/20261106120000_directory_supabase_source.sql` crea de forma aditiva:

- `directory_businesses`: ficha publica y estado de publicacion.
- `directory_business_hours`: horario flexible por negocio.
- `directory_business_media`: referencias a logos, portada y galeria en Supabase Storage.

Las tablas no conceden acceso directo a visitantes ni usuarios. La lectura y escritura inicial continuan pasando por los endpoints del servidor, con `service_role` y las validaciones actuales.

## Orden de migracion

1. Aplicar la migracion en un proyecto aislado y comprobar esquema, RLS e indices.
2. Importar una copia de negocios, horarios y medios conservando `airtable_record_id`.
3. Comparar conteos, estados, URLs, horarios y fotos antes de cambiar lecturas.
4. Hacer que el directorio lea Supabase primero y use Airtable solo como respaldo temporal.
5. Mover formularios, actualizaciones e inscripciones a Supabase.
6. Retirar Airtable despues de una ventana de observacion y una copia final.

## Carga de medios

Las fotos preservadas se cargan con:

```bash
node scripts/upload-directory-media.mjs migration-assets/business-photos
node scripts/upload-directory-media.mjs migration-assets/business-photos --apply
```

El segundo comando requiere `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en un entorno servidor autorizado. La clave no debe guardarse en el repositorio ni exponerse al navegador.

## Bloqueo conocido

La API de Airtable esta limitada por cuota en el entorno actual. No se debe ejecutar una importacion automatica hasta recuperar acceso o recibir una exportacion autorizada. No se copian datos personales ni credenciales.
