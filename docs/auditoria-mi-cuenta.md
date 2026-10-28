# Auditoria previa: Mi cuenta, 15 de octubre de 2026

## Alcance y evidencia

Inventario completo de app, components, lib, data, supabase, scripts y docs del
checkout de publicacion. Lectura de las rutas de autenticacion, inscripcion,
vinculacion, edicion, catalogos, pedidos, envios, metricas y favoritos. Esta es una
auditoria de codigo y scripts, no una certificacion de la base de produccion.
No se consultaron datos privados de compradores ni se generaron pedidos.

La base del rediseño es work/restaurant-release-20261013, despliegue
dpl_GhsziU5AYTGHi6hteYY5yTk65x3t. La nueva version se prepara separadamente en
work/account-redesign-20261015. No copiar indiscriminadamente repo-check, que
contiene cambios pendientes ajenos a este modulo.

## Arquitectura actual

Next 14.2.5 App Router, React 18.3.1, TypeScript 5.5.4 y Tailwind 3.
Supabase Auth administra identidad, correo confirmado y contraseña. La sesion
del SDK usa persistSession, autoRefreshToken y detectSessionInUrl.
Vercel aloja Next; Airtable conserva fichas y solicitudes de actualizacion.
Supabase conserva business_admins, favorites, catalogo, ordenes e historial.
Shipday se integra por el servicio de logistica existente; no es un rol de cuenta.

## Rutas y componentes reutilizables

| Ruta | Implementacion / funcion |
| --- | --- |
| /mi-cuenta | AccountPage + AccountPanel: registro, acceso, recuperacion, datos |
| /mi-cuenta/inscribir-negocio | BusinessRegistration + API Airtable |
| /mi-cuenta/pedidos | CustomerOrders + CustomerOrderCard |
| /mi-negocio | MyBusinessDashboard, permisos y ficha asociada |
| /mi-negocio/[businessId]/catalogo | CatalogManager, API validada por propietario |
| /mi-negocio/[businessId]/pedidos | RestaurantPilot modo manager |
| /actualizar/[token] | Invitacion privada y activacion de relacion |
| /enviar | Formulario y confirmacion de solicitud logistica |
| /envio/[public_id] | Seguimiento existente |
| /negocios/[id] y /catalogo | Ficha, URL por nombre, catalogo y piloto |
| /admin-metricas, /admin/envios | Administracion independiente |

Se reutilizan BusinessEditor, BusinessPhotoUploader, prepareImage, BusinessImage,
BusinessRegistration, CatalogManager, CustomerOrderCard, BusinessOrdersLink,
cliente Supabase y servicios de pedidos, catalogo y Shipday. No se reconstruye
el despacho ni se amplian negocios habilitados para pedidos.

## Identidad y permisos

- Una fila auth.users por identidad. delivery_profile y account_intent estan en
  user_metadata. Son editables por el usuario, por lo que no autorizan roles.
- business_admins relaciona user_id y business_id con status y private_token.
  Las rutas de edicion verifican JWT, correo confirmado, vinculo activo y token.
- business_admins.sql contiene politicas antiguas de escritura de propietario.
  business_access_server_only.sql las revoca. Es necesario comprobar que esta
  ultima migracion se aplico. El nuevo script debe mantener ese cierre.
- El piloto usa pilot_restaurant_members; los restaurantes reales exigen
  business_admins activo. No convertir preferencia de registro en propiedad.
- Favorites tiene RLS por auth.uid. La sincronizacion usa una clave local comun
  y upsert; necesita aislar usuarios del mismo equipo y conservar fechas.
- No hay rol general admin o courier para las cuentas. El panel interno usa
  autenticacion independiente. No habilitar privilegios por un selector del UI.

## Modelo de negocios y actividad

Las fichas vienen de Airtable y se enriquecen con la ultima actualizacion
Aplicada. Las categorias estructuradas y legacy se conservan. El registro de
slugs estable vive en business_public_links. Los productos tienen autorizacion
por negocio, versionado y fotos privadas servidas por rutas publicas controladas.

Los pedidos reales del piloto se asocian a customer_id. Los envios generales
delivery_orders no tienen autor de cuenta. No existe una forma segura de
atribuir historicos a usuarios solo por correo, nombre o telefono. La inscripcion
actual crea en Airtable un registro Pendiente, pero no crea automaticamente una
relacion business_admins en esa ruta. Esto debe corregirse sin apropiarse de una
ficha existente ni cambiar invitaciones privadas.

## Deficiencias comprobadas y riesgos

1. Registro: direccion obligatoria y telefono ausente en el alta. Falta aceptacion
   de terminos y tratamiento de datos; el usuario confirma que no hay documentos.
2. No existe selector de perfiles seguro ni panel comprador separado.
3. Horario libre, una sola imagen principal, sin configuracion estructurada de
   domicilios propios/red, sin feed propio de solicitudes por negocio.
4. Los envios generales admiten solicitudes anonimas y source procede del body.
   Asociar nuevas solicitudes al JWT del servidor, no a un user_id enviado.
5. Los eventos de favoritos enviados por el cliente no estan entre allowedTypes
   de /api/metricas. Visitas de home no equivalen a visitas individuales de ficha.
6. No hay evidencia para llamadas recibidas o conversion real; mostrar clics para
   llamar y clics en WhatsApp, no llamadas ni mensajes efectivamente recibidos.
7. Los lectores de Airtable de negocios y metricas usan paginas de 100; el
   directorio no pagina actualmente negocios. Escalabilidad a revisar.
8. Las nuevas rutas privadas no pueden cachear respuestas compartidas ni retener
   informacion del usuario anterior cuando cambia una sesion.
9. Editar nombre no debe alterar slug; editar contacto no debe cambiar propietario.
10. Next 14.2.5 muestra advertencia de vulnerabilidad al instalar. Revisar parche
    compatible y regresiones antes de cualquier despliegue del nuevo modulo.

## Migraciones necesarias, aditivas

Perfiles privados y preferencias; roles privilegiados solo de servidor;
configuracion suplementaria de negocios; auditoria de acciones; autor y negocio
de recogida opcionales en delivery_orders; actividad agregada del negocio;
notificaciones internas; visitas recientes propias. Reutilizar favorites y
business_admins, no duplicarlos ni borrar historicos. Preparar fotos adicionales
en almacenamiento privado cuando se implemente la galeria.

No rellenar historicos de pedidos o envios con propietarios deducidos. No crear
notificaciones externas ni afirmar que las preferencias ya envian WhatsApp.
No presentar ceros inventados para datos no recogidos historicamente.

## Orden de implementacion y publicacion

1. Sesion compartida, registro progresivo y paneles accesibles.
2. Datos personales, favoritos aislados y actividad real.
3. Vinculacion, edicion por secciones y configuracion de negocio.
4. Solicitudes y estadisticas agregadas con autorizacion de propietario.
5. Migraciones en entorno de prueba, pruebas RLS/API, regresion de pedido y fotos,
   revision visual 320/390/768/1440, lint, TypeScript y build.
6. Revisar documentos legales y configuracion de Auth. Aplicar migracion aprobada
   y realizar despliegue controlado solo cuando se solicite.

Fuentes tecnicas: https://supabase.com/docs/guides/database/postgres/row-level-security
https://supabase.com/docs/guides/auth/managing-user-data
https://supabase.com/docs/reference/javascript/auth-updateuser
https://nextjs.org/blog/security-update-2025-12-11
