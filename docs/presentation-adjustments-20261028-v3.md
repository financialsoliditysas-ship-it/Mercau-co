# Presentacion V3: cuatro ajustes sobre V2

Estado: revision local pendiente de comprobacion fisica. No publicada.
Base aprobada conservada: `visual-presentation-20261028-v2`, con sus 38 copias y hashes originales.
Revision: `presentation-adjustments-20261028-v3`. No constituye una nueva aprobacion.

## Alcance

Solo se modificaron `components/presentation/Presentation.tsx` y `app/presentacion-revision/presentation.css` en la aplicacion. Se agregaron herramientas de comprobacion y entrega fuera del corte V2. No se incorporaron dependencias, servicios contratados, consultas productivas nuevas ni cambios de planes.

- Portada: imagen movil contenida dentro de su contenedor; telefono centrado y proporcionado; menor reserva inferior del texto. No se aumento la altura. Comparacion binaria de las capturas de portada a 1440 px: identicas.
- Tarjetas: se retiraron reservas de altura excesivas, se compactaron separaciones y se conservaron las fotografias, identificaciones, nombres completos y tres acciones originales. CTA con altura minima de 44 px y alineados. No se modificaron las reglas comerciales ni el carrusel.
- Mapa: se retiro la fila duplicada inferior. Las etiquetas sobre el mapa en movil usan controles de al menos 44 px, nombres accesibles, `aria-pressed`, foco visible y marca de verificacion. En escritorio se conservaron las etiquetas SVG con seleccion por Enter/Espacio y una marca de verificacion. Tarjeta, boton, almacenamiento del destino, atribucion y distincion de cobertura se conservan.
- iPhone: un solo boton de copia dentro de la ayuda. URL literal `https://www.mercau.co/`. La API se invoca solo al pulsarlo y el estado de exito solo despues de resolver su promesa. Un rechazo o la ausencia de la API muestran un campo de solo lectura seleccionable con la URL publica e instrucciones manuales. Abrir otra vez la ayuda reinicia el aviso. La variante Android mantiene instrucciones y controles.

Se conservo la fotografia ilustrativa de la comerciante y no se modificaron Home, comprador, cuentas, checkout, pedidos, pagos, QR, integracion logistica, manifest ni service worker. La comprobacion de hashes de los 158 archivos protegidos paso.

## Evidencia visual

Galeria: `outputs/mercau-presentacion-v3-antes-despues-autocontenida.html`.
Contiene 46 capturas PNG base64, sin recursos externos: antes/despues de los cuatro ajustes en 320, 390, 768 y 1440 px, viewport, pagina completa, nombre largo ficticio y estados de copia.

| Ancho emulado | Altura anterior de tarjeta | Altura nueva |
| --- | ---: | ---: |
| 320 | 313 px | 274.5 px |
| 390 | 299 px | 260.1 px |
| 768 | 326.5 px | 284.0 px |
| 1440 | 359 px | 341.9 px |

Los nombres largos adicionales se insertaron solo en el DOM del navegador automatizado. No se alteraron los registros o las fotografias de los negocios.

## Pruebas ejecutadas

- `qa/presentation-adjustments.cjs`: aprobado a los cuatro anchos; sin desbordamiento horizontal, solapamiento entre etiquetas o errores JS; teclado Enter/Espacio, seleccion y marca, CTA alineados, nombre largo completo y captura de resultados.
- Portapapeles: API controlada en Chrome local, con promesa resuelta, promesa rechazada y API ausente. Se comprobo que solo se escribe la URL publica y no hay escritura al abrir la pagina. Esto no certifica el permiso de portapapeles en Safari fisico.
- `qa/test-presentation-review.cjs`: aprobado a los cuatro anchos; imagenes, botones comerciales, menu, FAQ, selector de plataforma, Android, ayuda iPhone y destino persistido al ir a Explorar.
- `scripts/test-presentation.cjs`: aprobado; controles estaticos de ruta, datos, acciones y licencia del mapa.
- `qa/test-presentation-phone-server.cjs`: aprobado con upstream ficticio; entrada temporal, solo lectura, bloqueo de operaciones, manifest y SW, sin reenviar credenciales y limites explicitos de navegacion.
- `qa/test-presentation-adjustment-phone.cjs`: aprobado en Chrome automatizado a 390 px usando el origen Wi-Fi real del servidor, no un celular. Comprueba presentacion, mapa, apertura de Restaurantes/Comercios con instantanea local, Android y alternativa manual del portapapeles en HTTP real. Cero solicitudes externas, pedidos o despachos; operaciones bloqueadas.
- Typecheck `tsc --noEmit`: aprobado.
- Lint `next lint`: aprobado con advertencias existentes de `<img>` y dependencias de hooks. No se refactorizaron componentes ajenos para retirarlas.
- Build `next build`: aprobado en `.next-presentation-adjustments-build`, sin credenciales operativas y con conexiones externas bloqueadas.
- `qa/test-presentation-production.cjs`: ejecutado sobre esa compilacion local. `/presentacion-revision` devuelve 404 incluso con bandera de revision; Home devuelve 200; API QA de pedidos devuelve 404. No es un despliegue.
- Integridad: 38 copias V2 preservadas; las diferencias fuente permitidas de esta revision son solo los dos archivos de presentacion. Se verifican al iniciar y durante el acceso temporal.

Resultados: `outputs/presentation-adjustments/after/results.json`, `outputs/presentation-review/results.json` y `outputs/presentation-adjustments/phone-preflight.json`.

## Comprobacion desde celulares

El acceso temporal privado vigente esta en `outputs/presentation-phone-runtime.json`. Requiere el mismo Wi-Fi y mantener el computador encendido. Dura como maximo dos horas desde su habilitacion; no hay tunel publico ni cambios de firewall.

1. Abrir el enlace temporal y pulsar Abrir presentacion.
2. Revisar encuadre y desplazamiento horizontal de las tarjetas; los botones conservan sus destinos.
3. Tocar distintos municipios directamente en el mapa; confirmar tarjeta y marca de seleccion.
4. Seleccionar iPhone y abrir la ayuda; intentar copiar. En esta prueba HTTP puede no existir Clipboard API: debe aparecer el enlace publico seleccionable y no un falso mensaje de exito.
5. Cerrar ayuda, revisar Android y abrir Restaurantes/Comercios. No introducir credenciales ni hacer pedidos.

El adaptador incorpora el aviso de entorno de prueba fuera de la fuente de presentacion. Usa una instantanea publica local de tres negocios. Los enlaces operativos a fichas, menus, registro e instalacion completa muestran un limite explicito, no se simula su funcionamiento ni se habilita produccion.

## Pendientes y exclusiones

- No se realizaron nuevas pruebas en celulares fisicos para esta revision. El informe previo del usuario no especifica modelo/navegador para estos cuatro ajustes; no se atribuye a dispositivos concretos.
- No se probo instalacion PWA, geolocalizacion, permisos reales de Safari, autenticacion, checkout, cobros ni despachos.
- Permanece el problema previo documentado de Atrás despues de usar anclas de la presentacion y entrar a Restaurantes: la URL puede regresar pero quedar el contenido de Restaurantes. Evidencia anterior: `outputs/presentation-back-reproduction.json`. No se cambio el enrutamiento del comprador ni se reejecuto ese caso como aprobado en esta revision. La prueba Wi-Fi enfocada no lo incluye y lo indica en sus exclusiones.
- No hay publicacion ni autorizacion implicita de integracion. Para revertir la revision, restaurar exclusivamente los dos archivos de presentacion desde las copias V2 tras comparar diferencias; no usar un reset del repositorio ni revertir el trabajo del comprador.
