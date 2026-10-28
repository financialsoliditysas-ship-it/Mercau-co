# Mi cuenta unificada

## Intención y permisos

El registro pide nombre, correo, contraseña, municipio y dirección de entrega, con radios "Quiero pedir y guardar favoritos" / "Quiero registrar mi negocio". Barrio y referencia son opcionales. account_intent es una preferencia de interfaz, no un permiso. Nombre y datos de entrega previos se conservan; el celular se puede guardar después y se exige al solicitar pedidos. Cuentas sin intención explícita y sin ficha vinculada se muestran como personales.

La navegación personal contiene favoritos, pedidos del piloto y datos. Negocios activos de business_admins aparecen por consulta de su user_id; el panel logístico sigue comprobando la membresía en su API. El botón público de inscripción conserva su destino y permite añadir intención comercial a la misma cuenta.

Invitación existente: /actualizar/[token] admite crear cuenta o entrar con una cuenta existente. La activación se envía a POST /api/actualizaciones/[token]/activar. El servidor comprueba correo confirmado, token privado de Airtable y exclusividad del enlace; deriva los campos desde la ficha, no desde el navegador, y dirige a /mi-negocio. No se crean fichas nuevas.

ANTES de desplegar esta activación, ejecutar supabase/business_access_server_only.sql: retira escritura directa a business_admins para usuarios, mantiene lectura RLS y filas existentes. No se ha ejecutado esta migración ni probado invitación real. El enlace actual no tiene todavía vencimiento ni revocación administrativa nueva. Las ediciones siguen con revisión: este cambio no implementa aún edición directa ni historial de cambios públicos.

Rutas: /mi-cuenta para entrar/registrarse/perfil; /mi-cuenta/inscribir-negocio para el formulario existente, con sesión requerida. La portada no contiene esos formularios. El botón de inscripción lleva a /mi-cuenta?next=inscribir-negocio y tras entrar conserva ese destino. La confirmación de correo conserva también la intención. Solo se permite ese destino fijo, no URLs arbitrarias. Los enlaces antiguos #cuenta/#inscripcion se redirigen.

La API /api/inscripciones ahora verifica el Bearer token con Supabase antes de escribir en Airtable. No asigna administración de la ficha al solicitante automáticamente. La aprobación/vinculación existente sigue separada. Agregar /mi-cuenta y /mi-cuenta?next=inscribir-negocio a los redirect URLs permitidos de Supabase antes de probar confirmación real.

Registro: nombre, celular colombiano, correo, contraseña, municipio, barrio, dirección y referencia opcional. Inicio de sesión por correo y contraseña, no por SMS/WhatsApp.

Los datos de entrega se guardan con signUp/updateUser en auth.users.user_metadata.delivery_profile. No requiere migración. Son datos editables del usuario, nunca una fuente de permisos. El correo de Auth sigue siendo la identidad de acceso. No se modifica el teléfono de autenticación ni los permisos business_admins/pilot_restaurant_members.

La dirección se precarga en /enviar y en el checkout del piloto, sin sustituir los campos que la persona ya escribió. Confirmar la dirección antes de enviar. Guardar una dirección no amplía la cobertura logística.

Mi cuenta contiene favoritos, solicitar envío, pedidos del piloto y Mi negocio. El acceso visible al panel de pedidos del restaurante depende de la autorización comprobada por su API. Registrar negocio sigue siendo la inscripción existente, no una asignación de permisos.

Pendiente antes de abrir el registro comercial: revisar textos y enlaces aprobados de términos/política de datos y consentimiento separado; SMTP y redirect URLs de Supabase; probar confirmación y recuperación reales. No se añadió autorización promocional implícita. El piloto de restaurantes continúa por invitación.

No hay aún historial unificado de todos los envíos por usuario ni editor de productos nuevo en Mi negocio. Estos enlaces conducen a las funciones actuales.

Verificación local: node scripts/test-account-ui.cjs con servidor Next en puerto 3022. Ninguna cuenta real ni envío se crean por ese test.
