# Informe de implementación — editor manual V2, Corte 0

**Fecha:** 2026-08-08  
**Alcance:** caracterización e instrumentación; no se implementó ningún módulo de los Cortes 1–5.  
**Estado:** implementación del harness y pruebas deterministas terminada; ejecución Playwright `BLOCKED` por ausencia de binarios de navegador.  
**Gate G0:** abierto. No se autoriza iniciar el Corte 1 hasta ejecutar el harness en navegador.

## 1. Base, commit y drift previo

El primer `HEAD` observado antes de editar fue `ba3027f0d34fa9297f4224235eef263f3d387671`. El árbol contenía como cambios locales los documentos de Fase 3. Tras `git fetch origin` se comprobó que esos mismos contenidos ya estaban publicados, sin diferencias de contenido, en `33550ae5d60f3f29933ae9ae5590aae6bd286daf`. Se preservó el árbol, se hizo fast-forward a ese commit y se retiró el stash redundante antes de tocar el Corte 0.

| Comprobación | Resultado |
|---|---|
| Commit documentado por Fase 3 | `ba3027f0d34fa9297f4224235eef263f3d387671` |
| Commit base efectivo del Corte 0 | `33550ae5d60f3f29933ae9ae5590aae6bd286daf` |
| Diferencia entre ambos commits | Solo documentación de Fase 3: `README.md` y los seis documentos `manual-editor-v2-*` |
| Drift de producción antes del corte | Ninguno |
| Gestor de paquetes | npm 11.9.0 sobre Node.js 24.14.0 |
| Lockfile | `frontend/package-lock.json`, lockfile v3 |
| Segundo tipo de lockfile | No creado |

Los blobs de producción revalidados antes y después del corte son:

| Archivo | Blob SHA-1 |
|---|---|
| `frontend/src/components/creator/ManualCardEditorModal.jsx` | `5fb3896552d9e0adc9808f4097ba92176432a864` |
| `frontend/src/components/creator/StylePanel.jsx` | `ba944e932ad88ef0e1ad6700b3dca4819eedd232` |
| `frontend/src/components/common/ActionSheet.jsx` | `f54e7ec2bb893a0b1b5193b8c0f1621ef5c81209` |
| `frontend/src/components/FlashcardCreator.jsx` | `d3f2cae00eff2aa2edcbe09c9e3cc59096e7f0bd` |
| `frontend/src/components/creator/FormInputs.jsx` | `144dfba3a642163aaf253a137e6558dece97ea0d` |
| `frontend/src/components/DeckInterior.jsx` | `dcbce121d5d9e6c1cdcdaac9fe9ba88554dcc6fa` |
| `frontend/src/App.jsx` | `4c84bb52a1d3435b6183ee14aa8e9fec40ddc501` |
| `frontend/src/lib/scrollLock.js` | `67c0b6c3e7bda65bc99ac714db3225215bd99569` |

`frontend/package.json` y su lockfile sí cambian en este corte, exclusivamente para scripts y dependencias de desarrollo.

## 2. Archivos del corte

### Creados

- `frontend/playwright.config.js`
- `frontend/tests/manual-editor/harness.html`
- `frontend/tests/manual-editor/harness.jsx`
- `frontend/tests/manual-editor/manual-editor-current.spec.js`
- `frontend/tests/manual-editor/evidence-schema.json`
- `frontend/tests/manual-editor/manual-editor-contracts.test.js`
- `frontend/tests/manual-editor/vite.harness.config.js`
- `frontend/src/components/creator/manual-editor/manualEditorDiagnostics.js`
- `docs/platform-limitations/manual-editor-v2-cut-0-report.md`

### Modificados

- `frontend/package.json`
- `frontend/package-lock.json`
- `docs/platform-limitations/README.md`

No se modificó backend. No se modificó ningún componente de producción existente.

## 3. Scripts añadidos

| Script | Uso |
|---|---|
| `npm run test:manual-editor:harness` | Sirve únicamente el harness Vite aislado en `127.0.0.1:4174`. |
| `npm run test:manual-editor:unit` | Ejecuta contratos deterministas, privacidad y `KEEP`. |
| `npm run test:manual-editor` | Ejecuta la spec Playwright en los proyectos configurados. |
| `npm run test:manual-editor:chromium` | Ejecuta solo el proyecto Chromium. |
| `npm run test:manual-editor:all` | Encadena contratos deterministas y Playwright. |

Todos los scripts preexistentes se conservaron. `@playwright/test@1.62.1` se añadió a `devDependencies`; no se añadió ninguna dependencia de runtime.

## 4. Harness implementado

El harness importa y monta los componentes reales `ManualCardEditorModal` y `ActionSheet`; no copia su implementación. No importa autenticación ni clientes de API, no hace `fetch`, no usa base de datos y no lee almacenamiento del navegador.

Incluye fixtures totalmente sintéticos para:

1. tarjeta vacía;
2. pregunta y respuesta distintas;
3. texto de 36 líneas;
4. estilos distintos de pregunta/respuesta y alineación izquierda/derecha por apertura de lado;
5. SVG mock seguro como imagen;
6. error de guardado simulado;
7. estado de guardado;
8. viewports portrait y landscape desde los proyectos/casos Playwright;
9. un App main desplazable con `data-app-scroll-root`.

La API de prueba permite abrir pregunta o respuesta, alternar lados, escribir, establecer rangos diferentes, abrir/cerrar color y alineación, repetir el mismo trigger, elegir un preset, controlar stubs de color e imagen, abrir/cerrar el `ActionSheet`, forzar renders, leer listeners, capturar geometría y ejecutar ciclos repetidos. `PW-CHAR-001` contiene 20 aperturas/cierres consecutivos.

## 5. Instrumentación y privacidad

`manualEditorDiagnostics.js` implementa una lista permitida cerrada. Solo acepta timestamps relativos, tipos/tokens, tag/test ID, elemento activo sin valor, rectángulos, `VisualViewport`, orientación, conteos de render/listeners, offsets de scroll, IDs conceptuales de capa, owners, estados y nombre/código de error sin mensaje.

El sanitizador descarta por construcción pregunta, respuesta, nombre de mazo, valores, contenido, nombre de archivo, imagen, token, credenciales, mensaje y stack. `evidence-schema.json` usa `additionalProperties: false` y los tests verifican que esos campos no pueden representarse.

La instrumentación:

- está habilitada solo cuando `import.meta.env.DEV` es verdadero;
- se importa únicamente desde el entry point aislado del harness;
- no aparece en el grafo ni en el bundle normal de producción;
- instala el probe de listeners/`ResizeObserver` solo en el harness;
- devuelve funciones de cleanup y las ejecuta en `pagehide`;
- no añade listeners a la aplicación normal ni modifica tiempos/estado de UX.

## 6. Casos de caracterización y P0

Las specs se compilan y se enumeran para Chromium, WebKit y Firefox. Su ejecución real quedó bloqueada antes de montar la página porque no hay ejecutables instalados.

| P0 de auditoría | Cobertura del Corte 0 | Estado real en este entorno |
|---|---|---|
| `EDITOR-KB-001` | Fixme dinámico de rotación, junto con snapshot sin afirmar OSK. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-VV-001` | Fixme dinámico portrait → landscape. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-SAFE-001` | Mismo caso de geometría; no valida inset físico. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-COLOR-001` | Fixme dinámico: activación por Enter del custom color. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-COLOR-002` | Caso `test.skip` explícito para picker/OSK/selección reales. | `PENDING — DEVICE REQUIRED`. |
| `EDITOR-COLOR-004` | `PW-CHAR-002`: toggle, preset y separación del stub nativo. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-FOCUS-003` | Fixme dinámico: `Shift+Tab` puede salir al App simulado. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-COLOR-005` | Fixme dinámico de Escape con paleta abierta. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-OVERLAY-002` | Mismo fixme de orden de capa/Escape. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-AS-001` | `PW-CHAR-003` observa Escape del `ActionSheet` real; OSK físico queda pendiente. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-SCROLL-001` | `PW-CHAR-001` registra App root, scroll interno, owner/body y cleanup. | Implementado; ejecución `BLOCKED`. |
| `EDITOR-STATE-001` | `PW-CHAR-001` registra renders/listeners y 20 ciclos. | Implementado; ejecución `BLOCKED`. |

En consecuencia, ningún P0 se declara reproducido automáticamente como PASS en esta máquina. Hay reproducciones automáticas preparadas para `EDITOR-COLOR-001`, `EDITOR-VV-001`, `EDITOR-KB-001`, `EDITOR-SAFE-001`, `EDITOR-OVERLAY-002`, `EDITOR-COLOR-005` y `EDITOR-FOCUS-003`, pero el bloqueo del navegador impidió observar su resultado. Los `test.fixme` son condicionales: si el defecto deja de reproducirse, el test exige el comportamiento corregido y no conserva el fallo como expectativa permanente.

### Casos fixme/skip

- `FIXME EDITOR-COLOR-001 — Enter no activa actualmente el picker custom`.
- `FIXME EDITOR-VV-001 / EDITOR-KB-001 / EDITOR-SAFE-001 — rotación se clasifica como teclado`.
- `FIXME EDITOR-OVERLAY-002 / EDITOR-COLOR-005 — Escape salta la paleta sin foco`.
- `FIXME EDITOR-FOCUS-003 — Shift+Tab puede entrar al App simulado`.
- `PENDING — DEVICE REQUIRED EDITOR-COLOR-002 / DEV-IOS-002 / DEV-AND-001 — picker nativo, OSK y selección`.

## 7. Decisiones KEEP protegidas

Los nueve tests deterministas quedaron PASS. Entre ellos se protegen exactamente los `KEEP` pedidos:

| IDs | Assert principal |
|---|---|
| `KEEP-001` | `textarea` real, selección explícita y `setSelectionRange`; la spec añade escritura/cambio de lado/rangos. |
| `KEEP-002` | Detección de `showPicker`, captura de rechazo y fallback `input.click()`. |
| `KEEP-003` | `input[type=color]` con `defaultValue`, no controlado durante la UI nativa. |
| `KEEP-005` | Listeners `resize`/`scroll` de `VisualViewport` y cleanup simétrico. |
| `KEEP-006` | Footer `shrink-0` dentro de la superficie del editor. |
| `KEEP-007` | Scroll/overscroll internos del editor, paleta y `ActionSheet`. |
| `KEEP-009` | Acción táctil explícita de reanudación, sin afirmar que abrió el OSK. |
| `KEEP-011` | Ausencia de blur, `scrollIntoView`, `touchmove` global, `useKeyboardHeight` nuevo y zoom bloqueado. |
| `KEEP-012` | `viewport-fit=cover` y 16 px en inputs/textarea para pointer coarse. |
| `KEEP-013` | Preview y sheet de estilos permanecen suspendidos al abrir el editor manual. |

La interacción de navegador de `KEEP-001/002/003/005/006/007/009` sigue sin resultado runtime por el bloqueo de binarios; los contratos estáticos sí se ejecutaron y pasaron.

## 8. Comandos de instalación y validación

La advertencia npm `Unknown env config "http-proxy"` apareció en comandos npm y no cambió su exit code.

| Comando | Resultado real |
|---|---|
| `git rev-parse HEAD` / `git status --short` | PASS; registró inicialmente `ba3027f…` y los documentos locales de Fase 3. |
| `git fetch origin` | PASS; encontró `33550ae…`. |
| `git diff --name-status ba3027f…..33550ae…` y comparación de contenidos/blobs | PASS; solo documentación de Fase 3, producción idéntica. |
| stash temporal + `git merge --ff-only origin/main` + retirada del stash redundante | PASS; base efectiva `33550ae…`, sin pérdida de contenido. |
| `npm ci` antes de editar | PASS; 214 paquetes, lockfile preexistente. |
| `npm run build` antes de editar | PASS; Vite 5.4.21, 2212 módulos. |
| `npm run test:pdf-extraction` antes de editar | PASS; 8/8. |
| `npm run test:schedule` antes de editar | PASS; 44/44. |
| `npm install --save-dev @playwright/test` | PASS; lockfile actualizado por npm. |
| Primera ejecución de `npm run test:manual-editor:unit` durante autoría | FAIL; 6/7 por un matcher del propio test que confundía `$defs.token` con un campo prohibido. Matcher corregido; no fue un fallo de producción. |
| `npm ci` con el lockfile final | PASS; 217 paquetes. |
| `npm run test:manual-editor:unit` final | PASS; 9/9. |
| `npm run build` final | PASS; 2212 módulos y los mismos nombres/tamaños de artefacto que el baseline. |
| `npm run test:pdf-extraction` final | PASS; 8/8. |
| `npm run test:schedule` final | PASS; 44/44. |
| `npx vite build --config tests/manual-editor/vite.harness.config.js --outDir <directorio-temporal> --emptyOutDir` | PASS; 1568 módulos; bundle aislado del harness. |
| `npm run test:manual-editor:harness` + solicitudes HTTP a HTML, JSX transformado, diagnóstico y modal real | PASS; los cuatro recursos se sirvieron desde Vite sin backend. |
| `npx playwright --version` | PASS; 1.62.1. |
| `npx playwright test tests/manual-editor/manual-editor-current.spec.js --list --reporter=line` | PASS; 30 casos enumerados, 10 por proyecto. |
| `npx playwright install --list` | BLOCKED; no existía caché enlazada de navegadores. |
| `npx playwright install chromium firefox webkit` | BLOCKED; las descargas desde `cdn.playwright.dev` llegaron truncadas/0 MiB y Playwright terminó con exit code 1. |
| Smoke `PW-CHAR-001` con `--project=chromium` | BLOCKED; falta `chromium_headless_shell-1234`. |
| Smoke `PW-CHAR-001` con `--project=webkit` | BLOCKED; falta `webkit-2336/pw_run.sh`. |
| Smoke `PW-CHAR-001` con `--project=firefox` | BLOCKED; falta `firefox-1538/firefox`. |
| Scan de `frontend/dist` por símbolos/string del harness/diagnóstico | PASS; cero coincidencias. |
| `git diff --check` | PASS. |
| `git diff --name-only -- backend` | PASS; vacío. |

No se declara exitoso `npm run test:manual-editor`, porque no llegó a ejecutar una página en ninguno de los tres motores.

## 9. Pruebas físicas pendientes

Playwright WebKit no se considera Safari iOS. Permanecen, sin excepción, `PENDING — DEVICE REQUIRED`:

- iPhone/iPad: `DEV-IOS-001`, `DEV-IOS-002`, `DEV-IOS-003`, `DEV-IOS-004`, `DEV-IOS-005`, `DEV-IPAD-001`, `DEV-IPAD-002`;
- Android/familias: `DEV-AND-001`, `DEV-AND-002`, `DEV-SAM-001`, `DEV-WV-001`, `DEV-WV-002`, `DEV-AND-HW-001`, `DEV-AX-AND-001`;
- pickers/sheets/cutouts: `DEV-PICK-IMG-001`, `DEV-AS-001`, `DEV-CUTOUT-001`, `DEV-HOME-001`.

No se marca como PASS apertura real del OSK, toolbar de Safari, Dynamic Island, Samsung Internet, WebView, picker nativo, Back entregado por el host ni safe area física. El cambio de viewport Playwright solo caracteriza la heurística actual; no emula un teclado físico.

## 10. Producción, UX y rollback

- El build normal conserva los mismos chunks con hash que el baseline, incluidos `index-BpeOQ6zF.css` e `index-C_j4i91Q.js`.
- El harness no forma parte de `frontend/dist`.
- El archivo de diagnóstico nuevo no tiene importadores de producción y queda inerte fuera de Vite DEV.
- No hay listeners ni diagnósticos activos en producción.
- No se cambiaron safe areas, foco, picker, `ActionSheet`, scroll lock, Back, overlays ni `keyboardOpen`.
- No se añadió reducer, hook, geometry snapshot, scope/stack/lease ni sentinel.
- No cambió la experiencia visible ni el comportamiento de producción.

La condición de rollback del Corte 0 no se activó: build y tests existentes siguen pasando y los componentes críticos conservan sus blobs.

## 11. Riesgos y autorización del Corte 1

Riesgos abiertos:

1. Los binarios Playwright no pudieron descargarse en este entorno; puede haber errores de runtime aún no observados en las specs.
2. La equivalencia de listeners se diseñó pero no pudo ejecutarse durante los 20 ciclos.
3. WebKit Playwright, cuando esté disponible, seguirá sin sustituir iOS físico.
4. La alineación distinta por lado se expresa mediante dos aperturas del fixture porque el modelo actual solo expone una alineación global; no se introdujo estado por lado del Corte 1.

**Corte 1 no autorizado todavía.** Para cerrar G0 y autorizarlo deben instalarse los navegadores Playwright y ejecutarse como mínimo:

1. `npm run test:manual-editor:unit` con 9/9 PASS;
2. `PW-CHAR-001`, `PW-CHAR-002` y `PW-CHAR-003` en Chromium y WebKit;
3. los 20 ciclos con igualdad de listeners y cleanup de overflow;
4. los casos defectuosos únicamente como fixme con sus IDs, sin nuevos FAIL;
5. `npm run build`, `test:pdf-extraction` y `test:schedule` nuevamente en PASS.

Las pruebas físicas pueden continuar pendientes para iniciar el desarrollo del Corte 1, tal como indica el plan, pero deben permanecer registradas y no pueden convertirse en PASS por emulación.
