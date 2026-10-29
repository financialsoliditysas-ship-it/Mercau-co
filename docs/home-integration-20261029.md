# Integracion de la presentacion V3 como Home

## Auditoria previa al reemplazo

La Home actual `app/page.tsx` monta `MercauDirectory`. La presentacion aprobada y su correccion estan en `00c7def` y `64ec94c`. El comprador se encuentra en `/comprar`; Explorar incluye negocios con o sin catalogo publicado. No hace falta crear otro directorio, repositorio, base de datos o despliegue.

| Dependencia actual | Conservacion prevista |
| --- | --- |
| Busqueda, municipios, categorias y fichas del directorio | `/comprar/explorar` y rutas publicas existentes; no se modifica el comprador |
| Enlaces `/#directorio` desde cuenta, fichas, Nosotros e Instalar | Compatibilidad en Home hacia `/comprar/explorar` |
| Enlaces `/#favoritos` | Compatibilidad hacia `/comprar/favoritos`, con el almacenamiento existente |
| `/#cuenta` y `/#inscripcion` | Compatibilidad hacia `/mi-cuenta?entry=general` y `/negocios/registro` |
| `/listings` y `/listings/[id]`, antes redirigidos a la Home-directorio | Redirigir al directorio del comprador; conservar el comportamiento de listado, sin reinterpretar IDs |
| Pedir ahora, Ver que puedo pedir, Restaurantes y Comercios | Enlaces V3 ya apuntan a `/comprar`, `/comprar/restaurantes` y `/comprar/comercios` |
| Registro, ayuda, terminos y privacidad | Conservar enlaces V3 a sus rutas existentes |
| Retorno al inicio por logo o enlaces `/` | Mostrar nueva Home; explorar sigue disponible por sus CTA |
| Evento `Visita` de la antigua Home | Reutilizar el registro existente, identificandolo como Home de presentacion, no como vista de directorio |
| Captura UTM, consentimiento e instalacion | Conservar componentes globales sin modificaciones; mantener UTM conocidas al resolver alias antiguos |
| Login, confirmacion y recuperacion | Rutas actuales de cuenta/registro; no modificar autenticacion ni sus destinos configurados |
| PWA instalada | Manifest mantiene `start_url: '/'`; la apertura seguira en `/` hasta el hito PWA separado |

No se eliminara `MercauDirectory` ni su codigo. La nueva Home no mostrara ese componente, sus formularios o su modal; los accesos equivalentes usan las pantallas existentes del comprador y las fichas publicas.

## Limites

Sin rediseño, cambios de reglas del comprador, autenticacion, pagos, pedidos o Shipday. Sin cambios de layout global, manifest, service worker o deteccion de modo instalado. Sin contrataciones, migraciones, push o publicacion. Pruebas automatizadas aisladas, sin nueva ronda de celulares.

## Implementacion

- `/` renderiza directamente el mismo `Presentation` y la misma hoja de estilos de V3. No copia las restricciones de revision ni su metadata noindex. Se actualizan solamente los metadatos de la Home para corresponder a su contenido y conservar el recurso social oficial.
- `HomeEntry` no renderiza interfaz. Conserva el evento existente `Visita` con la nota `Home presentacion`, y resuelve los cuatro fragmentos antiguos usando `router.replace`. Solo conserva parametros UTM conocidos, no propaga destinos arbitrarios ni interpreta otros fragmentos.
- Se conserva el componente de directorio antiguo, sin alterarlo o eliminarlo. El directorio accesible al comprador sigue en `/comprar/explorar`, que tambien muestra fichas sin catalogo. No se cambia su orden, filtros, busqueda o datos.
- Los alias `/listings` y `/listings/[id]` mantienen el destino de listado mediante `/comprar/explorar` en vez de regresar a la nueva portada.
- La prueba detecto que el enlace existente de Ayuda a `/nosotros#contacto` no tenia un destino con ese ID. Se agrega exclusivamente `id="contacto"` a la seccion Contacto existente, sin cambiar textos, estructura, estilos o canales.
- La presentacion compartida conserva la correccion `Link` de `64ec94c`; no se edita ese componente ni sus imagenes, CSS, datos o textos.

## Pruebas

Comandos locales, sin servicios operativos:

```powershell
node qa/test-home-entry.cjs
node qa/test-home-boundaries.cjs
node qa/test-presentation-navigation.cjs --home
node qa/test-presentation-navigation.cjs --home --production
```

El ultimo comando requiere la compilacion local en `.next-home-build`. El runner conserva su modo anterior sin `--home` para comprobar la ruta historica de revision. Usa componentes reales, dos negocios ficticios, respuestas de lectura interceptadas en memoria, claves ficticias, bloqueo de escrituras y red externa, sin pedidos o despachos. Inicia y cierra su servidor loopback y su navegador.

La prueba de Home comprueba metadatos, CTA a compras, Ayuda y vuelta por un enlace antiguo, aliases, UTM, hashes desconocidos, ruta de favoritos/cuenta/registro, terminos/privacidad/instalacion, alias listings y proteccion de revision. La matriz de navegacion recorre Home, Restaurantes/Comercios y menu/catalogo, con Atras/Adelante, con y sin anclas, a 390 y 1440 px emulados.

Las pruebas unitarias usan hooks y metricas simulados. Las pruebas de navegador usan las pantallas reales con servicios ficticios. No certifican autenticacion, RLS, pedidos, pagos, instalaciones ni dispositivos fisicos. El ajuste inicial de la asercion de canonical solo normaliza la barra final que Next omite; no cambia la URL fija del boton de copia. La simulacion de cambios de hash espera primero a la hidratacion mediante una accion real de menu.

Resultados del corte:

- Ocho recorridos aprobados en desarrollo y ocho sobre `.next-home-build` en modo produccion local, con componentes reales y servicios ficticios. En ambos pasaron los CTA, ayuda, aliases, cuenta/registro, rutas legales e instalacion; la revision permanecio restringida en modo produccion y la API QA de pedidos devolvio 404.
- En produccion local se comprobaron los alias listings mediante navegacion real del navegador, sin asumir que toda redireccion prerenderizada entrega un header Location.
- Unitarios de HomeEntry aprobados, incluyendo errores de metricas, lista permitida UTM, hashes desconocidos, cambios de fragmento y limpieza del listener.
- Typecheck, lint y build aprobados. Lint conserva advertencias preexistentes de `<img>` y dependencias de hooks.
- Comprobacion de integridad aprobada: 157 archivos operativos sin cambios; se excluye explicitamente solo `app/page.tsx` del baseline original de 158 porque es el reemplazo autorizado. El baseline anterior no se sobrescribe. Se conserva el codigo visual V3/nav, recursos y directorio anterior.
- Evidencias: `outputs/home-integration/results.json` y `outputs/home-integration-production/results.json`. No son resultados de produccion alojada ni de celulares fisicos.

## Reversion

El commit de esta integracion queda separado de la base V3 (`00c7def`) y de la correccion de navegacion (`64ec94c`). Para revertir, preservar primero cualquier trabajo local y, en un arbol limpio, ejecutar:

```powershell
git revert <commit-de-integracion-indicado-en-la-entrega>
```

No ejecutar un reset general ni revertir los commits de base o navegacion. La reversion restituye la Home anterior y sus alias sin modificar los cambios del comprador. Antes de usarla comprobar que los archivos afectados no tengan otras ediciones posteriores. No se realizo esta reversion en el espacio de trabajo actual, que conserva otros cambios pendientes.

## Pendientes antes de publicar y del hito PWA

1. La Home reutiliza la instantanea publica aprobada de destacados y municipios; no se consulto produccion en este hito. Verificar su vigencia y definir su actualizacion antes de publicar. No se introdujo una fuente comercial nueva.
2. El manifest declara `start_url: '/'` y no declara `id` ni `scope`. No se modifico. La PWA instalada seguira solicitando `/`, donde encontrara la presentacion integrada, no la entrada directa a `/comprar`.
3. Antes de cambiar `start_url`, comprobar la identidad efectiva de las instalaciones actuales y definir una actualizacion que evite duplicados. No basta cambiar esa propiedad suponiendo que la identidad se conserva. Esto queda para el hito PWA separado.
4. El layout sigue registrando el service worker con scope `/`; el worker actual no implementa almacenamiento en cache en su handler fetch. Se conserva tal cual, junto con push y sus destinos. No se altera notificacion, apertura desde icono, splash ni instalacion.
5. La apertura directa de enlaces a fichas, menus y catalogos conserva sus rutas. No se agrego una redireccion de todos los visitantes a Home ni una decision basada en modo instalado.
