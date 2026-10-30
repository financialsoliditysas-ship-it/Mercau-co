# Activación autorizada de controles logísticos

Autorización del usuario: validar en aislamiento, aplicar SQL y desplegar la corrección de duplicidad y conciliación. Sin pedidos, cobros ni despachos reales de prueba. Sin nuevos proveedores, planes, facturación ni secretos.

## Corte y contexto

- Rama `fix/logistics-safety-20261029`, basada en producción `74023d2d9416c1fcd9d2f63dd20cc5d1411b99c8`.
- Proyecto Vercel `prj_9niRSTqsAByRqgHPgeaVwGU2DRaX`, equipo `team_avjo0aovSEE9UaNytTPldyfM`.
- Despliegue anterior verificado: `dpl_8fpsbV1oPsBMTfSvDa2vYScYAakS`, www.mercau.co y mercau.co.
- Supabase `qzqbtxdvubvfdhdigmhb`, PostgreSQL 17.6, funciones SHA-256 y permisos actuales de service_role para tablas/secuencias comprobados por lectura.
- La rama remota main es anterior a la versión publicada. No se hará merge ni se sobrescribirá: la entrega parte del código productivo y se publica desde su rama propia.

## Validación previa de producción, solo lectura

Se comprobaron columnas, tipos, RLS, triggers y definiciones de transición/finanzas/notificaciones. No hay IDs de Shipday duplicados ni RPC nuevas previamente instaladas. La consulta previa mostró 46 envíos entregados y uno cancelado; ninguno activo ni creado en los 30 minutos anteriores. Había dos pedidos comerciales antiguos pendientes, sin modificar ni aceptar automáticamente.

El SQL de transición marca exclusivamente filas históricas con estado created/integration_error sin ID externo. No actualiza innecesariamente el updated_at de entregados/cancelados. No modifica cálculos, pagos, QR, propietarios, roles de negocio, manifest o service worker.

## Prueba PostgreSQL independiente

Se reutilizó la imagen Supabase/PostgreSQL 17.11.0.006 ya disponible, sin descargar imágenes ni publicar puertos. Contenedor efímero con network=none y sin directorios del host montados. Solo datos ficticios.

`scripts/test-order-receipts.cjs` pasó con 57 sesiones psql independientes, incluidas llamadas concurrentes. Se aplicaron los esquemas y triggers versionados, las dos propuestas de SQL y su reaplicación; se probaron referencias distintas, ventana de cinco minutos, confirmaciones repetidas, cantidades, personalizaciones, cancelados/rechazados, incertidumbre persistente, recibos, snapshots financieros y denegaciones de permisos. El propietario de la base de prueba es supabase_admin; no se elevaron permisos productivos para hacer pasar la prueba.

Esto supera la limitación de concurrencia de PGlite, pero no es una prueba de carga ni una simulación de todas las caídas posibles. Las sesiones de navegador y llamadas externas de las otras pruebas siguen siendo simuladas.

## Migraciones autorizadas

Archivos creados con Supabase CLI 2.122.0, versiones distintas y contenido cotejado con el SQL probado:

1. `supabase/migrations/20261030132914_logistics_dispatch_controls.sql`.
2. `supabase/migrations/20261030133030_order_creation_receipts.sql`.

Aplicar por MCP apply_migration, conservando su registro del servidor. No ejecutar db push indiscriminadamente: los SQL históricos de este repositorio no constituyen una línea completa de migraciones remotas. Registrar las versiones remotas efectivas en el cierre. Los borradores se conservan como referencia, no se ejecutan otra vez como migraciones diferentes.

## Publicación y comprobación

1. Suites, lint, typecheck, build y comparación de SQL sobre el corte final.
2. Commit delimitado y push sin forzar a la rama propia, sin cambios ajenos del checkout original.
3. Compilación Vercel production con skip-domain, configuración existente y sin builds QA ni variables ficticias.
4. Confirmar nuevamente que no hay despachos en curso y aplicar las dos migraciones. Verificar permisos efectivos, RLS, funciones y ausencia de cambios financieros o de pedidos históricos.
5. Promover el mismo despliegue listo y comprobar rutas públicas, acceso privado, lookup sin sesión, webhook no autorizado, QA no expuesto y mensaje nuevo en el código servido. No crear un pedido para comprobarlo.
6. El GET real de conciliación en Shipday se comprobará cuando el operador tenga un caso autorizado. No se toma una orden real al azar ni se modifica su historial solo para producir evidencia. En caso de error, el envío sigue bloqueado.

## Reversión

Ante fallo crítico de acceso o pedidos, el despliegue anterior es restaurable. Conservar recibos, marcas e historial; no revertir datos ni borrar columnas. La versión anterior no usa las reservas nuevas: volver a ella reintroduce la limitación de duplicados anterior y requiere restringir operativamente reintentos mientras se corrige. No presentar un rollback como si conservara todos los controles nuevos.

El pedido real controlado y las comprobaciones físicas Android/iPhone requieren coordinación posterior; no forman parte de esta publicación automática.
Revisado por el propietario para continuar la publicación.
