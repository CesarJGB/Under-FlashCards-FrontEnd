# Informe de implementación — editor manual V2, Corte 5

**Estado del código:** implementación/migración estática del Corte 5 terminada.  
**Estado de certificación:** `G5 — BLOCKED — DEVICE REQUIRED`.  
**Base efectiva:** `origin/main` después de `git fetch origin`: `9a775679b882469ab7c998b5d4233a6087af56cf`.  
**Commit/push:** no realizados.

## Alcance ejecutado

Se eliminó únicamente legado sin consumidores confirmado después de los Cortes 1–4:

1. Se eliminó `frontend/src/components/creator/manual-editor/editorLayerStack.js`, que solo re-exportaba el reducer común. `useEditorLayerStack`, `overlayRegistry` y sus pruebas usan directamente `frontend/src/components/common/overlays/layerStack.js`. `editorLayerStack.test.js` se conserva en su ubicación porque sigue siendo una prueba de integración del editor.
2. Se retiraron de `FlashcardCreator.jsx` `onFooterHeightChange`, `footerRef`, el `useLayoutEffect` de medición, `ResizeObserver`, el fallback de `resize` y el `ref` del footer. La búsqueda de callers confirmó cero consumidores.
3. El barrido del runtime del editor confirmó cero usos de `keyboardOpen`, `initialLayoutHeight`, `baseline`, el umbral fijo `100`, guardias/timers de picker o menú, `customColorChangedRef`, `preserveFocus` y la dependencia de `useKeyboardHeight`.

No se modificó la UX ni se añadieron funciones. No hubo cambios de backend, dependencias runtime ni lockfile.

## Estado base y drift

El checkout inicial local estaba en `be8be8a071b0e5e1bf172d41cafb78d60c6d5be0` y tenía cambios no confirmados de los cortes anteriores, incluidos archivos que este corte debía inspeccionar. `git fetch origin` actualizó `origin/main` al HEAD solicitado `9a775679…`. Para no sobrescribir ese drift, el trabajo se realizó en un checkout limpio separado exactamente sobre `origin/main`; ese checkout estaba limpio antes de editar y no presentó drift conflictivo en los archivos del Corte 5.

## Validación mínima

| Comando | Resultado exacto |
|---|---|
| `npm run test:manual-editor:unit` | **PASS** — 47 tests, 47 pass, 0 fail. |
| `npm run build` | **PASS** — Vite transformó 2221 módulos. |
| `git diff --check` | **PASS** — salida vacía. |
| Búsquedas dirigidas | **PASS** — 0 importadores del adaptador; 0 `onFooterHeightChange`/`footerRef`; 0 símbolos de legado en producción; 0 dependencia de `useKeyboardHeight` en el editor; 1 implementación real del reducer en `common/overlays/layerStack.js`. |

La primera ejecución de la suite no pudo resolver `react` porque el checkout limpio no tenía dependencias; se ejecutó `npm ci` únicamente por esa razón y la repetición final pasó completa.

## Legado eliminado y contratos conservados

Eliminado:

- adaptador `creator/manual-editor/editorLayerStack.js`;
- medición huérfana de altura del footer y todos sus recursos asociados.

Conservado deliberadamente:

- `useKeyboardHeight.js` y sus consumidores externos;
- API heredada de `scrollLock.js` y leases/tokens/inert vigentes;
- `useModalAccessibility`;
- textarea real, selección por lado y restauración de rango;
- `showPicker()` con fallback `click()`;
- input color no controlado;
- portales, scope, scroll interno, safe areas y `-webkit-fill-available`;
- sentinel y registro global de Back, además de la autoridad top-only común.

## Riesgos y certificación pendiente

El build, los tests deterministas y las búsquedas estáticas no certifican el comportamiento de un navegador móvil ni del sistema operativo. No se ejecutó Playwright y no se repitieron pruebas físicas.

`G5` queda exactamente como **`BLOCKED — DEVICE REQUIRED`**. Siguen pendientes resultados reales para Safari iOS, Android/Chrome, Samsung Internet, WebView, OSK/IME, picker nativo, cutouts/notch/Dynamic Island y botones Back físicos. Ninguna de esas familias se marca `PASS` por inspección estática, emulación o `node:test`.
