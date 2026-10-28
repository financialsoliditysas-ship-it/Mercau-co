# Foto principal o logo

Panel de mi negocio > Editar ficha > Seleccionar imagen > Guardar imagen.
Solo una relacion activa y autenticada de business_admins puede subir una imagen.
No cambia la cuenta, los textos ni el contacto del negocio.

Se reutiliza Foto principal de Airtable, sin nuevas variables, tablas o proveedores.
POST /api/mi-negocio/[businessId]/foto prepara un adjunto mediante la API oficial:
https://airtable.com/developers/web/api/upload-attachment
La clave de Airtable permanece en el servidor. JPG, PNG y WebP; salida maxima 2 MB.
El navegador reduce dimensiones a 1600 px sin recortar; conserva proporcion.
Logo usa object-contain; foto usa object-cover. No se generan imagenes.

La nueva imagen queda primero y los adjuntos previos se conservan por sus IDs.
Un nombre con UUID y hash permite recuperar reintentos secuenciales sin volver a subir.
Las operaciones subir/reordenar no son una transaccion: cargas simultaneas pueden
cambiar cual imagen queda primero. Recargar antes de reintentar si hay un fallo.

GET /api/negocios/[businessId]/foto devuelve una redireccion a un adjunto fresco
solo para fichas publicadas. No se guardan URLs temporales de Airtable.
El endpoint consume lecturas de Airtable, con cache HTTP breve; revisar cuota al crecer.
El directorio conserva el icono de categoria si no hay foto o esta no carga.

Pruebas: node scripts/test-business-photo.cjs y node scripts/test-business-edit.cjs.
