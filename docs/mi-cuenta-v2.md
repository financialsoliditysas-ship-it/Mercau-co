# Mi cuenta V2: entrega tecnica local

Fecha: 15 de octubre de 2026.

## Estado de la entrega

Implementacion preparada en `work/account-redesign-20261015`, separada de la
version publicada. No se desplego ni se ejecuto SQL en produccion. Las pruebas
usan APIs simuladas y PostgreSQL local; no constituyen una prueba real de Supabase,
correo, Airtable o Shipday. La auditoria previa esta en `auditoria-mi-cuenta.md`.

## Cuenta y permisos

- Una identidad de Supabase Auth. Comprador y propietario comparten sesion.
- `buyer` esta disponible para la cuenta. `business_owner` requiere una relacion
  activa en `business_admins`; seleccionar una preferencia no concede propiedad.
- Las APIs privadas verifican el JWT con Auth y exigen correo confirmado.
- La configuracion del negocio comprueba ademas que la invitacion privada
  corresponde a la misma ficha. Su token no se devuelve en el nuevo panel.
- `admin` y `courier` quedan previstos en una tabla solo de servidor. Este cambio
  no crea un panel de repartidor ni sustituye la autenticacion administrativa.
- Los datos privados se sirven sin cache compartida. Los snapshots de interfaz
  se separan por usuario y negocio; no reutilizan datos de otra sesion.
- Las fichas suspendidas o archivadas no admiten cambios desde el nuevo panel.

## Rutas

| Ruta | Funcion |
| --- | --- |
| /mi-cuenta | Entrar, registrarse, recuperar acceso y redireccion inicial |
| /mi-cuenta/comprador | Resumen, acciones y actividad propia |
| /mi-cuenta/favoritos | Favoritos y sincronizacion |
| /mi-cuenta/envios | Solicitudes logisticas asociadas al usuario |
| /mi-cuenta/pedidos | Pedidos existentes; no convierte contactos en ventas |
| /mi-cuenta/notificaciones | Avisos internos y marcar como leidos |
| /mi-cuenta/perfil | Datos, direcciones opcionales, preferencias y acceso |
| /mi-cuenta/negocio | Negocios autorizados y gestion por secciones |
| /mi-cuenta/inscribir-negocio | Asistente de tres pasos sobre el formulario actual |
| /mi-cuenta/ayuda | Ayuda y privacidad |
| /mi-negocio | Compatibilidad: redirige al panel nuevo |

Catalogos, pedidos de negocio, invitaciones, envios, tracking y enlaces publicos
mantienen sus rutas. El directorio solo cambia su sincronizacion de favoritos.
La ficha publica incorpora los datos suplementarios que el propietario guarde:
horarios, telefono, sitio web, referencias, portada, galeria y recogida habilitada.

## Componentes

### Demostracion sin credenciales

Para revisar sin una cuenta real: `http://localhost:3043/`, solo en este computador.
`node scripts/preview-account.cjs` inicia un servidor independiente de solo lectura
en loopback; requiere la vista de pruebas del puerto 3041. No cambia rutas ni
permisos de la aplicacion. Presenta comprador/negocio con datos ficticios y rechaza
las escrituras y el despacho. No usar credenciales reales en esta demostracion.
No es un enlace publico para celular. `node scripts/test-account-demo.cjs` comprobo
el acceso sin credenciales en 390/1440 px, ausencia de errores de aplicacion y
rechazo de cambios/envios. No se desplego este servidor en Vercel.

`AccountSession` centraliza sesion y solicitudes autenticadas. `AccountAuth`
presenta los dos usos iniciales. `AccountShell` proporciona menu lateral y menu
movil. `AccountHub` organiza las vistas de comprador y `AccountProfile` sus datos.
`BusinessWorkspace` selecciona la ficha y sus secciones. `SpecialHoursEditor`
gestiona fechas excepcionales. `BusinessGalleryEditor` reutiliza la preparacion de
imagenes. `useFavorites` se comparte con el directorio.

Se conservan `BusinessEditor`, `BusinessRegistration`, `BusinessPhotoUploader`,
`CatalogManager`, `CustomerOrderCard` y los servicios de pedidos y logistica.
Next se actualizo del 14.2.5 al parche 14.2.35 dentro de esta copia. Se agregaron
lucide-react y herramientas de pruebas/lint; no se cambio el framework.

## Funciones

- Registro: uso comprador/negocio, nombre, correo, celular, municipio y sector.
  No exige direccion completa. Mostrar/ocultar contrasena y recuperacion.
- Comprador: favoritos, solicitudes propias, pedidos reales del piloto, avisos,
  recientes locales, ayuda y hasta cinco direcciones frecuentes opcionales.
- Favoritos: invitados locales, importacion al iniciar sesion, persistencia por
  cuenta y RLS existente. La clave antigua compartida se conserva para importacion
  explicita; no se asigna silenciosamente a otra persona del mismo navegador.
- Negocio: resumen, estado de ficha, tareas de informacion faltante, informacion
  publica, categorias, contacto, fotos, catalogo, horarios, entregas y actividad.
- Edicion por secciones: mezcla con valores actuales, validacion y versionado.
  Los cambios directos siguen almacenandose como actualizaciones Aplicadas de
  Airtable. La categoria anterior y el enlace estable no se eliminan.
- Horarios: semana, dos tramos por dia, hasta diez fechas especiales, cierre
  temporal/vacaciones. Horarios sin configuracion nueva conservan el texto anterior.
- Fotos: imagen principal existente, una portada visible y hasta ocho fotos de
  galeria visibles. Ocultar conserva el archivo. Se reutilizan adjuntos Airtable;
  no se contrato otro almacenamiento ni se modifico el catalogo de productos.
- Entregas: sin domicilios, propios, red Mercau o ambas; disponibilidad y condiciones.
  La recogida se precarga en /enviar. La cobertura operativa sigue separada de los
  municipios del directorio. Esto no habilita nuevos restaurantes en Shipday.
- Inscripcion autenticada: vincula solamente el registro nuevo al autor verificado.
  Si falla la vinculacion entre Airtable y Supabase se informa que no debe repetirla.
- Nuevos envios: autor derivado del JWT, nunca del user_id enviado. Solicitudes
  anonimas siguen admitidas, sin atribucion retroactiva por telefono.
- Notificaciones internas: triggers de nuevos estados de envios y pedidos del
  piloto, deduplicacion por orden/estado y preferencias propias. No envia correo,
  WhatsApp ni promociones. Si la tabla del piloto no existe al migrar, se omite ese
  trigger; reaplicar el script despues de crearla lo incorpora.

## Estadisticas y privacidad

El vendedor ve agregados de 7/30/90 dias: visitas a su ficha, clics de WhatsApp,
clics para llamar, favoritos de cuentas y solicitudes asociadas. Se informa desde
cuando se miden. No equivalen a llamadas recibidas, conversaciones o ventas.
Favoritos anonimos locales no pueden sumarse al contador de cuentas.

No se entregan al vendedor terminos de busqueda, identidades de visitantes,
ubicaciones individuales, comparaciones, datos publicitarios o metricas internas.
Las metricas administrativas existentes permanecen separadas. No se inventaron
los indicadores futuros de conversion y expansion.

Solicitudes del negocio muestran resumen. Direccion y telefono de entrega se
devuelven solo en estados de operacion asignado/recogido/en camino, no en todas
las filas. No se hizo una asociacion de historicos basada en nombres o telefonos.

## Migracion

`supabase/account_workspace.sql`, aditiva y probada dos veces en PostgreSQL local:

- account_profiles, account_roles, account_notifications, account_recent_businesses;
- business_account_settings, account_audit, business_daily_activity;
- delivery_orders.customer_user_id y pickup_business_id, ambos opcionales;
- indices y RPC versionadas para guardar perfil/configuracion y agregar actividad;
- triggers de avisos internos, sin notificaciones historicas masivas;
- RLS en tablas nuevas, acceso de servidor y revocacion de escritura directa de
  business_admins desde anon/authenticated.

Requiere las tablas existentes business_admins y delivery_orders. Reutiliza favorites.
No borra negocios, propietarios, usuarios, catalogos, ordenes ni historiales.
`account_recent_businesses` queda reservada; la interfaz actual usa recientes locales.
Los guardados de perfil y configuracion tienen auditoria; la edicion de ficha conserva
el historial Airtable. Galeria registra cargas y cambios de visibilidad sin secretos.

## Configuracion y despliegue

Nuevas variables documentadas en `.env.example`:

- NEXT_PUBLIC_TERMS_URL y NEXT_PUBLIC_PRIVACY_URL: documentos oficiales aprobados.
- DELIVERY_CHANNEL_TOKEN: secreto de servidor para source WHATSAPP o ADMIN.
- DELIVERY_MUNICIPALITIES: cobertura operativa; valor inicial Nechi con su acento.

Mantener las variables actuales de Supabase, Airtable, Shipday y administracion.
No copiar las claves ficticias usadas por los tests al hosting.

1. Publicar y aprobar los documentos legales. Sin ellos el nuevo formulario de
   registro esta bloqueado expresamente; el inicio de sesion existente funciona.
2. Revisar la migracion, respaldo y politicas actuales en una base de pruebas.
3. Configurar variables del preview y redirects permitidos de Supabase Auth.
4. Aplicar la migracion aprobada en el entorno elegido antes de probar sus APIs.
5. Ejecutar los comandos de validacion siguientes y una prueba real autorizada de
   alta/correo, invitacion privada, negocio propio, imagen, pedido y seguimiento.
6. Publicar de forma controlada solo con autorizacion. Conservar el despliegue
   anterior para rollback. El rollback de codigo no requiere borrar tablas nuevas.

## Validacion ejecutada

`pnpm test`: siete suites aisladas, aprobadas. Cubren modelo, JWT, propiedad,
contactos por estado, SQL repetible, versionado, RLS, notificaciones idempotentes,
fotos/galeria, catalogo, canales de envio y enlaces publicos.

`pnpm test:account-ui`: aprobada en 320, 390, 768 y 1440 px con Playwright y APIs/Auth
simuladas. Prueba visibilidad de contrasena, dos intenciones de registro, bloqueo
legal, acceso y recuperacion simulados, cambio de perfil, datos propios, favoritos,
inscripcion progresiva, fotos, galeria, horarios divididos/especiales, entregas,
estadisticas vacias y sesion expirada. Capturas `account-v2-*.png` en el checkout.

`pnpm typecheck`: aprobado. `pnpm lint`: sin errores, con advertencias de imagenes
sin next/image y hooks de componentes anteriores. Los hooks nuevos no presentan
advertencias de dependencias. `pnpm build`: aprobado con Next 14.2.35.

Se corrigieron durante las pruebas: comprobacion extra del token de propiedad,
aislamiento de snapshots por usuario, validacion de telefonos, preservacion de
campos al editar secciones, etiquetas accesibles de selectores, bloqueo de fichas
suspendidas, reintento de fotos y presentacion del menu en movil. Tambien se
corrigieron expectativas y alcance de variables en el propio guion Playwright.

## Pendientes y limites antes de afirmar una entrega completa

- No se han probado las escrituras reales, las politicas aplicadas en produccion,
  correos ni el recorrido Shipday con esta version. Build aprobado no demuestra eso.
- Documentos legales recibidos despues de esta implementacion: aun no publicados.
  Hay una propuesta de ajustes pendiente de revision en propuesta-privacidad-y-almacenamiento.md.
  La aceptacion de metadatos
  no sustituye una politica ni un registro legal de consentimientos. Revisar tambien
  el registro heredado desde invitaciones privadas antes de publicar el cambio.
- Las fichas pendientes quedan vinculadas y pueden configurar opciones, pero la
  edicion base y fotos siguen requiriendo publicacion, por la API anterior. No hay
  guardado de borrador de inscripcion entre dispositivos.
- Solicitar revision guarda fecha y auditoria; falta incorporarla a una bandeja
  administrativa. No se presenta como una revision ya atendida.
- No se consulta ni inventa informacion del mensajero que la integracion actual
  no entrega. No se creo panel courier ni permisos operativos nuevos.
- Contadores publicos requieren proteccion adicional contra automatizacion antes
  de usarlos para facturar publicidad; no son un sistema antifraude.
- La galeria limita la vista a ocho fotos, pero cargas simultaneas pueden exceder
  el limite de adjuntos almacenados. Las imagenes publicadas no son archivos privados.
- Airtable mantiene su limite actual de lectura de negocios sin paginacion, y las
  notas Aplicadas pueden prevalecer sobre cambios manuales posteriores en columnas
  originales. Revisar esto antes de crecer a cientos de fichas.
- Feed de solicitudes/pedidos esta acotado; no se implemento paginacion historica
  completa. Los recientes son de ese dispositivo, no sincronizados entre equipos.

## Archivos afectados

UI: app/mi-cuenta/*, app/mi-negocio/page.tsx, components/account/*,
BusinessEditor.tsx, BusinessRegistration.tsx, MercauDirectory.tsx.

API: app/api/mi-cuenta/*, app/api/mi-negocio/[businessId]/route.ts y /galeria,
app/api/negocios/[businessId]/actividad y /foto, /api/inscripciones, /api/deliveries.

Integracion: app/enviar/page.tsx, app/negocios/[id]/page.tsx,
lib/account-*.ts, business-edit.ts, business-photo.ts, business-gallery.ts,
public-business-settings.ts, airtable-directory.ts y deliveries.ts.

Infraestructura y pruebas: supabase/account_workspace.sql, .env.example,
package.json, pnpm-lock.yaml, .eslintrc.json y scripts/test-account-*.cjs;
regresiones de edicion, fotos, catalogo y enlaces; documentos de auditoria y entrega.
