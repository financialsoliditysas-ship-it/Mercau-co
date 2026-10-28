# Propuesta de ajustes de privacidad y registro

**Para revision. No publicada.** Fecha: 15 de octubre de 2026.

Esta propuesta no modifica los tres Word recibidos ni certifica cumplimiento
juridico. Se limita al nuevo control de edad y a describir las tecnologias
identificadas. Debe aprobarse antes de incorporar texto a las paginas publicas.

## 1. Estructura empresarial confirmada

El titular confirmo que Mercau y Vega Express son marcas de Financial Solidity
S.A.S. Se conserva esa estructura de los documentos aportados; no se propone
cambiarla ni describirlas como dos sociedades independientes.

## 2. Texto sugerido para la politica de datos

Agregar al numeral 2, Datos recolectados y origen:

> Para crear una cuenta solicitamos su fecha de nacimiento, que utilizamos para
> calcular la edad declarada y comprobar que sea de al menos 18 años cumplidos
> al registrarse. Este dato no se publica en la ficha de un negocio ni se incluye
> en la información comunicada al negocio o al domiciliario para una entrega.
> Declarar una fecha no constituye, por sí solo, una verificación de identidad.
> Esta finalidad no autoriza el uso de la fecha de nacimiento para publicidad
> ni para elaborar perfiles comerciales.

Agregar al numeral 3, Finalidades necesarias para cada servicio:

> Comprobar el requisito de edad declarada para crear una cuenta. No se exige
> aportar la fecha de nacimiento para consultar el directorio como visitante.

Esta redaccion describe la implementacion preparada; no afirma que el control ya
este activo en produccion. No se propone guardar edades calculadas que queden
desactualizadas ni completar fechas inexistentes de usuarios antiguos.

## 3. Texto breve para el formulario

Campo: **Fecha de nacimiento**.

Ayuda junto al campo:

> Debes tener 18 años cumplidos para crear una cuenta.

Mensaje si la fecha declarada no cumple:

> Para crear una cuenta en Mercáu debes tener 18 años cumplidos.

El tercer Word ya separa aceptacion contractual, autorizacion de datos y
publicidad opcional. Mantener esa separacion. Se propone agregar la finalidad
del control de edad a las autorizaciones de datos de compradores y negocios,
sin combinar las dos casillas obligatorias ni activar publicidad por defecto.

Frase para incorporar a ambas autorizaciones de datos:

> También autorizo el tratamiento de mi fecha de nacimiento para comprobar el
> requisito de edad declarada de acceso a la cuenta.

No se propone solicitar cedula, biometria ni documentos adicionales en este MVP.
Los terminos aportados ya contienen la regla de edad; no se reescribe ese apartado.

## 4. Propuesta de pagina de cookies y almacenamiento

Ruta propuesta, todavia no creada ni publicada: `/cookies-y-almacenamiento`.

### Texto para revision

**Cookies y almacenamiento del navegador en Mercáu**

Mercáu utiliza almacenamiento del navegador para funciones como mantener una
sesión de cuenta y recordar los negocios guardados. Las cookies, el
almacenamiento local y el almacenamiento de sesión son mecanismos distintos.
El almacenamiento local puede conservarse entre visitas; no tiene un vencimiento
automático establecido por los campos actuales de la aplicación.

**Sesión de cuenta.** Cuando inicia sesión, el cliente de Supabase utiliza
almacenamiento local para conservar el estado de autenticación y renovar la
sesión conforme a su configuración. La aplicación no guarda en este espacio
su contraseña en texto plano. Cerrar sesión o eliminar los datos del sitio
retira el acceso guardado en ese navegador. La duración de la sesión depende
de la configuración del servicio de autenticación; no se ofrece un plazo fijo
de conservación de tokens en este texto.

**Favoritos.** Los identificadores de los negocios guardados pueden conservarse
en el almacenamiento local. Si utiliza una cuenta y sincroniza sus favoritos,
también existen registros asociados a esa cuenta en la base de datos. Borrar
los datos del navegador no elimina por sí solo esos registros sincronizados.
Puede gestionar sus favoritos desde las funciones disponibles de la plataforma.

**Activación de una ficha.** Al utilizar una invitación privada, puede guardarse
un indicador local para retomar la vinculación después de confirmar el correo.
El código lo retira cuando la activación termina correctamente. Si se
interrumpe el proceso, puede permanecer hasta que se complete o se eliminen
los datos del sitio. No comparta su enlace de invitación.

**Medición propia.** La aplicación registra eventos de uso, como visitas,
búsquedas, categorías consultadas y clics de contacto, mediante su propia API.
El flujo de eventos revisado no utiliza una cookie analítica ni envía un campo
de identificador de cuenta en ese payload. Esto no significa que todos los
datos técnicos de infraestructura estén anonimizados ni sustituye la política
de tratamiento de datos. Evite escribir datos personales sensibles en el
buscador. Los usos de publicidad personalizada requieren una decisión específica
cuando corresponda.

**Servicios externos.** Los botones que abren WhatsApp, Google Maps o una red
social llevan a servicios externos. Esta página describe los mecanismos de
Mercáu, no la totalidad de las tecnologías que esos servicios utilicen cuando
usted los abra. Consulte sus avisos y políticas al acceder a ellos.

**Gestión desde el navegador.** Puede eliminar los datos del sitio y configurar
su navegador para limitar su almacenamiento. Esto puede cerrar la sesión o
impedir recordar preferencias locales. Para ejercer derechos sobre información
conservada en los servidores, escriba a gerencia@financialsolidity.com, de
acuerdo con la Política de tratamiento de datos personales.

**Tecnologías opcionales.** La incorporación futura de píxeles publicitarios,
analítica identificable u otras tecnologías opcionales requerirá actualizar esta
información y ofrecer las decisiones que correspondan antes de activarlas. Esta
propuesta no declara instaladas tecnologías que no fueron identificadas.

### Incorporar solo junto con el rediseño

El codigo nuevo tambien guarda recientes de hasta doce negocios y claves de
sincronizacion de favoritos separadas por cuenta. No estan confirmados como
desplegados. Si se publica el rediseño, agregar este texto a la pagina:

> La sección de vistos recientemente conserva en este dispositivo una lista de
> hasta doce fichas visitadas. No se envía esa lista a los negocios para campañas.
> Los cambios pendientes de favoritos pueden conservarse localmente para
> reintentar la sincronización; se retiran tras una sincronización correcta.

## 5. Inventario tecnico comprobado

| Mecanismo | Evidencia | Persistencia establecida en el codigo |
| --- | --- | --- |
| localStorage, `mercau.favoriteBusinessIds` | Version base publicada y portada revisada | No tiene TTL automatico; conserva identificadores de favoritos |
| localStorage, `sb-<proyecto>-auth-token` | Supabase SDK y persistSession en el cliente | Sesion persistente y renovacion; plazos de Auth no auditados en el panel |
| localStorage, `mercau.pendingBusinessAccess.<invitacion>` | Formulario de invitacion privada | Se borra al completar activacion; no hay TTL si queda incompleta |
| localStorage, favoritos v2 y cambios pendientes | Rediseño local, no publicado | Sin TTL; pendientes se retiran al sincronizar correctamente |
| localStorage, `mercau.recent.v2.<cuenta>` | Rediseño local, no publicado | Hasta doce fichas; sin TTL |
| API propia `/api/metricas` y almacenamiento Airtable | Version base del directorio | Eventos con fecha/tipo/categoria/busqueda/ruta; no es almacenamiento del navegador |
| Agregados por ficha en Supabase | Rediseño local, no publicado | Conteos diarios, no historial individual entregado al negocio |

No se identificaron Google Analytics, Meta Pixel, Hotjar o Clarity en los archivos
de aplicacion revisados ni en las peticiones de la observacion de portada. No es
una afirmacion sobre todas las paginas, cuentas, navegadores o cambios futuros.
No se verificaron cookies o retenciones configuradas fuera del codigo, en paneles
de proveedores, ni sesiones reales autenticadas.

## 6. Evidencia de la observacion publica

15 de octubre de 2026, 19:50 UTC, navegador nuevo sin sesion, portada
`https://www.mercau.co/`, respuesta 200. Durante esa observacion:

- Cookies visibles en el contexto: ninguna.
- localStorage: `mercau.favoriteBusinessIds`.
- sessionStorage: sin claves.
- Dominio de peticiones observado: www.mercau.co.
- Se intercepto el POST de visita a `/api/metricas` para no contaminar estadisticas.
  Tambien se bloquearon otras posibles escrituras. No se crearon usuarios o pedidos.

La observacion dura cinco segundos despues de cargar la portada, no cubre
inicio de sesion, enlaces externos ni navegacion completa. Un resultado sin
cookies en esta prueba no demuestra ausencia de cookies en toda la plataforma.
El guion reproducible es `scripts/audit-browser-storage.cjs` y no guarda valores
de cookies, tokens ni datos de cuentas reales.

## 7. Decisiones antes de publicar

1. Aprobar o ajustar las frases de nacimiento y el texto de almacenamiento.
2. Crear la pagina definitiva y reemplazar el marcador de cookies del segundo Word.
3. Definir las URLs permanentes de terminos, politica y aviso, asi como su version
   y fecha efectiva. Conservar la posibilidad de consulta y descarga indicada en ellos.
4. Guardar evidencia de aceptacion/autorizacion de forma verificable en el servidor.
   Los metadatos editables de Auth no deben presentarse como prueba inalterable.
5. Revisar las otras obligaciones operativas de los documentos: informacion y
   aceptaciones del domiciliario, reclamaciones con radicado/seguimiento y permisos
   opcionales por canal. No se implementaron por el hecho de recibir estos Word.

No se propone activar un banner de publicidad con proveedores inexistentes ni
presentar la pagina como una certificacion de cumplimiento. La publicacion de
documentos y el despliegue de funciones quedan pendientes de autorizacion.
