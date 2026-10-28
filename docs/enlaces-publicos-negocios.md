# Pagina publica de cada negocio

## Alcance

Las fichas usan `/negocios/nombre-del-negocio`. El catalogo queda en
`/negocios/nombre-del-negocio/catalogo`. Los enlaces anteriores con `rec...`
siguen resolviendo y redirigen a la direccion guardada cuando existe.

Los identificadores de Airtable, propietarios, fotos, favoritos, productos,
pedidos e invitaciones privadas conservan su identificador anterior.

## Activacion

1. Ejecutar **todo el contenido** de `supabase/business_public_links.sql`
   en SQL Editor del proyecto Supabase de Mercau. No ejecutar el nombre del archivo.
2. El script crea una tabla y una funcion limitadas a `service_role`, con RLS.
   Reserva el enlace de Financial Solidity sas como primera comprobacion.
3. Desplegar la version de codigo que utiliza el registro.
4. Abrir la ficha anterior y comprobar su redireccion, nombre, imagen y catalogo.
5. Desde Panel de mi negocio usar Ver mi pagina y Compartir mi pagina.
6. Enviar el enlace por WhatsApp y comprobar su vista previa en un dispositivo real.
   La aplicacion entrega metadatos; la cache y presentacion final de WhatsApp
   requieren esta comprobacion externa.

Sin la migracion, el directorio conserva sus enlaces anteriores. Un fallo del
registro al abrir un enlace por nombre produce un error temporal, no una ficha
de otro negocio ni una respuesta falsa de negocio inexistente.

## Estabilidad y nombres repetidos

La direccion se reserva una vez en Supabase, no se recalcula al editar la ficha.
Si el nombre ya esta reservado se agrega el municipio; si sigue ocupado, un
sufijo diferenciador. Una funcion transaccional con bloqueo e indices unicos
coordina las reservas. No se borran enlaces cuando un negocio se oculta.

El registro admite alias futuros con `is_canonical=false`, pero esta entrega
no crea una pantalla para renombrar direcciones. Solamente las fichas publicadas
se muestran, aunque un enlace antiguo permanezca en el registro.

## Reversion

Restaurar el despliegue anterior en Vercel no necesita borrar la tabla ni las
reservas. No borrar el registro: esas direcciones pueden haberse compartido.
No se agregan variables de entorno; se utiliza el cliente administrativo actual.

## Pruebas

`node scripts/test-business-public-links.cjs` valida generacion, resolucion,
compatibilidad, metadatos, enlaces y paso del ID original al catalogo/pedidos.
Las pruebas de interfaz locales usan datos simulados y no generan envios reales.

## Verificacion del 15 de octubre de 2026

- Pruebas de enlaces, resolucion, metadatos y compatibilidad: correctas.
- SQL ejecutado dos veces en PostgreSQL local aislado: correcto. Se comprobaron
  colisiones, permanencia tras cambiar nombre, alias, indices y permisos.
- La captura enviada por el usuario desde Supabase muestra una fila con
  `financial-solidity-sas` asociada al identificador de Financial Solidity.
- `node scripts/test-business-public-links-ui.cjs`: correcto en 320, 390 y 1440 px.
  Directorio compilado con API simulada, ficha y catalogo vacio con datos locales;
  enlaces de compartir comprobados sin enviar WhatsApp ni crear pedidos.
- Pruebas existentes de edicion de ficha, catalogo y consultas de pedidos: correctas.
- TypeScript y compilacion de produccion: correctos. El primer intento de build
  fallo por permisos EPERM de Windows; el segundo termino correctamente.
- No hay configuracion ESLint en el proyecto; no se declara un lint independiente.
- Despliegue activo: `dpl_GhsziU5AYTGHi6hteYY5yTk65x3t`,
  `https://mercau-ag9pg995j-financial-soliditys-projects.vercel.app`, promovido a
  `https://www.mercau.co` despues de verificar el despliegue preparado.
- El directorio publico devuelve 39 negocios con 39 direcciones distintas.
  Se comprobaron por HTTP los enlaces anteriores y nuevos de Financial Solidity,
  Kikiriki y Restaurante Mercado, con redireccion 308 y respuesta final 200.
  Los dos catalogos tambien responden 200 y conservan el ID original de pedidos.
- Navegador aislado en produccion a 390 y 1440 px: titulo, canonical, Open Graph,
  imagen real, enlace para compartir y ausencia de desbordamiento correctos.
  Menu real de Kikiriki visible en movil. Sitemap contiene los 39 enlaces.
  No se enviaron mensajes ni se crearon pedidos reales.
- `scripts/verify-business-public-links-live.cjs` reprodujo estas comprobaciones
  tanto en el despliegue preparado como en el dominio publico.
- Despliegue anterior para reversion: `dpl_DjvvGPuQA4yaaXAHJJRFeb6MkxfL`,
  `https://mercau-jwg9aum47-financial-soliditys-projects.vercel.app`.
- Pendiente externo: enviar el enlace desde WhatsApp y verificar su vista previa
  en un dispositivo real. Los metadatos publicados no prueban su cache externa.
