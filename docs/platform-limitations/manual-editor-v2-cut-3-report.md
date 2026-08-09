# Informe de implementación — editor manual V2, Corte 3

**Fecha:** 2026-08-09  
**Alcance:** overlays scoped, modalidad, foco, Back/Escape y lease de scroll del editor manual.  
**Estado:** implementación y validación determinista terminadas; Playwright `BLOCKED` por ausencia de ejecutables; pruebas físicas `PENDING — DEVICE REQUIRED`; `G3 OPEN/BLOCKED`.  
**Límite:** no se modificó `ActionSheet.jsx`, no se inició el Corte 4 y no se declara certificación móvil.

## 1. Base efectiva y drift

Antes de editar se ejecutó `git fetch` y se verificaron el checkout, tracking y estado:

- repositorio efectivo: `CesarJGB/Under-FlashCards-FrontEnd`;
- rama: `main`;
- upstream: `origin/main`;
- HEAD local y remoto: `2a944355face9499e81b601ac177ab1fd5450c28`;
- árbol inicial: limpio;
- drift respecto del HEAD anunciado: ninguno.

La grafía inicial `Under-Flash-Cards-FrontEnd` usada en una versión previa del encargo no resolvía; el repositorio efectivo confirmado por remoto y GitHub es `Under-FlashCards-FrontEnd`. No existieron cambios locales ajenos que preservar en el checkout efectivo. No se hizo commit ni push.

Antes de editar se leyeron los 25 archivos de `docs/platform-limitations/`, incluidas las autoridades completas de Fase 3 y los informes de Cortes 0, 1 y 2.

## 2. Saneamiento obligatorio del Corte 2

### 2.1 Fallback inicial visible

`createUnavailableEditorGeometry()` conserva el rectángulo interno 1×1 únicamente como sentinel serializable, pero ya no se consume como estilo visible. `needsInitialEditorGeometryFallback(snapshot)` solo devuelve verdadero para `phase=unavailable`, `epoch=0` y `revision=0`.

Mientras se espera la primera lectura rAF, surface y `EditorOverlayRoot` usan CSS conservador `width:100%` y `height:100dvh` dentro del modal `fixed`. Después de la primera muestra usan exclusivamente el snapshot. `SOURCE_UNAVAILABLE` posterior conserva los últimos rectángulos válidos, por lo que no vuelve al fallback inicial ni crea otra autoridad de medición.

El contrato está cubierto por la prueba pura de fallback y por el contrato estático que impide que la primera surface adopte 1×1.

### 2.2 Igualdad semántica subpíxel

`geometrySamplesEqual` usa constantes nombradas:

- `GEOMETRY_CSS_PX_TOLERANCE = 0.5` para posición, dimensiones y oclusión en CSS px;
- `GEOMETRY_SCALE_TOLERANCE = 0.001` para escala.

No se redondea el snapshot. El estado estable permanece como referencia mientras el ruido quede dentro de tolerancia; como cada muestra nueva se compara con la última publicada, un desplazamiento acumulado que supera la tolerancia vuelve a `settling` y se publica. `UT-GEO-007` cubre oscilación de décimas, revisión estable y cambio real posterior.

El saneamiento terminó con tests geométricos y build verdes, por lo que se autorizó continuar internamente con el Corte 3 según la excepción del encargo.

## 3. Archivos

### Creados

- `frontend/src/components/creator/manual-editor/editorLayerStack.js`
- `frontend/src/components/creator/manual-editor/useEditorLayerStack.js`
- `frontend/src/components/creator/manual-editor/editorLayerStack.test.js`
- `frontend/src/components/creator/manual-editor/EditorOverlayRoot.jsx`
- `frontend/src/components/common/OverlayScope.jsx`
- `docs/platform-limitations/manual-editor-v2-cut-3-report.md`

### Modificados

- `frontend/src/components/creator/ManualCardEditorModal.jsx`
- `frontend/src/components/creator/StylePanel.jsx`
- `frontend/src/components/creator/FormInputs.jsx`
- `frontend/src/components/DeckInterior.jsx`
- `frontend/src/App.jsx`
- `frontend/src/lib/scrollLock.js`
- `frontend/src/components/creator/manual-editor/editorGeometry.js`
- `frontend/src/components/creator/manual-editor/editorGeometry.test.js`
- `frontend/src/components/creator/manual-editor/manualEditorDiagnostics.js`
- `frontend/tests/manual-editor/harness.jsx`
- `frontend/tests/manual-editor/manual-editor-current.spec.js`
- `frontend/tests/manual-editor/manual-editor-contracts.test.js`
- `frontend/tests/manual-editor/evidence-schema.json`
- `frontend/package.json`
- `docs/platform-limitations/README.md`

`frontend/package-lock.json`, backend, persistencia y dependencias runtime no cambiaron. `frontend/src/components/common/ActionSheet.jsx` no cambió.

## 4. Reducer y registry de capas

`editorLayerStack.js` es puro y no importa React ni DOM. Su estado contiene solo `id`, `ownerId`, `kind`, `focusPolicy`, `order`, token de instancia/historia, `layers`, `topId` y `nextOrder`. Rechaza `nativePicker`; no almacena callbacks, refs, nodos, eventos, valores, geometría ni datos de tarjeta.

Eventos implementados:

- `OPEN_LAYER`: registra una capa serializable y puede sustituir atómicamente otra del mismo owner;
- `TOGGLE_LAYER`: abre o elimina la instancia actual en una transición;
- `DISMISS_TOP`: valida ID/token y retira solo la superior;
- `REMOVE_LAYER`: ignora IDs o tokens antiguos;
- `RESET`: vuelve al estado inicial.

`useEditorLayerStack` mantiene callbacks, return targets y elementos en un `Map` privado por ID/token. La retirada de una capa borra el registro antes de ejecutar retorno. Los callbacks tardíos usan token de instancia y no pueden cerrar una capa posterior con el mismo ID.

## 5. Portal scope y geometría

El modal raíz sigue portalizado a `document.body`, fuera de `#root`, lo que permite inertizar el shell. Dentro de ese diálogo existe un único `EditorOverlayRoot`. El root:

- se desmonta junto con el diálogo;
- sigue el mismo `EditorGeometrySnapshot` en left/top/width/height;
- usa el fallback CSS inicial del saneamiento;
- posee insets laterales una sola vez;
- no tiene scroll, foco, medición ni estado de capa;
- deja `pointer-events:none` en el host y habilita puntero solo en backdrop/contenido.

`OverlayScope` transporta únicamente `portalTarget`, API de stack y bounds. `OverlayPortal` es el primitive común de color y alineación. En el editor manual ambos portales terminan en `EditorOverlayRoot`; fuera del host migrado `ColorPalette` conserva el fallback temporal a body para compatibilidad hasta Corte 4.

Color conserva lado, presets, transacciones, input no controlado, `showPicker()`/`click()` y política geométrica del Corte 2. Alineación usa el mismo portal/backdrop/layer scope y consume el snapshot, con medición local exclusiva de anchor/contenido. Ninguno usa `aria-modal`; el backdrop tiene `tabIndex=-1`.

## 6. Orden de Escape, Back y backdrop

Existe un solo listener `keydown` y un solo listener `popstate` por instancia activa, ambos en `useEditorLayerStack`.

1. Un picker nativo no entra en la pila y queda bajo control del UA/SO.
2. Escape, Back entregado o backdrop con hija cierran solo `topId`.
3. Sin hija, la misma autoridad solicita cierre de la raíz.
4. `closing` y el token de instancia impiden un segundo `onClose` o eventos antiguos.

Color ya no tiene listener Escape propio; el modal tampoco. Alineación ya no usa el bloque absolute con z-index 80/90. Los cierres por selección, toggle, backdrop, Escape, Back, anchor perdido, guardado y botón final convergen en la API del stack.

## 7. Ownership de historia

La revalidación estática del HEAD efectivo no encontró router, `pushState`, `replaceState` ni `popstate` de producción antes de este corte. Por ello se activó el adapter local.

Al abrir se inserta un sentinel único con token de instancia y URL actual. Para no borrar datos ajenos, el estado anterior se conserva completo dentro del sentinel y, si era un objeto, también se preservan sus propiedades. El comportamiento es:

- Back con hija: cierra la hija y rearma el sentinel de la raíz con el estado recibido;
- Back con solo raíz: cierra la raíz y no rearma;
- Escape/backdrop de hija: no consume el sentinel;
- cierre visual de raíz: solicita `history.back()` para consumirlo y cierra por la ruta guardada aun si el host no entrega `popstate`; una entrega posterior es no-op;
- unmount externo: si el sentinel sigue siendo el estado actual, usa `replaceState` para restaurar el estado previo sin navegar;
- `pagehide`: retira ownership/listeners sin navegación ni mutación adicional.

Si el proyecto incorpora un router, este adapter debe bloquearse y reemplazarse por integración con su API; no se autoriza un segundo owner.

## 8. Modalidad y foco

`#root` queda inert por el lease compartido mientras el diálogo, portalizado fuera de él, permanece activo. El listener único contiene Tab/Shift+Tab dentro del diálogo; para capas `move-focus` contiene el ciclo dentro de la capa top. Las capas abiertas por puntero usan `pointer-preserve`; las abiertas por activación de teclado/AT usan `move-focus` y enfocan su primera acción lógica.

Los return targets viven en el registry DOM, no en reducer. Antes de enfocar se valida `isConnected`, ausencia de ancestro inert y método `focus`. Nunca se enfoca body. `FormInputs` resuelve primero el trigger de pregunta/respuesta que abrió el editor y después el otro control lógico disponible; si ninguno existe no fuerza foco. El lease se libera antes del retorno de foco de raíz. Restauración de selección sigue perteneciendo a `InputSession` y no se mezcla con este retorno DOM.

## 9. Scroll roots, owners e inert

`App.jsx` marca el scroller real con `data-app-scroll-root`. El modal lo resuelve junto con `#root`; si falta, usa `document.body` y solo en DEV emite advertencia. No se introdujeron `touchmove.preventDefault`, `window.scrollTo`, `scrollIntoView`, blur ni detección de teclado.

`acquireScrollLease({owner, scrollRoot, inertRoot})` usa registries por nodo y propietario con conteo. La primera adquisición guarda exactamente:

- `overflow` y `overscrollBehavior` inline;
- `scrollTop` y `scrollLeft`;
- propiedad, presencia y valor del atributo `inert`.

Mientras hay owners aplica `overflow:hidden`, `overscrollBehavior:none` e inert al shell. El editor main, textarea, paleta y ActionSheet legado no son descendientes del scroller bloqueado en el árbol interactivo del portal, por lo que conservan su scroll propio. El último release restaura estilos, offsets y estado/atributo inert exactos. Cada release es idempotente y no puede producir underflow.

Las APIs `lockBodyScroll`, `unlockBodyScroll`, `useBodyScrollLock` e `isBodyScrollLocked` permanecen como adaptadores compatibles. `ManualCardEditorModal` retiró su lock inline. `DeckInterior.handleEdit` retiró el `window.scrollTo({top:0, behavior:'smooth'})`; el fondo conserva su posición y el lease la restaura al cerrar.

## 10. Código retirado

- lock inline de `document.body` del modal;
- listener Escape global del modal;
- handler Escape local de `ColorPalette` dentro del editor scoped;
- portal directo de la paleta manual a body;
- z-index 80/90/110/120 en color/alineación manual;
- alineación `absolute` heredada;
- cierre distribuido que podía afectar padre e hija;
- scroll suave de `DeckInterior.handleEdit`.

Los restauradores rAF de consumidores externos de `StylePanel` permanecen deliberadamente hasta Corte 4; el editor manual ya no los consume como autoridad de capa/foco. Los z-index similares de PDF/ActionSheet externos quedaron fuera de alcance.

## 11. Pruebas y resultados exactos

La advertencia npm `Unknown env config "http-proxy"` apareció sin cambiar códigos de salida.

| Comando / auditoría | Resultado real |
|---|---|
| `npm ci` | PASS; 217 paquetes instalados. |
| saneamiento: `npm run test:manual-editor:unit` | PASS; 32/32 antes de iniciar capas. |
| saneamiento: `npm run build` | PASS; 2216 módulos. |
| `npm run test:manual-editor:unit` final | PASS; 44/44. Incluye `UT-GEO-001..007`, `UT-SES-001..006`, `UT-PICK-001..004`, `UT-LAY-001..006`, `UT-SCR-001..003`, `UT-LIFE-001/002` y contratos KEEP/arquitectura. |
| `npm run build` final | PASS; Vite 5.4.21, 2220 módulos, 5.71 s. |
| `npm run test:pdf-extraction` | PASS; 8/8. |
| `npm run test:schedule` | PASS; 44/44. |
| build aislado `npx vite build --config tests/manual-editor/vite.harness.config.js --outDir dist-harness --emptyOutDir` | PASS; 1576 módulos, 2.31 s. |
| servidor Vite + HTTP controlado | PASS; el primer probe ocurrió antes de ready; el retry devolvió el harness HTML de 1810 bytes. |
| `npx playwright test --list` | PASS de enumeración; 57 casos, 19 por proyecto, incluidos PW-ESC/BACK/SCROLL/A11Y/LIFE. No abrió navegador. |
| comprobación única de ejecutables | `BLOCKED`; Chromium, Firefox y WebKit ausentes/no ejecutables. No se descargaron navegadores. |
| `git diff --check` | PASS. |
| `git diff --name-only -- backend` | PASS; salida vacía. |
| scan de `frontend/dist` | PASS; sin harness, fixtures ni tokens diagnósticos. |
| auditoría estática | PASS para el grafo manual: un keydown, un popstate, un history owner, un portal scope, sin z-index retirados ni lock inline. |

Rutas ausentes en la única comprobación:

- `/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`
- `/root/.cache/ms-playwright/firefox-1538/firefox/firefox`
- `/root/.cache/ms-playwright/webkit-2336/pw_run.sh`

Los specs PW están implementados y enumerados, pero no ejecutados: su estado es `BLOCKED`, nunca `PASS`. WebKit Playwright no se presenta como Safari iOS.

## 12. Harness y privacidad

El harness expone stack/topId, owners y conteos de registry/listeners/sentinel, inert, offsets de scroll, pertenencia del portal, foco activo limitado a tag/testId y cleanup. Incluye secuencias de 20 ciclos, unmount con capa abierta y conserva las pruebas existentes de settling y picker desconocido.

La evidencia continúa cerrada por schema y sanitizador. No admite preguntas, respuestas, valores, nombres, archivos, imágenes, mensajes ni stacks. Los nuevos estados permitidos solo expresan `locked/unlocked`, `inert/interactive` y `scoped/missing`.

## 13. Estado de G3 y pruebas físicas

`PW-ESC-001`, `PW-BACK-001`, `PW-SCROLL-001`, `PW-A11Y-001` y `PW-LIFE-001` están preparados, pero `BLOCKED` por infraestructura. Ninguna prueba de navegador se convirtió en PASS.

Todas las filas de iPhone, iPad, Chrome Android, Samsung Internet, WebView, VoiceOver y TalkBack permanecen **`PENDING — DEVICE REQUIRED`**.

**G3 permanece `OPEN/BLOCKED`.** La excepción autorizó implementar Corte 3, no generalizar capas ni certificar móvil.

## 14. Riesgos abiertos

1. Falta ejecución real de foco, inert, Back, scroll y portal en motores de navegador.
2. Back puede ser interceptado por un host WebView sin entregar `popstate`; Escape, backdrop y botones siguen operables, pero la integración nativa requiere prueba del host.
3. El cleanup externo puede neutralizar el sentinel actual con `replaceState` sin navegar, pero no puede eliminar una entrada ya creada del historial sin traversal; no queda token activo y la URL/estado se conservan.
4. La temporización real de focus/AT y el scroll iOS con OSK/zoom requieren hardware.
5. `ActionSheet` conserva su arquitectura anterior hasta Corte 4; no debe mezclarse con el registry local antes de cerrar G3.

## 15. Rollback separado

### Overlays

Revertir `editorLayerStack`, `useEditorLayerStack`, `EditorOverlayRoot`, `OverlayScope` y sus adaptaciones en modal/paleta/alineación. Esto restaura menús heredados sin tocar el lease ni la sesión. Deben revertirse juntos para no dejar portales sin target o callbacks sin registry.

### Scroll/modalidad

Revertir la evolución de `scrollLock.js`, el marker de `App.jsx`, el resolver de `FormInputs` y la adquisición del modal. Como rollback temporal puede volver el adapter body anterior, pero no deben coexistir lock inline y lease activo. La eliminación del scroll suave de `DeckInterior` puede conservarse de forma independiente.

### Sentinel

Retirar exclusivamente `createEditorHistoryController` y sus listeners/adaptación. Escape, backdrop y botones siguen operables mediante el stack. Este rollback es obligatorio si aparece un router/owner de historia o si Back consume navegación real.

## 16. Condición para autorizar Corte 4

Este informe **no autoriza Corte 4**. Antes de migrar `ActionSheet` o sus 33 consumidores deben:

1. existir ejecutables instalados externamente sin descargarlos desde este corte;
2. ejecutar y pasar PW-ESC/BACK/SCROLL/A11Y/LIFE en los motores disponibles;
3. ejecutar la matriz física P0 de iOS/Android/AT requerida por el plan;
4. confirmar que no hay cierre doble, foco al shell, movimiento de App main, pérdida de scroll interno, owner/portal huérfano ni consumo de navegación;
5. cerrar G3 con evidencia revisada o recibir una nueva excepción expresa que delimite el gate restante.

Hasta entonces no se gradúa el stack a `common/overlays`, no se modifica `ActionSheet` y no se inicia Corte 4.
