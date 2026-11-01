# Revision local: alarma del restaurante en segundo plano

Incidente informado: Asados el Choli, PWA instalada en iPhone, dejada en segundo plano.
No se conocen modelo ni version iOS. No es una prueba fisica realizada por el agente.

## Evidencia del codigo anterior

En RestaurantPilot, el rechazo de audio.play() al anunciar un pedido o ejecutar
la prueba diferida ponia alertsEnabled y alertsEnabledRef en false. No distingue
un bloqueo del navegador de una pausa elegida por el operador. La configuracion
solo existia en memoria, por lo que una recarga empezaba con sonido desactivado.
El boton push decia "Push y alarma activos" aunque no verificaba audio local.

## Cambio propuesto, no publicado

- Conservar la preferencia cuando falla el audio, mostrar reactivacion necesaria.
- Guardar solo on/off por cuenta y negocio en almacenamiento local, sin tokens.
- Tras recarga, restaurar la preferencia indicando que hace falta comprobar audio
  con un toque; no presentar la reproduccion como autorizada automaticamente.
- Al volver al panel, volver a consultar y reintentar el audio pendiente solo si
  todavia existe un pedido pendiente de aceptar.
- Mantener pausa explicita, incluso cuando la reproduccion esta bloqueada.
- Separar la etiqueta del push de la alarma local y conservar su suscripcion.
- Un fallo del constructor Notification en pagina no interrumpe el render del pedido.
- No cambiar service worker, claves VAPID, suscripciones, backend, estados o despachos.

## Limite de plataforma

Una pagina puede ser suspendida o descartada en segundo plano. Conservar on/off no
mantiene ejecutandose el audio. No se promete alarma larga con PWA oculta o iPhone
bloqueado. El push usa la notificacion del sistema, sus permisos, silencio y Enfoque.
No se crean bucles de audio silencioso ni se intenta eludir politicas del sistema.

Documentacion contrastada:
- https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
- https://webkit.org/blog/13878/
- https://webkit.org/blog/6784/new-video-policies-for-ios/

## Comprobacion

QA automatizada ejecutada: componentes reales, sesion ficticia, Audio y Notification
simulados, error de reproduccion, vuelta visible, reactivacion por gesto, pausa y
recarga. El constructor Notification simulado tambien rechaza su uso, sin impedir
la aparicion del pedido. Chrome emulado no sustituye WebKit/iPhone fisico ni recepcion real de push.
No enviar avisos o pedidos reales sin coordinacion/autorizacion.

Costo: infraestructura y APIs existentes, sin proveedores, suscripciones o librerias
nuevas. No cambios productivos o publicaciones sin autorizacion.

Para validar el problema reportado hace falta repetir en el iPhone de Choli:
panel abierto -> sonido activado -> otra app -> aviso push -> volver al panel.
Registrar por separado: aviso recibido, sonido del sistema, alarma local y estado
de reactivacion. Comprobar tambien silencio y Enfoque con su operador; no cambiarlos
remotamente ni prometer una duracion o volumen de notificacion no controlados por web.
