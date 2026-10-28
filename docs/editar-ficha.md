# Edición directa de fichas

Desde /mi-negocio, Editar ficha abre los valores públicos actuales. Guardar cambios publica descripción, dirección, horario, domicilios, Instagram, Facebook y Google Maps sin aprobación intermedia.

GET/PATCH /api/mi-negocio/[businessId] comprueba usuario confirmado, business_admins Activo y correspondencia del token privado con la ficha. La intención comercial en metadata no concede permisos. No permite editar nombre, categoría, municipio, WhatsApp principal, administrador, estado, fotos o productos desde este formulario.

Se reutiliza Solicitudes de actualización de Airtable: la edición se guarda como Aplicada desde su creación, con la ficha vinculada y un comentario interno JSON owner_edit que registra actor, request_id, antes, después y fecha. Una única escritura conserva datos y trazabilidad; no hay una nueva migración. Se mantiene el patrón actual del directorio, donde la última actualización aplicada complementa la fila original de Negocios. Los campos opcionales vacíos de owner_edit se respetan, sin reaparecer los antiguos valores. Las solicitudes antiguas siguen funcionando.

El hash del contenido detecta fichas desactualizadas. Los reintentos secuenciales del mismo request_id no crean otro registro; se verifica actor/ficha/contenido. Airtable no ofrece aquí una escritura condicional transaccional: dos envíos simultáneos pueden pasar la comprobación a la vez. No afirmar que esto es bloqueo distribuido ni idempotencia concurrente. Una respuesta perdida conserva el request_id en el formulario para reintentar.

Pruebas: node scripts/test-business-edit.cjs, node scripts/test-business-editor-ui.cjs. Casos autenticados y guardados usan dobles locales; no modifican fichas reales. Verificar guardado real tras despliegue con un dato aprobado por el propietario. Restauración administrativa posible mediante una nueva actualización aplicada, usando el before del historial; no hay botón automático de rollback todavía.
