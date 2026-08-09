# Informe de implementación — editor manual V2, Corte 2

**Fecha:** 2026-08-09  
**Alcance:** geometría observable y safe area del editor manual.  
**Estado:** implementación y validación determinista terminadas; Playwright `BLOCKED` por ausencia de los tres ejecutables de navegador; pruebas físicas pendientes.  
**Autorización:** se aplicó la excepción expresa para implementar código con G2 abierto por un bloqueo de infraestructura. No se inició el Corte 3 ni se declara certificación móvil o release completo.

## 1. Base efectiva y drift

Antes de editar se ejecutó `fetch` y se inspeccionaron HEAD y estado. El primer checkout local disponible estaba desactualizado en `5278bd0b5416208f46d17f0d42ab53fb32af1401` y contenía cambios no confirmados del Corte 1: no era una base segura. Ese árbol se conservó intacto. Se preparó un checkout limpio separado, se verificó su tracking y se trabajó exclusivamente allí.

El commit base efectivo es `73acb3b3a3e896424dcc0ad1a3fcd74c80f71578`; coincide con `origin/main` después del fetch y con el HEAD anunciado en el encargo. Por tanto, no hubo drift remoto respecto del commit anunciado. El único drift observado fue operacional: el checkout local inicial estaba desactualizado y sucio. El árbol efectivo estaba limpio antes de la primera edición. No se hizo commit ni push.

Antes de modificar código se leyeron completos los 28 archivos de `docs/platform-limitations/`, incluidas las autoridades de Fase 3 y los informes de Corte 0 y Corte 1.

## 2. Archivos

### Creados

- `frontend/src/components/creator/manual-editor/editorGeometry.js`
- `frontend/src/components/creator/manual-editor/useEditorGeometry.js`
- `frontend/src/components/creator/manual-editor/editorGeometry.test.js`
- `docs/platform-limitations/manual-editor-v2-cut-2-report.md`

### Modificados

- `frontend/src/components/creator/ManualCardEditorModal.jsx`
- `frontend/src/components/creator/StylePanel.jsx`
- `frontend/src/components/creator/manual-editor/manualEditorDiagnostics.js`
- `frontend/tests/manual-editor/harness.jsx`
- `frontend/tests/manual-editor/manual-editor-current.spec.js`
- `frontend/tests/manual-editor/manual-editor-contracts.test.js`
- `frontend/tests/manual-editor/evidence-schema.json`
- `frontend/package.json`, solo para incluir el nuevo test en el script unitario
- `docs/platform-limitations/README.md`

No cambiaron `frontend/package-lock.json`, dependencias runtime, backend, `ActionSheet.jsx`, persistencia, sesión, reducer de selección, transacciones de picker ni otro gestor de paquetes.

## 3. Contrato final del snapshot

`readEditorGeometry(windowLike, documentLike)` es puro respecto de su entorno: recibe explícitamente ambos objetos, no usa React, no lee globals implícitos y no inspecciona user-agent, foco, sesión, contenido o nodos.

| Campo | Contrato |
|---|---|
| `revision` | Aumenta solo al publicar una transición semántica o de fase. Una muestra idéntica ya estable conserva objeto y revisión. |
| `epoch` | Empieza en 1 con la primera muestra válida y aumenta al cambiar `portrait`, `landscape` o `square`. No comparte baseline entre orientaciones. |
| `phase` | `unavailable`, `settling` o `stable`. Una muestra nueva entra en `settling`; una confirmación semánticamente igual entra en `stable`. |
| `source` | `visual-viewport` cuando VisualViewport completo es válido; en otro caso `layout-fallback`. |
| `orientation` | Derivada únicamente de `layout.width` y `layout.height`. |
| `layout` | `{left, top, width, height}`; usa el menor ancho/alto positivo entre `inner*` y `documentElement.client*`. |
| `visual` | `{left, top, width, height, scale}`; coincide con `layout`, con escala 1, en fallback. |
| `occlusion` | `{top, right, bottom, left}`; diferencia no negativa entre ambos rectángulos, sin atribuir causa. |

Solo se aceptan números de tipo `number` finitos, dimensiones positivas y escala positiva. Un VisualViewport inválido degrada a layout; si tampoco existe un layout válido se publica `SOURCE_UNAVAILABLE` conservando la última geometría válida. Nunca se publican `NaN`, infinitos, dimensiones negativas o rectángulos cero. No existe ninguna propiedad ni inferencia de teclado, altura máxima histórica o umbral.

El reducer acepta exclusivamente `OPEN`, `SAMPLE`, `CONFIRM`, `SOURCE_UNAVAILABLE` y `CLOSE`.

## 4. Ownership de listeners y publicación

`useEditorGeometry({active, onDiagnosticEvent})` vive localmente en `ManualCardEditorModal` y es la única autoridad de suscripción geométrica del editor. Solo activo registra:

- `visualViewport.resize`;
- `visualViewport.scroll`;
- `window.resize`.

Los eventos solo invalidan. Un scheduler conserva como máximo un `requestAnimationFrame`, lee dentro del callback, publica `settling` y programa la confirmación a `stable`. El reducer evita `setState` ante un snapshot estable idéntico. Cleanup cancela el frame, retira exactamente una vez los tres listeners capturados, invalida callbacks tardíos y tolera los ciclos setup/cleanup de StrictMode.

La instrumentación opcional del hook queda limitada a builds DEV/test y a rectángulos, VisualViewport, orientación y estado permitido. No registra contenido, valores, nombres, archivos, imágenes, mensajes ni stack.

La paleta manual recibe el snapshot y no registra listeners de VisualViewport o `window.resize` cuando ese snapshot existe. Conserva su ruta compatible anterior solo para consumidores externos al editor manual.

## 5. Surface y safe area

La surface `fixed` usa simultáneamente `visual.left`, `visual.top`, `visual.width` y `visual.height`; ningún consumidor mezcla esos valores con el sistema retirado. `main` conserva scroll interno y surface/main/footer tienen límites de ancho y `overflow-x` acotado.

| Borde | Propietario único |
|---|---|
| top | padding de la surface, una vez |
| left/right | área interactiva de la surface, una vez |
| bottom | footer mediante `--editor-safe-bottom-effective` |

Hijos, botones, main y backdrop no vuelven a sumar esos insets.

El valor inferior es conservador por defecto: `unavailable`, `settling`, `layout-fallback`, escala distinta de 1, textarea no activo o ausencia de oclusión inferior conservan `env(safe-area-inset-bottom, 0px)`. Solo `stable + visual-viewport + scale 1 + textarea editorialmente activo + occlusion.bottom > 0` selecciona la mitigación `visual-edge` y usa `0px`. Esta decisión visual combina geometría observable con la sesión existente sin escribir en ninguno de los reducers. No afirma causa ni usa el término como modo de teclado. El fallback nunca elimina safe area.

## 6. Integración de ColorPalette

`ColorPalette` acepta opcionalmente `editorGeometry` y `editorBoundsRef`. En el editor manual:

- utiliza los mismos bounds `{left, top, width, height}` de la surface;
- retiene y expone `scale`, sin multiplicar de nuevo coordenadas CSS ya expresadas en CSS px;
- respeta márgenes y el rectángulo lateral del área interactiva;
- aplica al elemento real `left`, `top`, `width`, `maxWidth` y `maxHeight`;
- reancla con `revision` y `epoch`;
- puede ocultarse durante `settling` y reaparecer medida;
- si desaparece el anchor, cierra por la ruta recuperable existente.

Las transacciones de picker del Corte 1, el input de color no controlado y el fallback `click()` no cambiaron. No se migró `ActionSheet` ni se creó un stack de overlays.

## 7. Geometría heredada retirada

Se retiraron del runtime manual `viewportFrame`, `setViewportFrame`, `keyboardOpen`, `data-keyboard-open`, `initialLayoutHeight`, el baseline máximo, `layoutHeight - 100`, el efecto con listeners React directos, los estilos limitados a `height/offsetTop`, las marcas `@remove-in-cut-2` y la historia visual basada en teclado.

No se retiraron VisualViewport como fuente, portales, textarea real, scroll interno, input color no controlado, fallback `click()`, sesión, selección por lado, transacciones de picker ni CTA compacta de reanudación.

## 8. Pruebas y comandos ejecutados

La advertencia npm `Unknown env config "http-proxy"` apareció en comandos npm y no cambió sus códigos de salida.

| Comando | Resultado real |
|---|---|
| `npm ci` | PASS; 217 paquetes instalados. |
| primer `npm run test:manual-editor:unit` | FAIL; 29/30. La única falla fue el orden de `owners/overflow` en una lista esperada ya ordenada; no fue un fallo de runtime. Se corrigió la expectativa. |
| segundo `npm run test:manual-editor:unit` | PASS; 30/30. Incluye `UT-GEO-001..006`, dos contratos `UT-LIFE-001`, `UT-SES-001..006`, `UT-PICK-001..004` y arquitectura/KEEP. |
| tercer `npm run test:manual-editor:unit`, después del ajuste final para que la primera lectura ocurra dentro de rAF | PASS; 30/30. |
| `npm run build` final | PASS; Vite 5.4.21, 2216 módulos, 5.94 s. |
| `npm run test:pdf-extraction` | PASS; 8/8. |
| `npm run test:schedule` | PASS; 44/44. |
| `npx vite build --config tests/manual-editor/vite.harness.config.js --outDir … --emptyOutDir` | PASS; 1572 módulos; salida aislada fuera del repositorio. |
| servidor Vite del harness + `curl` | El primer probe desde una sesión separada devolvió `000`; la comprobación controlada en el mismo proceso devolvió `200 text/html`. Harness servido correctamente. |
| `npm run test:manual-editor -- --list` | PASS; 42 casos enumerados, 14 por proyecto; contiene PW-GEO-001, PW-GEO-002, PW-OPEN-001 y PW-VIS-001. No abrió navegador. |
| comprobación única de ejecutables Playwright | `BLOCKED`; faltan las tres rutas exactas listadas abajo. No se descargó ni se intentó lanzar navegador. |
| `git diff --check` y búsquedas estáticas finales | PASS. Un primer scan amplio encontró, como falso positivo, los nombres prohibidos dentro de sus propias aserciones de contrato; el scan corregido se limitó al grafo de producción y pasó. |
| `git diff --name-only -- backend` | PASS; salida vacía. |
| `git diff --name-only -- frontend/package-lock.json` | PASS; salida vacía. |
| scan de `frontend/dist` | PASS; no aparecen `__manualEditorHarness`, fixtures, stubs ni tokens diagnósticos del harness. |

Los ejecutables ausentes en la única comprobación fueron:

- `/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`
- `/root/.cache/ms-playwright/firefox-1538/firefox/firefox`
- `/root/.cache/ms-playwright/webkit-2336/pw_run.sh`

## 9. Estado real de Playwright, pruebas físicas y G2

PW-GEO-001, PW-GEO-002, PW-OPEN-001 y PW-VIS-001 están implementadas y enumeradas, pero su ejecución es `BLOCKED`, no `PASS`. Tampoco se convierte WebKit Playwright en evidencia de iOS físico.

Todas las pruebas en iPhone, iPad, Chrome Android, Samsung Internet y WebView permanecen `PENDING — DEVICE REQUIRED`. No se afirma comportamiento del OSK, chrome móvil, notch o dispositivo físico por inferencia.

**G2 permanece `OPEN/BLOCKED`.** La excepción autoriza este código fuente y la retirada de la autoridad geométrica heredada después de quedar verdes sampler, tests deterministas, contratos, build y consumidores; no autoriza certificación móvil ni release completo.

## 10. Riesgos abiertos

1. Ningún motor real ejecutó todavía los casos geométricos, de reanclaje, safe area u overflow; solo existen pruebas puras, contratos, compilación y harness preparado.
2. La temporización de VisualViewport, zoom y UI móvil sigue necesitando navegador y dispositivo reales.
3. `env(safe-area-inset-*)` solo puede verificarse en hardware/configuración que exponga insets reales.
4. Las responsabilidades de capas, Escape/Back, inert/focus trap y locks siguen deliberadamente en Corte 3; los FIXME de overlay/foco existentes no se resolvieron aquí.

## 11. Rollback y condición para Corte 3

El corte no migra datos ni backend. Su rollback consiste en revertir juntos los archivos de este informe: eliminar los tres módulos geométricos nuevos y restaurar los consumidores/tests/documentación a la base efectiva `73acb3b3a3e896424dcc0ad1a3fcd74c80f71578`. Eso restaura el adaptador legado del Corte 1 como una sola unidad; no debe hacerse una reversión parcial que deje dos autoridades activas.

Este informe no autoriza el Corte 3. Para autorizarlo deben mantenerse verdes las suites deterministas y el build sobre el diff revisado, instalarse externamente los binarios sin que este corte los descargue, ejecutar satisfactoriamente PW-GEO-001/002, PW-OPEN-001 y PW-VIS-001 y cerrar G2 con la evidencia de navegador/dispositivo exigida por el plan, o existir una nueva excepción expresa que defina qué parte de ese gate puede permanecer bloqueada. Hasta entonces G2 sigue abierto.
