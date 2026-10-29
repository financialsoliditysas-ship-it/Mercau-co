# Corte integral: alcance versionado

Esta entrega une la presentacion V3, navegacion, Home y puente PWA ya registrados con el comprador visual aprobado. No implica autorizacion de publicacion.

## Incluido

- Inicio, Restaurantes/Comercios, filtros, busqueda, favoritos y destino de exploracion conservados.
- Cuenta/perfil y Mis pedidos conectados a las rutas existentes y a su autenticacion/consulta/guardado actuales.
- Menu visual activado en la ruta comercial para negocios que ya tenian pedidos habilitados. No habilita pedidos para otros negocios. Las fotografias proceden del catalogo publico existente o de la foto del negocio, no de productos ficticios.
- Personalizacion, cantidades, precios, direccion guardada, edicion opcional, pagos y QR existentes; revision y seguimiento con la presentacion aprobada.
- Los catalogos sin pedidos conservan su recorrido de consulta por WhatsApp. No se convierten en marketplace por este corte.
- `/` presentacion; `/comprar` experiencia del comprador. Manifest y service worker sin cambios; puente de entrada instalado ya aprobado.
- Exclusiones explicitas de QA y outputs en el paquete Vercel; adaptadores de pruebas solo usados localmente.

## Excluido expresamente

El prototipo BuyerCheckout, su ruta/API ficticias, cotizacion v2, huellas de checkout, nueva validacion sin barrio y SQL buyer_checkout no se incluyen en los commits de esta integracion. Sus originales se conservaron en el arbol local y en `outputs/integral-launch-originals-20261029`; no se eliminaron para ocultar diferencias. Tampoco se incorporan cambios ajenos del staging previo.

Los metodos del servidor de restaurante permanecen como en `87783fc`: no se incorpora la propuesta funcional pendiente. Cambiar el requisito de barrio, habilitar recogida o alterar validaciones queda fuera.

La rama contiene desde `80b965a` cambios de seguridad logistica, con dependencias de SQL/configuracion pendientes. Se evalua ese bloqueo separado en el informe final; no se considera resuelto por aprobar el diseño. No se aplican SQL ni secretos aqui.

## Reproduccion

Los commits se realizan con rutas explicitas y `commit --only`, no con `git add .`. Se conserva la identidad tecnica local utilizada en los commits anteriores: Mercau Development, development@mercau.local, solo mediante opciones del comando, sin modificar la configuracion global.

`qa/export-integral-release.cjs` exporta exclusivamente HEAD mediante git archive y reutiliza dependencias instaladas por junction. No copia archivos sin commit, env ni credenciales. `qa/check-integral-build.cjs` ejecuta suites, lint, typecheck, build y regresiones sobre esa exportacion exacta. Los tests visuales usan respuestas ficticias; no simulan haber probado instalaciones reales.

El ensayo de autenticacion y guardado usa solamente el Supabase local existente, sus migraciones completas y una cuenta ficticia. La prueba puede necesitar iniciar de nuevo Docker/Supabase local; no autoriza modificaciones del sistema, recursos remotos o migraciones productivas.

## Reversion

Antes de una futura publicacion autorizada, registrar deployment anterior y commit candidato. Revertir los commits delimitados de integracion visual en una rama limpia permite retirar estas conexiones sin borrar cuentas/catalogos/pedidos. No usar reset hard ni eliminar SQL/datos. La seguridad logistica, por requerir configuracion propia, necesita su plan operativo separado si se autoriza su incorporacion.
