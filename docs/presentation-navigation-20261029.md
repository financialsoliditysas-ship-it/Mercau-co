# Cierre: navegacion Atras / Adelante de la presentacion

## Causa y cambio minimo

Los enlaces de seccion de la presentacion usaban anclas HTML nativas. La regresion se reprodujo en Next.js 14.2.35: despues de recorrer anclas, entrar al listado y al menu/catalogo, Atras regresaba a la URL de presentacion pero no restauraba su contenido.

El reducer de restauracion de la version instalada documenta este caso: una entrada de historial creada por un ancla ordinaria puede no contener el arbol de rutas y termina reutilizando el arbol actual. Referencia local: `node_modules/next/dist/client/components/router-reducer/reducers/restore-reducer.js`, comentario de `treeToRestore`.

Se sustituyeron exclusivamente los enlaces de seccion por el componente `Link` ya importado de `next/link`, incluyendo navegacion de escritorio, movil, acceso de instalacion y salto al contenido. Se conservaron href, clases, texto, cierre del menu y destinos. No se agregaron listeners globales, recargas forzadas, modificaciones de `history.state`, dependencias ni cambios al router del comprador.

Archivo funcional modificado: `components/presentation/Presentation.tsx`. Diferencia frente a V3: cuatro lineas JSX sustituidas. CSS y recursos visuales sin cambios.

## Regresion automatizada

Ejecutar con Node y Playwright disponibles:

```powershell
node qa/test-presentation-navigation.cjs
```

El test inicia Next local en `127.0.0.1:3084`, y cierra su servidor y navegador al terminar. Usa las rutas y los componentes existentes de presentacion, listado y catalogo con dos negocios y productos ficticios. `qa/presentation-navigation-fixtures.cjs` intercepta en memoria las lecturas de servicios; usa identificadores y claves ficticias, bloquea escrituras y conexiones externas. No crea una base ni consulta servicios operativos. El navegador tambien bloquea solicitudes externas y metodos distintos de GET. No se crean cuentas, pedidos, pagos o despachos.

Recorrido en cada caso: presentacion, listado, menu/catalogo, Atras al listado, Atras a presentacion, Adelante al listado y Adelante al menu/catalogo. Con anclas tambien se comprueba Atras/Adelante entre dos secciones de la presentacion y que el destino quede visible bajo el encabezado fijo. Cada URL se contrasta con el encabezado/contenido esperado; no basta observar la barra de direccion.

| Ancho emulado | Listado | Sin anclas | Con anclas |
| --- | --- | --- | --- |
| 390 px | Restaurantes | Aprobado | Aprobado |
| 390 px | Comercios | Aprobado | Aprobado |
| 1440 px | Restaurantes | Aprobado | Aprobado |
| 1440 px | Comercios | Aprobado | Aprobado |

Antes de la correccion, los dos controles sin anclas pasaron y el primer caso con anclas fallo esperando el titulo de la presentacion al regresar. Despues pasaron los ocho casos completos, sin errores JavaScript no controlados. En las entradas con anclas corregidas, los indicadores del arbol y de App Router estuvieron presentes. Estos indicadores solo se observan en QA; la aplicacion no los consulta ni modifica.

Evidencias locales: `outputs/presentation-navigation/before-failure.json`, `outputs/presentation-navigation/results.json` y `outputs/presentation-navigation/server.log`. Los primeros intentos de preparar el test requirieron corregir un filtro de la respuesta ficticia y ampliar la espera para la compilacion inicial; no se consideran fallos del producto.

## Comprobaciones y conservacion

- Typecheck y lint aprobados; lint conserva advertencias anteriores de imagenes y dependencias de hooks.
- Build local aprobado con credenciales operativas retiradas y red externa bloqueada. No constituye una publicacion.
- Sobre esa compilacion local, la ruta de revision y la API QA de pedidos devolvieron 404 en modo produccion; Home devolvio 200. No se contacto el despliegue productivo.
- Los 158 archivos operativos protegidos permanecen intactos. No se modificaron Home, comprador, cuentas, checkout, pagos, pedidos, Shipday, manifest ni service worker.
- Se conservaron las 38 copias del corte V2 y los cortes previos de cuenta y pedidos. V3 queda registrada como base separada en el commit `00c7def`, previa autorizacion del usuario.
- El commit de correccion incluye solo el componente de presentacion, el test, sus fixtures y este documento. Los cambios ya preparados del comprador quedan fuera y se compara su diff del indice antes y despues.
- No se cambiaron planes ni se contrataron servicios. No se hizo push ni despliegue.

## Limites del cierre

Pruebas de navegador automatizado con viewports emulados, no nuevos ensayos fisicos Android/iPhone. Segun la instruccion del usuario, no se requiere otra ronda de celular para este hito. No se certifican autenticacion, permisos de base de datos, cobros, instalacion o PWA; quedan fuera de esta regresion.

La integracion de la portada como Home sigue pendiente de autorizacion y es un hito separado. La apertura de la PWA tambien permanece separada. Los avisos pendientes de navegacion de las entregas V2/V3 anteriores son registros historicos; el resultado de este cierre es el indicado aqui.
