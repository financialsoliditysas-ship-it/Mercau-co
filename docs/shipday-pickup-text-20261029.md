# Instruccion de recogida: importe primero

Cambio local aprobado por el usuario. No constituye autorizacion de despliegue ni de actualizar pedidos existentes en Shipday.

Presentacion del texto enviado al proveedor:

```text
ENTREGAR AL NEGOCIO: $51.000 COP

Recoger pedido confirmado.
Cobro al cliente mediante transferencia Bre-B.
```

El monto viene del mismo merchant_net de la instruccion existente. El adaptador solo separa y formatea ese texto; no lo calcula, no redondea decimales ni lo escribe nuevamente en el libro financiero. Acepta unicamente las tres frases generadas actualmente: efectivo, transferencia al recibir o pago ya confirmado. Los textos manuales o formatos no reconocidos se conservan sin cambios. La ubicacion de recogida se agrega como antes.

La modificacion esta en lib/shipday.ts y un formateador puro, no en lib/restaurant-pilot.ts, que conserva otros borradores locales fuera de esta entrega. No agrega llamadas, reintentos, despachos, campos API o dependencias. No envia HTML ni promete color/negrita en la aplicacion de Shipday.

Impacto cuando se publique: nuevas solicitudes que Mercau envie a Shipday llevaran el texto nuevo. No se edita ningun envio ya creado ni se vuelve a despachar para actualizarlo. La presentacion fisica de saltos de linea en Shipday queda pendiente de comprobar en el proximo pedido controlado autorizado.

scripts/test-shipday-pickup-text.cjs verifica cero, un peso, separadores de miles, enteros sin perdida de precision, formatos no reconocidos, las tres variantes de pago y el payload del proveedor. Se usan seis respuestas simuladas, no llamadas reales. Se comparan todos los campos salvo pickupInstruction y los horarios generados independientemente.

El contrato de proteccion del backend admite solo el import del formateador y su aplicacion al texto; el resto de lib/shipday.ts sigue comparandose con su hash anterior. No se cambia el hash de referencia ni se excluye el archivo del contrato.

Verificacion final sobre exportacion limpia de dd51a43: pasaron las 23 suites aisladas, Home/PWA, lint, build, typecheck, navegacion, recorridos integrales y restricciones QA en produccion local. Sin llamadas operativas reales. Pendiente: autorizacion de despliegue y comprobacion visual en Shipday durante un pedido controlado autorizado. Sin costos nuevos, SQL, cambios de claves o configuracion externa.
