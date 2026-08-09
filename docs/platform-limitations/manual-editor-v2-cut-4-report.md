# Informe de implementación — editor manual V2, Corte 4

**Fecha:** 2026-08-09  
**Alcance:** migración interna del `ActionSheet` compartido a la arquitectura común de capas, foco, geometría, modalidad y scroll.  
**Estado:** implementación y validación determinista terminadas; Playwright `BLOCKED` por ausencia de ejecutables; `G4 OPEN/BLOCKED`.  
**Límite:** no se inició el Corte 5, no hubo cambios de backend/persistencia ni rediseño visual.

## Base y drift

- Repositorio: `CesarJGB/Under-FlashCards-FrontEnd`.
- Rama y tracking: `main` → `origin/main`.
- HEAD local/remoto después de `git fetch`: `be8be8a071b0e5e1bf172d41cafb78d60c6d5be0`.
- Árbol inicial: limpio.
- Drift real respecto del HEAD anunciado: ninguno.
- No se hizo commit ni push.

## Arquitectura común final

El reducer probado se movió, sin copia ni segunda implementación, de `creator/manual-editor/editorLayerStack.js` a `common/overlays/layerStack.js`. La ruta anterior conserva únicamente un re-export de compatibilidad para rollback; no contiene reducer propio. `overlayRegistry.js` mantiene callbacks, nodos y return targets fuera del reducer y aporta:

- un coordinador único de `keydown`, `popstate` y `pagehide` para editor y sheets;
- un registry compartido de `ActionSheet` con tokens stale como no-op;
- cierre top-only de Escape, Back y backdrop;
- sentinel único para el stack standalone;
- foco conectado/no inert y containment de Tab;
- cleanup idempotente y snapshots deterministas.

El editor conserva su hook local y su sentinel raíz, pero delega eventos globales al coordinador común. Un `ActionSheet` dentro de `OverlayScope` usa el stack y la modalidad del host; uno standalone usa el registry común y `acquireScrollLease`. No existen listeners Escape/Back por sheet.

`ActionSheet` mantiene `open`, `title`, `options`, `onClose`, `selectedId`, `compact`, `children`, `content`, `footer` y `closeAction`. El backdrop es un `div` no enfocable. Lower sheets permanecen montados con `inert`, `aria-hidden` y puntero desactivado. El foco inicial ocurre en `useLayoutEffect`, sin timer, y el último owner restaura scroll/inert antes del retorno lógico.

Cada sheet crea un `OverlayScope` cuyo portal target vive en su propio layer. `StylePanel` registra `ColorPalette` como hija `popover`; conserva input color no controlado, `showPicker()`/`click()` y scroll. La paleta usa el sampler geométrico del scope y se cierra antes que su sheet.

La surface consume el `EditorGeometrySnapshot` existente (`left`, `top`, `width`, `height`, `scale`), conserva fallback inicial seguro, bounds laterales, safe area inferior una vez y scroll interno hasta la última acción. No se creó heurística de teclado ni sampler duplicado.

## Callers representados

El inventario único encontró 33 instancias en 15 archivos. Se validan por clase equivalente:

1. opciones simples/destructivas: `DeckCard`, `DeckHeader` → `PW-AS-001`;
2. custom/footer: `FlashcardCreator` + `StylePanel` + `ColorPalette` → `PW-AS-002`;
3. PDF/pickers: `PdfExtractor` → contrato público conservado y suites PDF;
4. sheets consecutivos/anidados: `ScheduleCalendar` y modales → `PW-AS-003` y suite calendario;
5. contenido largo: `ExamCreationWizard`, `ExamFoldersView` → `PW-AS-004`.

Los callers no se reescribieron salvo la eliminación del único `preserveFocus` en `FlashcardCreator.jsx`. La búsqueda final de producción devuelve cero ocurrencias.

## Archivos

### Creados o graduados

- `frontend/src/components/common/overlays/layerStack.js`
- `frontend/src/components/common/overlays/overlayRegistry.js`
- `frontend/src/components/common/overlays/overlayRegistry.test.js`
- `docs/platform-limitations/manual-editor-v2-cut-4-report.md`

### Modificados

- `frontend/src/components/common/ActionSheet.jsx`
- `frontend/src/components/common/OverlayScope.jsx`
- `frontend/src/components/creator/StylePanel.jsx`
- `frontend/src/components/creator/ManualCardEditorModal.jsx`
- `frontend/src/components/FlashcardCreator.jsx`
- `frontend/src/components/creator/manual-editor/useEditorLayerStack.js`
- `frontend/src/components/creator/manual-editor/editorLayerStack.test.js`
- `frontend/src/lib/scrollLock.js`
- `frontend/tests/manual-editor/harness.jsx`
- `frontend/tests/manual-editor/manual-editor-current.spec.js`
- `frontend/tests/manual-editor/manual-editor-contracts.test.js`
- `frontend/package.json`
- `docs/platform-limitations/README.md`

### Graduado

- `frontend/src/components/creator/manual-editor/editorLayerStack.js` quedó como re-export de compatibilidad; la única implementación vive en `common/overlays/layerStack.js`.

## Validación mínima

| Comando | Resultado real |
|---|---|
| `npm ci` | PASS; 217 paquetes instalados. |
| `npm run test:manual-editor:unit` | PASS; 47/47, incluidos UT-AS-001/002. |
| `npm run build` | PASS; Vite 5.4.21, 2221 módulos. |
| `npm run test:schedule` | PASS; 44/44. |
| `npm run test:pdf-extraction` | PASS; 8/8. |
| `npx playwright test --list` | PASS de enumeración; 69 casos, incluidos PW-AS-001..004 en tres proyectos. No abrió navegador. |
| comprobación única de ejecutables | `BLOCKED`; Chromium, Firefox y WebKit ausentes. No se descargaron navegadores. |
| `git diff --check` | PASS; salida vacía. |
| `rg -n "preserveFocus" frontend/src` | PASS contractual; cero coincidencias (salida vacía, exit 1 propio de `rg` sin matches). |

Las specs Playwright están preparadas pero no ejecutadas; no son PASS. WebKit Playwright no se presenta como Safari iOS. Las pruebas físicas no se ejecutaron y siguen `PENDING — DEVICE REQUIRED`.

## Estado, riesgos y rollback

**G4 permanece `OPEN/BLOCKED`** por infraestructura. Riesgos abiertos:

- falta comprobar en motor real el orden Escape/Back, foco, inert y restauración de scroll;
- falta validar contenido largo, zoom/landscape y safe area en navegador;
- falta `DEV-AS-001` en Safari iOS, Chrome Android y Samsung Internet.

Rollback: revertir `ActionSheet.jsx`, `OverlayScope.jsx`, la adaptación scoped de `StylePanel` y el registry standalone; devolver el reducer común a la ruta local del editor y restaurar sus imports, sin retirar los módulos funcionales de los Cortes 1–3. No restaurar `preserveFocus`, timer 0 ni listeners Escape independientes.

## Condición para iniciar Corte 5

No iniciar Corte 5 hasta disponer de ejecutables, ejecutar PW-AS-001..004 y las regresiones de Corte 3, ejecutar `DEV-AS-001` en las familias físicas requeridas y cerrar G4 sin fallos de última acción, lower sheet interactivo, cierre doble, paleta fuera de scope, foco inválido o restauración incompleta de scroll/inert.
