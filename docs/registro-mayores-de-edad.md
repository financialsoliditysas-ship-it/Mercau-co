# Registro de personas de 18 anos cumplidos

## Implementacion local

- Fecha de nacimiento obligatoria al crear cuenta de comprador, propietario o
  desde la invitacion privada. El acceso de cuentas existentes no la solicita.
- Se aceptan 18 anos cumplidos, incluyendo el dia del cumpleanos.
- Se rechazan fechas inexistentes, futuras o correspondientes a menores de 18.
- El calculo usa el dia calendario de America/Bogota, no dias divididos entre 365.
  Para nacimientos del 29 de febrero, en anos no bisiestos pasa el control el 1 de marzo.
- `birth_date` se envia a Supabase Auth como dato privado de la cuenta. No se agrega
  a fichas, catalogos, estadisticas del vendedor ni payloads de Shipday.
- No se modifican ni se presume la edad de las cuentas existentes.
- Es edad declarada, no verificacion de identidad. user_metadata es editable;
  esta declaracion no debe usarse como un rol ni mostrarse como identidad verificada.

## Validacion de servidor pendiente de activar

`supabase/account_adult_signup.sql` crea la funcion
`public.hook_mercau_adult_signup(event jsonb)` para el hook oficial Before User Created.
Comprueba birth_date usando la fecha del servidor y rechaza la solicitud con un
mensaje de edad si falta o no cumple. No almacena ni crea usuarios por si sola.
El ayudante y el hook solo pueden ejecutarse por supabase_auth_admin, no por el
cliente anon/authenticated. No se necesita otra credencial ni proveedor.

Aplicar SQL no activa el hook. En Authentication > Hooks del proyecto se debe
seleccionar Before User Created y esta funcion de PostgreSQL. Coordinar esa
activacion con los formularios nuevos; los formularios antiguos no envian fecha.
Probar en un proyecto de prueba antes de activar en produccion, incluidas altas
por invitaciones y administracion. No se ejecuto este SQL ni se cambio Auth de
produccion en este trabajo. Sin activacion, el control del navegador no es una
restriccion de registro en el servidor.

## Comprobacion

`scripts/test-account-age.cjs` contrasta el calculo JavaScript con PostgreSQL local,
limites de cumpleanos, bisiestos, fechas invalidas/futuras, medianoche de Colombia,
ejecucion repetida de SQL, rechazo del hook y permisos. No crea cuentas reales.
El guion Playwright de Mi cuenta comprueba el campo, el mensaje al indicar una
fecha de menor de edad y el resto del flujo con una fecha adulta ficticia.

## Documentos recibidos

Se leyeron los tres Word aportados el 15 de octubre. No se editaron ni publicaron.
Los terminos ya dirigen las cuentas a mayores de edad. Antes de integrar su
version definitiva se registran estas decisiones del titular:

1. Confirmado: Mercau y Vega Express son marcas de Financial Solidity S.A.S.
2. Autorizado preparar una propuesta de informacion de cookies, sin publicarla.
3. Autorizado preparar una mencion de la finalidad del nuevo campo de nacimiento. No se
   presume que la politica aportada sea juridicamente insuficiente; se propone
   que el texto describa con claridad este dato y su finalidad.

La propuesta separada esta en `docs/propuesta-privacidad-y-almacenamiento.md`.

Los enlaces pendientes del aviso deben apuntar a las paginas definitivas. Las
instrucciones de implementacion incluidas en el tercer Word no se ejecutaron
como una autorizacion para cambiar contratos, recaudo o despacho logistico.

## Fuentes consultadas

- Ley 27 de 1977: https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=4965
- Concepto SIC, noviembre de 2025: https://sedeelectronica.sic.gov.co/sites/default/files/publicaciones/25-494351%20RVDO.pdf
- Supabase Before User Created: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- Modelo de permisos del hook: https://supabase.com/docs/guides/auth/auth-hooks

La regla de 18 anos es una politica solicitada para Mercau. No se presenta como
una prohibicion legal universal de todas las cuentas de menores en internet.
