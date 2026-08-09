# Limitaciones de plataforma móvil de Under Flashcards

Este directorio es la autoridad técnica del proyecto para cualquier cambio que dependa de un navegador móvil, del teclado en pantalla, del viewport, del foco, del scroll o de una superficie superpuesta. No describe el comportamiento deseado del producto: registra qué puede garantizar la plataforma, qué solo puede inferirse y qué debe comprobarse en hardware real.

**Ámbito de la investigación:** frontend en `CesarJGB/Under-FlashCards-FrontEnd`, commit base `697d6f62f0276f444e58adaf9fbb53f2f8966e1f`.  
**Última comprobación general:** 2026-08-08.  
**Regla de vigencia:** una fecha reciente aumenta la confianza, pero nunca sustituye una comprobación de soporte ni una prueba en el navegador objetivo.

## Flujo obligatorio antes de modificar móvil

1. Leer este archivo y localizar el tipo de cambio en la tabla de rutas.
2. Consultar [`browser-support-matrix.md`](browser-support-matrix.md). Si la API o propiedad no aparece, investigarla y añadirla antes de usarla.
3. Leer el documento especializado y [`known-browser-bugs.md`](known-browser-bugs.md).
4. Inspeccionar el componente y sus contenedores reales. Un `fixed`, un bloqueo de `body` o un `env(safe-area-inset-*)` heredado puede cambiar el resultado.
5. Escribir el contrato observable del cambio: qué debe ocurrir, qué puede degradarse y cuál es la alternativa cuando una capacidad falta.
6. Ejecutar los casos aplicables de [`testing-checklist.md`](testing-checklist.md) en dispositivos reales. DevTools y emulación ayudan a depurar, pero no validan el teclado del sistema, el chrome del navegador ni los recortes físicos.
7. Si se añade una mitigación, actualizar esta documentación en el mismo cambio.

## Qué documento consultar

| Cambio propuesto | Lecturas mínimas |
|---|---|
| Refactor/V2 del editor manual | Los cuatro documentos de auditoría de Fase 2, `manual-editor-v2-architecture`, `manual-editor-v2-state-machines`, `manual-editor-v2-migration-plan`, `manual-editor-v2-test-plan`, `manual-editor-v2-traceability` y los documentos especializados citados por cada hallazgo |
| `ManualCardEditorModal`, altura del editor o teclado | `virtual-keyboard`, `viewport-and-safe-area`, `focus-and-input`, `fixed-sticky-overlays`, `known-browser-bugs` |
| `ActionSheet`, diálogo, backdrop o trampa de foco | `modals-and-sheets`, `focus-and-input`, `fixed-sticky-overlays`, `touch-and-gestures` |
| `ScheduleCalendar` o `ScheduleMobileFooter` | `viewport-and-safe-area`, `fixed-sticky-overlays`, `touch-and-gestures` |
| `StylePanel` o `ColorPalette` | `focus-and-input`, `touch-and-gestures`, `viewport-and-safe-area`, `known-browser-bugs` |
| `textarea`, `contenteditable`, caret o selección | `focus-and-input`, `virtual-keyboard` |
| Scroll lock, rebote o scroll interno | `fixed-sticky-overlays`, `touch-and-gestures`, `known-browser-bugs` |
| Cambio específico de iPhone/iPad/Safari | `ios-safari`, matriz y bugs conocidos |
| Cambio específico de Chrome/Android/WebView/Samsung | `android-chrome`, matriz y bugs conocidos |
| Cualquier entrega móvil | `testing-checklist` |

Los nombres anteriores remiten a archivos `.md` de este mismo directorio.

## Auditorías aplicadas

La auditoría estática de Fase 2 del editor manual se realizó sobre `bc541f930f7fc6e3eb055adb0cb4a232d5099b5c` el 2026-08-07:

- [`manual-editor-audit.md`](manual-editor-audit.md): hallazgos, gravedad, clasificación, prioridades, límites y decisiones `KEEP`;
- [`manual-editor-dependency-map.md`](manual-editor-dependency-map.md): ruta de render, DOM/portales, foco, pickers y scroll owners;
- [`manual-editor-conflicts.md`](manual-editor-conflicts.md): fuentes de verdad y efectos enfrentados;
- [`manual-editor-runtime-inventory.md`](manual-editor-runtime-inventory.md): APIs, unidades, safe-area, listeners, observers y coste de layout.

Estos documentos aplican la autoridad de Fase 1 al código actual; no sustituyen la matriz ni los documentos de plataforma. Las conclusiones dependientes del dispositivo siguen requiriendo [`testing-checklist.md`](testing-checklist.md).

## Especificación ejecutable de Fase 3

La arquitectura V2 se diseñó y revalidó sobre `ba3027f0d34fa9297f4224235eef263f3d387671` el 2026-08-08. Entre ese commit y la base auditada de Fase 2 no cambió código de producción; el detalle está en el informe de drift. Esta fase es una especificación: no implementa V2 ni convierte pruebas físicas pendientes en resultados positivos.

Orden de lectura para implementar por cortes:

1. [`manual-editor-v2-architecture.md`](manual-editor-v2-architecture.md): arquitectura mínima, ownership, APIs, epics, fallbacks y contratos visibles.
2. [`manual-editor-v2-state-machines.md`](manual-editor-v2-state-machines.md): transiciones exactas de apertura, lado, menús, pickers, rotación, Back/Escape y desmontaje.
3. [`manual-editor-v2-migration-plan.md`](manual-editor-v2-migration-plan.md): seis cortes reversibles, convivencia, rollback y condición de retirada.
4. [`manual-editor-v2-test-plan.md`](manual-editor-v2-test-plan.md): pruebas deterministas, Playwright y matriz física con evidencia obligatoria.
5. [`manual-editor-v2-traceability.md`](manual-editor-v2-traceability.md): cobertura de todos los P0/P1 y conservación de `KEEP-001` a `KEEP-013`.
6. [`manual-editor-v2-drift-report.md`](manual-editor-v2-drift-report.md): commit actual, comparación y revalidación de los archivos críticos.

La implementación debe empezar por Corte 0. Ningún corte posterior puede eliminar el sistema anterior hasta cumplir la condición de retirada declarada en el plan, y ningún resultado de emulación puede sustituir una fila `PENDING — DEVICE REQUIRED`.

El resultado de la primera implementación está registrado en [`manual-editor-v2-cut-0-report.md`](manual-editor-v2-cut-0-report.md). El Corte 1 se ejecutó con la autorización excepcional que permite mantener G0 abierto cuando Playwright está bloqueado únicamente por la ausencia de binarios; su implementación y evidencia están en [`manual-editor-v2-cut-1-report.md`](manual-editor-v2-cut-1-report.md).

El Corte 2 sustituyó la geometría heredada por un snapshot observable único para surface, footer y paleta manual, con ownership de safe area por borde. Su implementación, comandos reales y estado `G2 OPEN/BLOCKED` están en [`manual-editor-v2-cut-2-report.md`](manual-editor-v2-cut-2-report.md). La ausencia de binarios Playwright y las pruebas físicas pendientes impiden tratar este corte como certificación móvil o autorización automática del Corte 3.

El Corte 3 añadió overlays scoped dentro del diálogo, pila top-only, modalidad/foco, lease del scroller real y sentinel coordinado de Back. También saneó el fallback visible inicial y el jitter subpíxel del Corte 2. La implementación y resultados exactos están en [`manual-editor-v2-cut-3-report.md`](manual-editor-v2-cut-3-report.md). Playwright continúa `BLOCKED`, las pruebas físicas siguen `PENDING — DEVICE REQUIRED` y `G3 OPEN/BLOCKED`; no se autoriza iniciar el Corte 4 ni migrar `ActionSheet`.

El Corte 4 se implementó mediante autorización excepcional sobre `be8be8a071b0e5e1bf172d41cafb78d60c6d5be0`: graduó el reducer a `common/overlays`, migró `ActionSheet` a una autoridad top-only común, retiró `preserveFocus` y portó `ColorPalette` dentro del scope del sheet. El detalle, clases de callers y resultados exactos están en [`manual-editor-v2-cut-4-report.md`](manual-editor-v2-cut-4-report.md). Las pruebas deterministas, build, calendario y PDF pasan; Playwright continúa `BLOCKED` por ausencia de ejecutables, las pruebas físicas siguen `PENDING — DEVICE REQUIRED` y `G4 OPEN/BLOCKED`.

El Corte 5 se ejecutó sobre el `HEAD` efectivo de `origin/main` `9a775679b882469ab7c998b5d4233a6087af56cf`. Eliminó el re-export de `creator/manual-editor/editorLayerStack.js`, retiró la medición huérfana del footer de `FlashcardCreator` y confirmó mediante búsquedas dirigidas que la implementación real de la pila de capas es única en `common/overlays/layerStack.js`. El detalle y los comandos exactos están en [`manual-editor-v2-cut-5-report.md`](manual-editor-v2-cut-5-report.md).

La implementación y migración de código de los Cortes 0–5 queda terminada en el alcance estático/determinista documentado. Esto no equivale a certificación de plataformas: no se ejecutaron Playwright ni pruebas físicas. `G5` queda **`BLOCKED — DEVICE REQUIRED`**; Safari iOS, Android, WebView, OSK, picker nativo, cutouts y Back físico no se declaran `PASS` sin evidencia real.

Después del Corte 5 se aplicó una corrección de regresiones observadas en uso real: se restauró la superficie contextual dentro de la textarea y su desplazamiento inferior, se aseguró foco durante cambio rápido de lado y cierre por el mismo trigger, y se hizo inmediata la autoridad de transacciones para que el color personalizado no lea estado obsoleto. Véase [`manual-editor-v2-post-cut-5-regression-fix.md`](manual-editor-v2-post-cut-5-regression-fix.md). Esta corrección no cambia el estado de certificación física de `G5`.

## Jerarquía de fuentes

Se aplica este orden, salvo que una fuente de nivel superior no trate la cuestión concreta:

1. Apple Developer.
2. Documentación de WebKit.
3. WebKit Bugzilla.
4. Chrome Developers.
5. Chromium y su issue tracker.
6. MDN y sus datos de compatibilidad.
7. W3C.
8. WHATWG.
9. Can I Use.
10. Issues oficiales de Chromium y WebKit.

Una especificación define el contrato pretendido; no demuestra que una implementación lo cumpla. Una tabla de compatibilidad demuestra presencia declarada, no calidad, temporización ni ausencia de bugs. Un reporte solo se trata como bug confirmado si el tracker oficial lo identifica y su estado puede verificarse. No se usan blogs de terceros como evidencia primaria.

## Reglas no negociables del proyecto

- **Nunca asumir soporte de una API.** Comprobar matriz, detección de capacidad y alternativa.
- **Nunca introducir hacks sin documentarlos.** Deben registrar fuente o reproducción, navegadores afectados, alcance, pruebas, condición de retirada y responsable lógico.
- **Nunca implementar comportamiento dependiente del navegador sin comprobar `browser-support-matrix.md`.**
- No convertir una heurística en un contrato. `visualViewport.height` reducido no demuestra por sí solo que el teclado esté abierto; también puede intervenir zoom o UI del navegador.
- No usar `100vh`, `100dvh` ni `window.innerHeight` como detector de teclado. Las unidades de viewport y el redimensionamiento por teclado tienen contratos distintos.
- No equiparar `focus`, `autofocus` o `document.activeElement` con teclado visible. En iOS el teclado programático está condicionado por una activación del usuario.
- No suponer que `focus({ preventScroll: true })` funciona porque no lanza una excepción. Chrome Android puede aceptar la llamada e ignorar la opción.
- No suponer que Chrome en iOS comparte el motor o las capacidades de Chrome Android. En los mercados donde Apple permite motores alternativos se debe identificar el motor real; fuera de esas condiciones, probar el navegador iOS como una aplicación WebKit.
- Preferir detección de capacidades y geometría observable a detección por `userAgent`. Si una excepción por navegador resulta imprescindible, documentarla y acotarla por versión.
- No desactivar zoom ni escalar el viewport para ocultar problemas de diseño. Preservar accesibilidad y ampliar las pruebas.
- No interceptar gestos globales salvo que el componente lo necesite para una interacción definida. Todo listener no pasivo debe ser local, justificable y probado.
- No sumar `safe-area` en varios niveles sin revisar los estilos calculados. El documento y el componente deben acordar quién posee cada inset.
- Una API experimental o no Baseline solo puede ser mejora progresiva; nunca el único camino del producto.
- Un workaround de bug debe ser inocuo fuera de la condición afectada. No aplicar globalmente una corrección de una versión concreta.

## Criterio de evidencia y actualización

Cada afirmación operativa debe enlazar una fuente verificable en el documento que la contiene. Para compatibilidad se registra plataforma, versión mínima conocida, fecha y confianza. Para bugs se registra el estado exacto del tracker, no una interpretación de comentarios.

Al actualizar una fila de la matriz:

1. comprobar la especificación o documentación del proveedor;
2. comprobar datos de compatibilidad actuales;
3. comprobar si existe un issue abierto relevante;
4. ejecutar al menos una prueba real en cada familia afectada;
5. actualizar fecha y nivel de confianza, sin borrar la alternativa hasta verificarla.

Los niveles de confianza significan:

- **Alta:** contrato oficial más compatibilidad coherente y, para decisiones del proyecto, prueba real.
- **Media:** contrato y datos de compatibilidad disponibles, pero temporización, integración o una familia secundaria sigue requiriendo prueba.
- **Baja:** comportamiento experimental, parcial, inferido o dependiente del host; no puede ser requisito único.

## Componentes de referencia del repositorio

| Área | Implementación inspeccionada | Dependencias de plataforma |
|---|---|---|
| Editor manual | `frontend/src/components/creator/ManualCardEditorModal.jsx` | VisualViewport, foco, selección de `textarea`, viewport dinámico, scroll lock, safe area |
| Paleta y selector nativo | `frontend/src/components/creator/StylePanel.jsx` | portal, geometría visual, Pointer Events, `showPicker()`, foco |
| Hojas de acciones | `frontend/src/components/common/ActionSheet.jsx` | diálogo ARIA, trampa/restauración de foco, `fixed`, `dvh`, scroll lock |
| Calendario | `frontend/src/components/library/ScheduleCalendar.jsx` | hojas superpuestas, safe area, scroll y orientación |
| Pie móvil | `frontend/src/components/library/calendar/ScheduleMobileFooter.jsx` | `position: fixed`, portal, inset inferior, tamaño táctil |
| Shell de aplicación | `frontend/src/App.jsx`, `frontend/src/index.css` | viewport fijo, contenedores de scroll, insets globales |
| Utilidades | `useKeyboardHeight.js`, `useBottomGap.js`, `scrollLock.js`, `useModalAccessibility.js` | heurísticas de teclado, geometría, bloqueo de scroll y foco |

Esta base no autoriza un cambio funcional. Primero debe existir un requisito de producto y un plan de pruebas que respete los límites aquí registrados.
