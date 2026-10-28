# Kikiriki: pedidos del catalogo

## Activacion

1. Ejecutar el contenido de `supabase/restaurant_live_orders.sql` en el SQL Editor de Supabase.
   Es transaccional y exige un administrador activo existente y productos publicados.
   No vincula cuentas nuevas ni crea pedidos. La tarifa configurada es COP 5.000.
2. Desplegar el codigo revisado y verificar el menu y los permisos antes de recibir clientes.
3. Cliente: `/negocios/rece62hjPb3DM0l8P/catalogo`.
4. Dueno: Mi negocio > Pedidos de mi negocio, o `/mi-negocio/rece62hjPb3DM0l8P/pedidos`.

## Flujo

Cliente con correo confirmado, carrito, direccion urbana de Nechi, resumen, confirmar.
El servidor obtiene precios, productos disponibles y tarifa de Supabase. Guarda un pedido
en espera. El administrador activo de esa ficha acepta o rechaza. Al marcar Listo,
la funcion transaccional crea una solicitud logistica y el servicio existente la envia a Shipday.
Un fallo de Shipday conserva la solicitud, con reintento desde Admin / Envios.
El cliente consulta Mis pedidos en el mismo menu. No ve clientes ajenos ni acciones de administracion.

Solo efectivo contra entrega. El total es productos mas domicilio. No se habilitan pagos
en linea, liquidaciones ni nuevas comisiones. Los identificadores conservan el prefijo PRB
del piloto; MCU identifica la solicitud logistica. No confundir el prefijo PRB con cobro simulado:
la configuracion `is_live` distingue pedidos reales de Restaurante Mercado.
La aceptacion sigue siendo manual; no se interpreta automaticamente el horario libre de Airtable.

## Pausar sin borrar

```sql
update public.pilot_restaurants set enabled = false where id = 'rece62hjPb3DM0l8P';
```

Esto bloquea nuevos pedidos y despachos; conserva el menu y permite ver los pedidos anteriores.
No se modifica la configuracion ni los miembros de Restaurante Mercado.

## Prueba real pendiente de autorizacion

Coordinar con el negocio y un mensajero antes de confirmar un pedido real.
Aceptar, marcar Listo, verificar total en Shipday y completar entrega.
No ejecutar esa prueba como parte automatica del despliegue.
