# Anclaje y overscroll de ActionSheet

**Base investigada:** `27fd65240acbef11be0caa33c077d69e13992b98`  
**Fecha:** 2026-08-09  
**Estado de automatización:** contratos DOM, geometría y scroll cubiertos en Chromium, WebKit y Firefox.  
**Certificación del rebote elástico real de Safari iOS:** **PENDING — DEVICE REQUIRED**.

## Causa raíz comprobada

La regresión nació en la migración de `ActionSheet` del Corte 4 (`41db808`). Antes de ese commit, el `section` era una superficie `position: fixed; bottom: 0` portaleada a `document.body`. En `41db808` pasó a ser `position: absolute; bottom: 0` dentro de un frame `fixed` cuyos `left`, `top`, `width` y `height` copiaban `geometry.visual`, incluidos `visualViewport.offsetTop` y `offsetLeft`.

Esa composición mezcló dos autoridades de posición. El navegador ya aplica su modelo de VisualViewport al render de elementos fijos; volver a sumar `offsetTop` al frame permite que un evento `visualViewport.scroll` desplace el frame aunque el área útil no haya cambiado. La reproducción determinista en el harness cambió únicamente `offsetTop` de `0` a `48`, mantuvo `390 × 844`, y observó:

- antes: frame `top=0`, `bottom=844`;
- después: frame `top=48`, `bottom=892`.

La superficie absoluta siguió el frame y se separó del borde inferior. Los cambios de geometry también mantenían declarada la animación con `forwards`, por lo que transform y posición podían coexistir durante el asentamiento.

El segundo factor era el bloqueo incompleto del viewport. Antes del Corte 4, `ActionSheet` usaba `useBodyScrollLock`. En el Corte 4 cambió a un lease sobre `[data-app-scroll-root]` con fallback a `body`. `scrollLock.js` ya contenía el sistema de leases desde commits inmediatamente anteriores y no fue modificado por `41db808`, pero `ActionSheet` comenzó a usarlo en ese commit. Bloquear solo el scroller de la aplicación no protege coordinadamente `documentElement` y `body` frente al rubber-banding del viewport en Safari.

El tercer factor era scroll chaining: `overflow-y-auto` más `overscroll-contain` no distingue contenido corto de uno realmente desplazable y no constituye por sí solo una barrera fiable en todos los Safari iOS al llegar a un extremo.

La causa es, por tanto, una combinación de anclaje VisualViewport duplicado, protección incompleta de los scroll roots del documento y encadenamiento en los límites. No se encontró drag-to-dismiss ni una traducción deliberada siguiendo el dedo.

## Contrato de anclaje

- Un sheet portaleado a `body` o `documentElement` usa un frame CSS `fixed`, anclado con `bottom: 0` y `height: 100dvh`.
- `visualViewport.offsetTop` y `offsetLeft` no participan en la posición del frame. La geometría observada solo limita la altura máxima útil de la superficie.
- Un cambio real de altura puede actualizar `max-height`; un evento `visualViewport.scroll` que solo cambia offsets no mueve frame, backdrop, surface ni footer.
- Un sheet portaleado a un target scoped usa un frame `absolute; inset: 0` relativo a ese scope. No reutiliza coordenadas de ventana como offsets locales.
- El `section` permanece `absolute; bottom: 0` dentro de su frame propietario. Header, handle y footer no son scroll roots.
- La animación `slideUp` termina sobre el estado CSS natural, sin `forwards`; después de `animationend`, `transform` calculado vuelve a `none` y cambios de geometry no reinician la entrada.

Se conservan la pila top-only, `OverlayScope`, portales scoped, inert, retorno de foco, Back/Escape, safe area, footer fijo y geometry compartida del editor manual.

## Contrato de scroll interno

- Solo `[data-action-sheet-scroll="true"]` tiene `overflow-y: auto` y momentum mediante `-webkit-overflow-scrolling: touch`.
- Frame y surface usan `overflow: hidden` y `overscroll-behavior: none`; el contenido usa `overscroll-behavior: none`.
- El contenido corto conserva `scrollTop=0` y sus pans verticales se contienen.
- El contenido largo permite pan mientras existe recorrido. En top o bottom, el gesto se contiene y no se encadena al viewport.
- Handle, título, backdrop y footer contienen el pan vertical y nunca trasladan la superficie.
- Los pans predominantemente horizontales no se interceptan, para conservar paletas y controles con scroll horizontal.
- Los `input[type="range"]` quedan fuera de la intercepción para conservar su gesto nativo. Inputs de texto, selectores y file inputs conservan su comportamiento.

Safari requiere una defensa adicional a CSS para este contrato. `actionSheetGestureGuard.js` instala `touchmove` no pasivo únicamente en el frame de la capa superior. Decide con `scrollTop`, `scrollHeight`, `clientHeight` y dirección del gesto; no se instala en `document` ni `window`, no bloquea todo movimiento y se elimina al perder top/unmount.

## Contrato de scroll lock

Los ActionSheets de viewport adquieren leases coordinados y deduplicados sobre:

1. `[data-app-scroll-root]`, cuando el sheet raíz posee la modalidad;
2. `document.documentElement`;
3. `document.body`.

Un sheet scoped dentro de una modalidad existente no vuelve a adquirir el app root; solo protege los roots de documento si su portal efectivo es el viewport e inerta la superficie modal padre. Cada root conserva owners independientes. La última liberación restaura exactamente overflow, overscroll por eje, `scrollTop` y `scrollLeft`. Las liberaciones son idempotentes para StrictMode y dos sheets no pueden desbloquear prematuramente el root compartido.

No se usa `position: fixed` en `body`, `scrollTo`, detección de UA, heurística de teclado ni listener global de `touchmove`.

## Pruebas automatizadas

El harness registra frame, section, bottom, viewport, VisualViewport, offsets de window/html/body/app/contenido, transform, animación y overflow/overscroll de cada root.

- `PW-AS-STABLE-001`: hoja corta; handle, título, contenido y footer.
- `PW-AS-STABLE-002`: scroll largo en mitad, top y bottom.
- `PW-AS-STABLE-003`: offset sintético, resize real, portrait y landscape.
- `PW-AS-STABLE-004`: footer fijo con contenido largo.
- `PW-AS-STABLE-005`: CustomColorActionSheet y sliders.
- `PW-AS-STABLE-006`: ImageActionSheet, lado, preview y `setInputFiles`.
- `PW-AS-STABLE-007`: dos sheets, inert, anclaje y leases.
- `PW-AS-STABLE-008`: veinte ciclos y cero recursos/estilos huérfanos.
- `PW-AS-CONSUMERS-001`: consumidores reales `DeckCard`, `DeckHeader` y `ScheduleCalendar` (opciones y exportación).
- `UT-AS-STABLE-001/002/003`: decisión de límites, limpieza del listener y leases agrupados/restauración exacta.

Continúan cubiertos `PW-AS-001` a `PW-AS-004`, editor manual, color, imagen, Back, Escape, foco, StrictMode, safe area, orientación y landscape con scroll largo.

Playwright WebKit valida estructura DOM, contratos de cancelación, geometría y offsets. No reproduce ni certifica el rubber-banding exacto del compositor de un iPhone físico.

## Checklist físico iOS

Estado inicial de todas las filas: **PENDING — DEVICE REQUIRED**.

- [ ] Sheet corto: arrastrar arriba/abajo sobre contenido vacío; no cambia rect ni aparece hueco.
- [ ] Sheet largo: scroll con momentum solo dentro del contenido.
- [ ] Handle: arrastrar repetidamente; es decorativo y no mueve la hoja.
- [ ] Título: iniciar pan vertical; no mueve hoja ni fondo.
- [ ] Footer: permanece unido al borde inferior y no inicia arrastre.
- [ ] Top/bottom: insistir en ambos límites; sin chaining ni rubber-band del fondo.
- [ ] Color: mover tono, saturación y luminosidad; cambia el draft sin mover la hoja.
- [ ] Imagen: cambiar lado, abrir/cancelar picker, cargar preview y aplicar/cancelar.
- [ ] Dos sheets consecutivos: cerrar el superior; el inferior conserva posición, inert y lock hasta su cierre.
- [ ] Repetir en portrait y landscape, con toolbar de Safari expandido/retraído y con teclado visible cuando aplique.

Registrar modelo, versión exacta de iOS/Safari, modo navegador/standalone, orientación y resultado de cada fila. Hasta completar esta matriz, la certificación final permanece **PENDING — DEVICE REQUIRED**.
