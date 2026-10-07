# MVP logistico Mercau + Shipday

## Arquitectura

```txt
Web / WhatsApp futuro
  -> POST /api/deliveries
  -> delivery_orders en Supabase
  -> ShipdayProvider
  -> Shipday API
  -> POST /api/webhooks/shipday
  -> delivery_status_history
  -> /envio/[public_id]
```

Mercau queda como system of record. Shipday se usa como proveedor logistico externo.

## Variables de entorno

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SHIPDAY_API_KEY=
SHIPDAY_API_BASE_URL=https://api.shipday.com
SHIPDAY_WEBHOOK_TOKEN=
DELIVERY_FEE_COP=5000
ADMIN_METRICS_PASSWORD=
```

`SHIPDAY_WEBHOOK_TOKEN` debe tener maximo 32 caracteres porque Shipday lo envia en el header `token`.

## Tablas

Ejecutar `supabase/delivery_orders.sql` en Supabase SQL Editor.

Tablas creadas:

- `delivery_orders`
- `delivery_status_history`

## Endpoints

- `POST /api/deliveries`: crea una orden Mercau y luego intenta crearla en Shipday. Sirve para web y para WhatsApp futuro usando `source = WHATSAPP`.
- `POST /api/webhooks/shipday`: recibe eventos de Shipday. Valida el header `token` si `SHIPDAY_WEBHOOK_TOKEN` esta configurado.
- `GET /api/admin/envios`: lista envios con header `x-admin-password`.
- `POST /api/admin/envios`: permite `history` y `retry_shipday`.

## Configuracion manual en Shipday

1. Crear o usar la cuenta de Shipday.
2. Copiar la API key desde My Account en Dispatch Dashboard.
3. Configurar en Vercel `SHIPDAY_API_KEY`.
4. Configurar webhook de estado de orden hacia:

```txt
https://www.mercau.co/api/webhooks/shipday
```

5. Si Shipday solicita validation token, usar el valor configurado en `SHIPDAY_WEBHOOK_TOKEN`.
6. La asignacion de mensajeros debe configurarse y probarse en Shipday Dashboard o en Shipday Drive. Este MVP no implementa algoritmo propio.

## Estados mapeados

- `ORDER_ASSIGNED` y `ORDER_ACCEPTED_AND_STARTED` -> `assigned`
- `ORDER_PIKEDUP` -> `picked_up`
- `ORDER_ONTHEWAY` -> `in_transit`
- `ORDER_COMPLETED` -> `delivered`
- `ORDER_FAILED` y `ORDER_INCOMPLETE` -> `failed`
- `ORDER_DELETE` -> `cancelled`

## Prueba API tipo WhatsApp

```bash
curl -X POST https://www.mercau.co/api/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "source": "WHATSAPP",
    "serviceType": "Enviar un paquete",
    "customerName": "Cliente prueba",
    "customerPhone": "3001234567",
    "pickupName": "Punto de recogida",
    "pickupAddress": "Calle 1 # 2-3",
    "pickupNeighborhood": "Centro",
    "pickupContact": "Contacto recogida",
    "pickupPhone": "3001234567",
    "pickupInstructions": "Preguntar por caja",
    "deliveryName": "Destinatario prueba",
    "deliveryAddress": "Carrera 4 # 5-6",
    "deliveryNeighborhood": "Barrio prueba",
    "deliveryPhone": "3007654321",
    "deliveryInstructions": "Casa azul",
    "description": "Paquete pequeno",
    "notes": "Prueba WhatsApp"
  }'
```

## Casos de prueba

- Caso A: crear orden desde `/enviar` con Shipday configurado.
- Caso B: quitar temporalmente `SHIPDAY_API_KEY` o usar una key invalida para comprobar `integration_error`.
- Caso C: enviar dos veces el mismo webhook con igual `event`, `timestamp` y `order.id`; el historial no debe duplicarse por `dedupe_key`.
- Caso D: simular webhook `ORDER_COMPLETED` y revisar `/envio/MCU-XXXXXX`.
- Caso E: crear orden con `source = WHATSAPP` usando `POST /api/deliveries`.
