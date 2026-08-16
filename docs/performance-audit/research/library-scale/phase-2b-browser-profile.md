# Fase 2B — Perfil real de navegador de Library y apertura de mazos (corregido)

## 1. Estado del repositorio y flujo de dos commits

| Dato | Resultado |
|---|---|
| Rama | `perf/phase-2b-library-browser-profile` |
| Base de aplicación (`applicationBaseSha`) | `ecb025914435fa4659200c9890a0e4ffea916175` (`origin/main`, contenedor backend productivo con esa imagen) |
| HEAD del harness (`harnessSha`, Commit A) | `611ffb0fc614f98d79b9f8ee191897bd7206e53a` |
| Commit B (resultados + documentación) | ver sección 20 |
| Drift | **Ninguno**: `origin/main == ecb0259…` (verificado con `git fetch origin` y `git rev-parse origin/main`) |
| Estado del árbol en los runs | **Limpio** (cambios rastreados = 0) en ambos runs; el runner exige árbol limpio salvo `PERF_ALLOW_DIRTY=1` (sólo depuración) |
| Archivos de sesión ajenos (`session-ses_*.md`) | Sin seguimiento, conservados e intactos; no entran en ningún commit |
| Corte 5A | En observación (ventana de 14 días continúa activa) |
| Corte 5B | **BLOCKED** |
| Migración del Corte 4 | **NOT RUN** |

**Corrección de reproducibilidad aplicada (flujo de dos commits)**: la versión anterior de la fase registraba `appSha == harnessSha == ecb0259…` aunque el harness que produjo las mediciones sólo existía en cambios sin commit y se publicó en otro SHA; esa evidencia no era reproducible. Los artefactos actuales declaran por separado `applicationBaseSha` (aplicación productiva medida) y `harnessSha` (Commit A que contiene el harness con el que se ejecutaron ambos runs). Los dos runs finales (productivo y profiling) se ejecutaron desde el Commit A con árbol limpio; cualquier cambio posterior en runner/instrumentación/serializador/esquema invalidaría los resultados y exigiría re-ejecutar ambos runs.

## 2. Objetivo y alcance

**Objetivo**: instrumentar y medir el comportamiento real del frontend en Chromium (build de producción de Vite + navegador controlado con Playwright) contra los datos reales ya caracterizados en la Fase 2A, atribuyendo por separado red, recepción/decodificación del body, `JSON.parse` puro, transformación, hidratación desde `safeLocalStorage`, renders y commits de React, layout, paint, tareas largas, memoria y crecimiento del DOM, además del tiempo hasta que Library y los mazos quedan realmente utilizables. Fase exclusivamente de medición e investigación: **no implementa optimizaciones, correcciones de rendimiento, deduplicación de loaders, memoización nueva, virtualización, paginación, índices, cambios de API ni modificaciones de UX**.

**Alcance autorizado e implementado**:

- Instrumentación mínima con bandera en código productivo: `frontend/src/lib/perfLibraryProfile.js` (inerte sin la bandera), contadores de renders e invocaciones de `loadDecks`/`loadMaterias` en `App.jsx`, `HomeSection.jsx`, `LibrarySection.jsx`, `DeckInterior.jsx`, `FlashcardCollection.jsx` y `FlashcardGrid.jsx`, y export nombrado `DashboardScreen` desde `App.jsx` para montar la superficie real.
- Harness de navegador: `frontend/tests/performance/library-browser/` (`index.html`, `main.jsx`, runner `run-browser-profile.mjs`, utilidades puras `libraryBrowserProfileUtils.mjs`, validador post-run `validate-final-results.mjs`, pruebas deterministas `library-browser-profile.test.js`).
- Scripts npm `test:library-browser` y `perf:library-browser` (frontend).
- **Correcciones de integridad de la medición (Commit A)**:
  - Correlación CDP **uno a uno** (cada solicitud consume como máximo una entrada CDP y cada entrada se asigna a una sola solicitud; emparejamiento determinista por orden de completación; solicitudes sin correlación segura marcadas explícitamente `unmatched` — nunca heredan métricas de otra — y excluidas de los agregados, sin doble contabilización).
  - Separación de capas persistida por escenario y repetición: red (CDP), body/decode (`response.clone().text()`), `JSON.parse` puro, transformación, render/commit de React, layout/paint y tiempo hasta utilizable.
  - Tareas largas persistidas por escenario y repetición (conteo, total, máximo, offsets relativos sanitizados, alcance de ventana; cero sólo si la observación estuvo activa).
  - React persistido por escenario y repetición para B1–B7 (renders, invocaciones de loaders, commits con fase/`actualDuration`/`baseDuration`/`startTime`/`commitTime` y bucket `first-open`/`warm-open`/`library-entry`).
  - `deck-cards` desagregado por colección (C20/C100/C500) y por apertura (inicial/caliente), nunca mezclado en un único agregado.
  - Guardia 5A con reporte por run: indexadas, legacy, all-cards, métodos, escrituras, preflights CDP.
- Ejecución real contra el backend productivo autorizado: **5 repeticiones válidas por escenario en el build productivo** y **5 en el build de profiling**.
- Resultados crudos sanitizados: `raw-results-2b.json` (productivo) y `raw-results-2b-profiling.json` (profiling), esquema 3.0.0.
- Este informe y actualizaciones factuales de los README.

**Fuera de alcance (no implementado)**: deduplicación de `loadDecks`/`loadMaterias`, cambios en dependencias de efectos, cancelación/coordinación nueva de solicitudes, caché compartida, React Query/SWR u otras dependencias, memoización nueva, virtualización, paginación, lazy loading, cambios de payload, índices MongoDB, Server-Timing, cambios de compresión, thumbnails/migraciones de imágenes, eliminación de `?t=`, modificación de `safeLocalStorage`, corrección de filtros O(F×D), dataset sintético D100/D500, C1000, variantes I0–I3, sesiones all-cards, editor/guardado/review, pruebas físicas de iPhone y recomendaciones definitivas de arquitectura.

## 3. Entorno de medición

| Dato | Resultado |
|---|---|
| Build | `vite build` productivo servido con `vite preview` en `localhost:3000` (sin servidor de desarrollo, sin React Strict Mode) |
| Navegador | Chromium headless real de Playwright 1.62.1 (`chromium-1234`) |
| Versión | `151.0.7922.34` (`environment.chromiumVersion`) |
| Viewport | 1280×900, DPR 1, `reducedMotion: 'reduce'` |
| Throttling CPU | ninguno (baseline principal) |
| Memoria | `--enable-precise-memory-info` (`performance.memory` real; sin placeholders) |
| Caché HTTP | controlada por contexto: contexto nuevo por escenario; arranque caliente sólo con siembra explícita de `localStorage` |
| Ejecución | contenedor `mcr.microsoft.com/playwright:v1.62.1-jammy` (Node v24.18.1; el host carece de las librerías del binario; el contenedor es de investigación y no modifica el repo salvo lo que el runner escribe con `--out`) |
| Node/SO/CPU/RAM | `environment.node` (`v24.18.1`), `environment.platform`, `environment.cpuModel` (AMD EPYC, 4 vCPU), `environment.totalMemoryBytes` (8.3 GB) |
| Backend | `production-backend-A` (dominio real sólo en memoria/entorno del proceso; nunca persistido) |
| Usuario | `real-user-A` (ID real sólo en variable de entorno; nunca persistido) |

El harness monta el `DashboardScreen` real de producción directamente (sin el overlay artificial de 2.500 ms de `FlashcardsApp`, declarado en las limitaciones).

## 4. Metodología (corregida)

1. Verificación de base: `git fetch origin`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git rev-parse origin/main` (sin drift frente a `ecb0259…`).
2. Lectura completa de la documentación obligatoria (`AGENTS.md`, skill `implement-cut`, `docs/performance-audit/`, reporte 2A) y de los flujos productivos relevantes.
3. **Corrección de la correlación CDP** (defecto de la versión anterior): `mergeCdpNetwork()` buscaba la última entrada CDP por ventana y URL normalizada, de modo que N solicitudes iguales en la misma ventana reutilizaban la misma entrada (mismo TTFB/tamaños para todas; p. ej. las 10 muestras de `deck-list` de B1 con un único TTFB). La nueva `correlateCdpNetwork()` (utilidad pura, probada) empareja **uno a uno** dentro de cada (ventana, URL normalizada): ambos lados se ordenan por finalización (solicitudes completadas primero; las abortadas al final y sin consumir entradas) y se emparejan en orden causal; cada entrada se asigna a una sola solicitud; los grupos con conteo desigual se señalan (`countMismatch`) y las solicitudes sin correlación segura quedan `unmatched` (nunca heredan métricas ajenas). Los agregados se calculan sólo con muestras correlacionadas (`summarizeNetworkSamples`): una muestra por solicitud, sin doble contabilización.
4. **Medición separada de capas** (página del harness, detrás de la bandera `VITE_PERF_HARNESS_INSTRUMENT=1` que sólo define el runner): `bodyReadMs` (lectura/decodificación del body con `response.clone().text()`), `parseMs` (`JSON.parse` puro), `transformMs` (transformación productiva replicada con las mismas funciones puras); la equivalencia semántica con `response.json()` se verifica una vez por URL única en segundo plano (`verified`/`mismatch`, nunca contenido). La red NO se estima en la página: proviene de CDP Network (TTFB/descarga/tamaños/`Content-Encoding`). El `JSON.parse` de localStorage se mide aparte y **no** sustituye al de las respuestas de red.
5. **Persistencia por escenario y repetición**: DOM, memoria, long tasks (resumen + offsets relativos), `pageTimings` (body/parse/transform por superficie) y React (sólo profiling: renders, loaders, commits con bucket) se guardan en `scenarios.*.samples[].snapshot`; la pérdida de datos en la serialización está cubierta por pruebas deterministas del esquema.
6. **Flujo de dos commits**: Commit A (harness corregido + pruebas + validador) → runs finales desde árbol limpio con `harnessSha` del Commit A → Commit B (artefactos + informe + docs + cuerpo de PR). El runner se niega a medir con cambios rastreados.
7. Verificación determinista (54 pruebas del harness, 74 de image-delivery, 54 de la Fase 2A) y validación post-run automática (`validate-final-results.mjs`): esquema 3.0.0, sanitización/privacidad y guardia 5A, con `PASS` en ambos artefactos.
8. Comparación prudente con 2A (sección 13): las cifras de 2A se citan como referencia de backend/API, nunca como medidas por 2B.

## 5. Instrumentación productiva (mínima y con bandera)

`frontend/src/lib/perfLibraryProfile.js` expone un singleton que sólo se activa cuando el build define `VITE_PERF_LIBRARY_PROFILE === '1'` (el build de profiling del harness la define; el build productivo normal no). Desactivada, todas las funciones son **no-ops sin estado, sin User Timing y sin lecturas de reloj**: no cambian estado, solicitudes, orden visual ni UX. La afirmación publicada es que la bandera queda **desactivada y la instrumentación es inerte (no-op) en el build normal**; la ausencia del texto `perfLibrary` en el bundle minificado se reporta como dato, **sin interpretarla como prueba de tree-shaking** (para probar eliminación real se necesitaría una inspección más fuerte; no se realiza esa afirmación).

Puntos instrumentados en código productivo:

- `renderCount(name)` al inicio del cuerpo de `DashboardScreen`, `HomeSection`, `LibrarySection`, `DeckInterior`, `FlashcardCollection` y `FlashcardGrid`.
- `beginLoader('loadDecks' | 'loadMaterias', { showSpinner, signal })` al inicio de ambos loaders y `end('ok' | 'error')` en su terminación, con detección de solapamiento de ejecuciones equivalentes.
- Export nombrado `export { DashboardScreen }` al final de `App.jsx` (el entry productivo sigue consumiendo el default export).

No altera solicitudes, respuestas, estado, renders ni UX; no añade dependencias; no introduce User Timing en producción.

## 6. Harness y guardia del Corte 5A

El harness monta el `DashboardScreen` real y mide desde la página (patch de `fetch` observacional con separación body/parse/transformación, `PerformanceObserver` de long tasks/layout-shift/paint/measure, conteo de DOM, `performance.memory`, `Profiler` en el build de profiling) y desde el runner (CDP tracing de scripting/layout/paint/raster/GC, CDP Network con preflights descartadas por tipo `Preflight`, `Performance.getMetrics`, `HeapProfiler.collectGarbage` diagnóstico).

La guardia `assertRequestGuard` (utilidad pura, probada) inspecciona cada solicitud antes de continuarla y **falla inmediatamente** (aborta la solicitud, marca el reporte como `FAIL` y detiene las siguientes repeticiones) si:

- una superficie protegida (`deck-list`, `deck-cards`, `all-cards`) no lleva `contract=indexed`;
- la lista de mazos no lleva `cover=thumbnail`;
- aparece una solicitud legacy (contract ausente o distinto de `indexed`);
- aparece un método distinto de `GET` (escritura o mutación).

El reporte por run separa: `totalIndexedEvents`, `legacyEvents`, `allCards`, `protectedRequests`, `otherRequests`, `totalRequests`, `writes`, `cdpPreflights`, `violations` y `methods`. Las preflights `OPTIONS` se identifican por el guard y por CDP (tipo `Preflight`) y no se cuentan como solicitudes de aplicación. Las superficies que no participan en el contrato de imágenes (materias, temas, subtemas, preferencias, balance, health, domain-preview) se clasifican como `other` y **nunca** como legacy.

## 7. Datos reales, privacidad y credenciales

- Identificadores reales (usuario y mazos) recibidos únicamente por variable de entorno (`PERF_TEST_USER_ID`) o seleccionados en memoria desde la respuesta indexada de Library; nunca hardcodeados ni persistidos.
- No se persiste ni muestra: IDs reales, nombres de mazos/materias/temas/subtemas, preguntas/respuestas, Data URLs, cuerpos completos, tokens/cookies/credenciales, la URL real del backend ni headers de autenticación. Los dumps de diagnóstico se redactan antes de persistir.
- Los resultados persistidos usan únicamente `real-user-A`, `C20-real`, `C100-real`, `C500-real`, `production-backend-A` y el patrón `<backend-url>`.
- La sanitización (`sanitizeResults`) rechaza claves de contenido, tokens (`data:`), cadenas largas sin alias y cualquier 24-hex sin alias o sin permiso explícito (sólo los SHAs públicos del informe); el runner escribe el archivo únicamente si la validación completa pasa.
- **Escaneo automático post-run** (`validate-final-results.mjs`, ejecutado antes del Commit B): valida esquema, sanitización/privacidad (IDs reales, dominio, tokens, claves de contenido, cadenas largas) y guardia 5A sobre ambos JSON; resultado `PASS` en ambos.
- Artefactos temporales con datos reales (trazas CDP crudas en memoria, logs del contenedor de ejecución, salidas de smoke en `/tmp`) viven fuera del repositorio y no entran en Git.

## 8. Escenarios ejecutados y matriz

Mínimo de **cinco repeticiones válidas por escenario** en el build productivo; con cinco muestras se reporta mínimo, mediana, máximo y muestras correctas/fallidas; **p95 = NOT MEASURED** (no se calcula un p95 engañoso con cinco muestras).

| Escenario | Descripción | Muestras | Estado |
|---|---|---|---|
| B1 | Arranque frío: contexto nuevo, sin caché `decks_<userId>` ni `materias_<userId>`, dashboard real hasta Home estable; invocaciones de loaders y solicitudes efectivas | 5 | 5/5 OK |
| B2 | Arranque caliente: siembra de `localStorage` con los datos reales capturados en B1; hidratación completa y revalidación de red real | 5 | 5/5 OK |
| B3 | Entrada a Library desde Home (interacción real): acción→interacción habilitada, →contenido visible, →estado estable ("Library useful"); fría y caliente | 5 frías + 5 calientes | 5/5 OK |
| B4 | Procesamiento de Library sobre los 29 mazos: filtro por path académico, búsquedas, 5 ordenamientos, conteos y enriquecimiento de Home | 5 | 15 ops × 5 ejecuciones, 0 fallos |
| B5 | Apertura de C20-real (exactamente 20 tarjetas): primera apertura y reapertura caliente; cardinalidad verificada | 5 | 5/5 OK |
| B6 | Apertura de C100-real (exactamente 100 tarjetas) | 5 | 5/5 OK |
| B7 | Apertura de C500-real (exactamente 500 tarjetas) | 5 | 5/5 OK |

Los mazos se seleccionan en memoria con la **misma regla que 2A** (radio relativo 25 %, desempate por id lexicográfico; distancia 0 requerida, de lo contrario el escenario queda BLOCKED, nunca aproximado). La cardinalidad se verifica doble: `<article>` montados en el DOM (`whenDeckUsable`) y `cards.length` de la respuesta indexada capturada (`cardinalityExact`).

## 9. Resultados medidos principales (build productivo)

### 9.1 Tiempo hasta utilizable

| Escenario | Muestras | Mín (ms) | Mediana (ms) | Máx (ms) | p95 |
|---|---:|---:|---:|---:|---|
| B1 Home útil (frío) | 5 | 810 | 956 | 1.017 | NOT MEASURED |
| B2 Home útil (caliente) | 5 | 697 | 714 | 748 | NOT MEASURED |
| B3 Library útil — entrada fría (estable) | 5 | 548 | 629 | 942 | NOT MEASURED |
| B3 Library útil — entrada caliente (estable) | 5 | 561 | 590 | 759 | NOT MEASURED |
| B3 entrada fría — interacción habilitada | 5 | 491 | 565 | 869 | NOT MEASURED |
| B3 entrada fría — contenido visible | 5 | 515 | 596 | 912 | NOT MEASURED |
| B3 entrada caliente — interacción habilitada | 5 | 507 | 547 | 704 | NOT MEASURED |
| B3 entrada caliente — contenido visible | 5 | 535 | 557 | 733 | NOT MEASURED |

### 9.2 C20/C100/C500 (apertura y reapertura)

| Caso | Apertura inicial (ms) min/med/max | Reapertura caliente (ms) min/med/max | Elementos verificados | Cardinalidad exacta | Muestras |
|---|---:|---:|---:|---:|---|
| C20-real | 502 / 544 / 598 | 200 / 220 / 305 | 20 | sí (5/5) | 5 |
| C100-real | 311 / 344 / 516 | 271 / 291 / 507 | 100 | sí (5/5) | 5 |
| C500-real | 575 / 696 / 913 | 515 / 530 / 665 | 500 | sí (5/5) | 5 |

En los datos corregidos, la reapertura caliente es más rápida en mediana para las tres colecciones: ~2,5× (C20: 544→220), ~1,2× (C100: 344→291) y ~1,3× (C500: 696→530). **La conclusión anterior ("C500 caliente ≈1,4× más rápido" sobre 679 ms iniciales vs 683 ms calientes) era incorrecta** porque partía de una correlación CDP defectuosa; con los nuevos datos la mejora caliente de C500 existe en mediana pero con n=5 y rangos amplios es **indicativa, no concluyente**. `backUsableMs`, `firstCollectionMs`, memorias por apertura y `afterGcDiagnostic` están en `raw-results-2b.json` (`scenarios.B5/B6/B7.samples[]`).

### 9.3 Loaders, solicitudes y duplicación (evidencia temporal corregida)

- **Solicitudes protegidas**: 160, todas `contract=indexed`, lista de mazos con `cover=thumbnail`; **legacy 0; all-cards 0; escrituras 0; métodos: sólo GET; violaciones 0**.
- `deck-list`: 130 solicitudes (26 por repetición: 2 en B1/B2, 3 en B3, 4 en B4 y en cada ventana de mazos), **130 correlacionadas, 0 unmatched**, 40 pares solapados en 5 repeticiones (1 par solapado por ventana y repetición — la solicitud de `HomeSection` y la del efecto de `DashboardScreen` se solapan en cada carga). `materias`: 130, mismas 40 pares solapados. **PERF-NET-001 confirmado con evidencia temporal** (solapamiento real de solicitudes equivalentes).
- `deck-cards`: 10 por colección (5 aperturas + 5 reaperturas), 0 solapamientos (sin duplicación de apertura de mazos).
- `materia-domain-preview`: 820 solicitudes en el run (≈164 por repetición), de las cuales **529 correlacionadas y 291 abortadas sin respuesta (unmatched)** — el enriquecimiento de Home dispara solicitudes equivalentes en pares y la primera de cada par se aborta al montarse la segunda (patrón de duplicación con aborto). Estas solicitudes no participan en el contrato de imágenes (superficie `other`, nunca legacy).
- `preferences` 85 (40 pares solapados), `balance` 40, `temas`/`subtemas` 10 cada una (sólo al navegar el path académico).
- **Invocaciones de función** de `loadDecks`/`loadMaterias` (conteo, inicio/fin, resultado, abortos, solapamiento) en el build de profiling (sección 9.7): 4 en B1 (2 `loadDecks` + 2 `loadMaterias`; la segunda de cada par —`hasSignal: true`, del efecto de `DashboardScreen`— solapa con la primera), 6 en B3 (la entrada a Library añade otro par) y 8 en B4/B5/B6/B7.

### 9.4 Red por superficie (CDP uno a uno, sin doble contabilización)

Metadatos reales vía **CDP Network** (el Resource Timing cross-origin está enmascarado porque el backend no envía `Timing-Allow-Origin`); duraciones del runner en `durationMs` (para solicitudes correlacionadas, delta CDP del mismo reloj). Medianas:

| Superficie | N | matched/unmatched | TTFB (ms) | Descarga (ms) | Duración (ms) | Transferidos (B) | Decodificados (B) | Content-Encoding |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| deck-list | 130 | 130 / 0 | 556,5 | 2,9 | 565,5 | 222.527 | 303.769 | gzip |
| materias | 130 | 130 / 0 | 86,4 | 0 | 96,5 | 0* | 7.214 | gzip |
| deck-cards (C20/C100/C500) | 30 | 30 / 0 | 150,5 | 0 | 155,0 | 6.061 | 48.474 | gzip |
| temas | 10 | 10 / 0 | 133,0 | 0 | 135,0 | 605,5 | 1.130,5 | mixto |
| subtemas | 10 | 10 / 0 | 67,4 | 0 | 69,5 | 2 | 2 | ausente |
| preferences | 85 | 85 / 0 | 90,8 | 0 | 107,5 | 0* | 487 | — |
| balance | 40 | 40 / 0 | 191,7 | 0 | 199,7 | 0* | 561 | — |
| materia-domain-preview | 820 | 529 / 291 | 86,5 | 0 | 100,3 | 0* | 194 | — |

\* Transferido 0 = servida desde la caché HTTP del contexto (identificado por `transferSize` 0; no es un cero medido). Los agregados se calculan **sólo** con muestras correlacionadas (`unmatched` excluido) y cada muestra contribuye una única vez: sin doble contabilización de bytes ni tiempos.

**deck-cards por colección y por apertura** (`network.byCollection`, nunca mezcladas en un único agregado):

| Colección | Apertura | N | TTFB mediana (ms) | Transferidos (B) | Decodificados (B) |
|---|---:|---:|---:|---:|---|
| C20-real | inicial | 5 | 137,1 | 1.332 | 9.433 |
| C20-real | caliente | 5 | 132,4 | 1.332 | 9.433 |
| C100-real | inicial | 5 | 146,2 | 6.061 | 48.474 |
| C100-real | caliente | 5 | 154,2 | 6.061 | 48.474 |
| C500-real | inicial | 5 | 268,9 | 36.327 | 261.005 |
| C500-real | caliente | 5 | 245,6 | 36.327 | 261.005 |

El tamaño decodificado de `deck-cards` (48.474 B de mediana global) coincide con el de C100-real de 2A, y la lista (303.769 B) con los 303.769 B de 2A: **el contrato indexado es estable** y la compresión gzip del edge reduce la lista a ~222-264 KB y el detalle C100 a 6.061 B — la compresión navegador/edge que 2A dejó NOT MEASURED queda medida.

**Correlación CDP (resumen)**: 964 solicitudes emparejadas / 291 sin correlación (todas abortadas) / 80 grupos con conteo desigual (señalados `countMismatch`); los detalles por grupo están en `network.correlation.groups` con URL redactada (`:id`).

### 9.5 Almacenamiento (`safeLocalStorage`)

Hidratación medida en página con las funciones productivas (`getItem` + `JSON.parse` + `sanitizeDeckSummaries`), 5 muestras por clave (primera repetición válida; resúmenes por repetición en las muestras de B1/B2):

| Operación | Tamaño | Muestras | Total min/med/max (ms) | getItem | parse | sanitize |
|---|---:|---:|---:|---:|---:|---|
| `decks_<id>` frío | 303.767 chars / 29 mazos | 5 | 0,3 / 0,5 / 3,1 | 0–0,3 | 0,2–3,1 | 0 |
| `materias_<id>` frío | 7.203 chars / 13 materias | 5 | 0 / 0,1 / 1,1 | — | — | — |
| stringify + setItem (`decks_<id>`) | 303.767 chars | 5 | 6,1–6,6 | stringify 0,6–3,9 | setItem 3,8–5,9 | — |

Todas las ejecuciones `status: ok` (sin ausencias ni errores). **El `JSON.parse` de esta sección mide el parseo de localStorage y NO se presenta como medición del `JSON.parse` de respuestas de red**; el parseo de red se mide aparte (sección 9.6). Los loaders persisten cada respuesta (`setJSON`) sin optimizaciones.

### 9.6 Separación red / body / JSON.parse puro / transformación (por escenario y repetición)

`pageTimings` en `scenarios.*.samples[].snapshot.pageTimings` (por escenario y repetición). Medianas de medianas por repetición (ms):

| Escenario | Superficie | bodyRead (ms) | parseMs (ms) | transform (ms) | Equivalencia verificada |
|---|---|---:|---:|---:|---|
| B1 (Home frío) | deck-list | 7,8 | 0,40 | 0,15 | 5/5 |
| B1 (Home frío) | materias | 15,0 | 0,10 | — | 5/5 |
| B3 frío | deck-list | 11,6 | 0,60 | 0,00 | 5/5 |
| B4 | deck-list | 9,0 | 0,30 | 0,05 | 5/5 |
| B5 | deck-cards | 1,8 | 0,10 | 0,20 | 5/5 |
| B6 | deck-cards | 4,4 | 0,25 | 0,20 | 5/5 |
| B7 | deck-cards | 9,6 | 0,80 | 0,35 | 5/5 |

- `bodyReadMs` = lectura/decodificación del body (`response.clone().text()`), sin parseo; `parseMs` = `JSON.parse(text)` **puro**; `transformMs` = transformación productiva replicada (misma función pura que ejecuta el código real tras el parseo).
- Equivalencia semántica con `response.json()`: verificada una vez por URL única; **0 fallbacks de parseo y 0 discrepancias** en todos los escenarios y ambos builds.
- La red NO se estima aquí: proviene de CDP (sección 9.4). El render/commit de React está en la sección 9.7; layout/paint en 9.8; el tiempo hasta utilizable en 9.1.
- Cualquier superficie sin muestras válidas en una ventana queda declarada `NOT MEASURED` con motivo (nunca omisión ni cero silencioso).

### 9.7 React (build de profiling) — por escenario y repetición

Construcción de profiling de React (`react-dom/profiling` mediante alias **sólo** en el build del harness; verificado funcionalmente: `react.aliasVerified: true`, Profiler.onRender emitió commits — en un build productivo normal no se emiten; `vite.config.js` y el build normal no aplican el alias). Primera repetición válida; datos completos por repetición en `react.scenarios.*`:

| Escenario | Renders (componentes instrumentados) | Commits (fases) | actualDuration total (ms) | baseDuration total (ms) | Buckets |
|---|---|---|---:|---:|---|
| B1 | DashboardScreen 6, HomeSection 10 | 10 (1 mount, 1 nested-update, 8 update) | 54,7 | 44,3 | 10 null |
| B2 | DashboardScreen 6, HomeSection 10 | 10 (1 mount, 1 nested-update, 8 update) | 62,8 | 56,7 | 10 null |
| B3 frío | DashboardScreen 9, HomeSection 9, LibrarySection 4 | 14 (1 mount, 2 nested-update, 11 update) | 108,4 | 99,3 | 5 library-entry |
| B3 caliente | DashboardScreen 9, HomeSection 9, LibrarySection 4 | 15 (1 mount, 2 nested-update, 12 update) | 128,0 | 157,3 | 6 library-entry |
| B4 | DashboardScreen 12, HomeSection 18, LibrarySection 26 | 94 (1 mount, 20 nested-update, 73 update) | 223,7 | 435,1 | 77 atribuidos a ops |
| B5 (C20) | DashboardScreen 14, HomeSection 9, LibrarySection 14, DeckInterior 12, FlashcardCollection 4, FlashcardGrid 2 | 33 (1 mount, 4 nested-update, 28 update) | 141,1 | 123,7 | 10 first-open, 6 warm-open |
| B6 (C100) | DashboardScreen 14, HomeSection 10, LibrarySection 9, DeckInterior 11, FlashcardCollection 4, FlashcardGrid 2 | 31 (1 mount, 5 nested-update, 25 update) | 187,3 | 153,7 | 5 first-open, 5 warm-open |
| B7 (C500) | DashboardScreen 14, HomeSection 9, LibrarySection 9, DeckInterior 11, FlashcardCollection 4, FlashcardGrid 2 | 30 (1 mount, 5 nested-update, 24 update) | 237,9 | 154,4 | 5 first-open, 5 warm-open |

- Cada commit persiste `id` (componente), `phase`, `actualDuration`, `baseDuration`, `startTime`, `commitTime` y `bucket` (`first-open`/`warm-open`/`library-entry`/`mark:op:*`/null), con tiempos relativos y sanitizados.
- **Invocaciones de loaders**: 4 en B1/B2 (2 `loadDecks` + 2 `loadMaterias`; la segunda de cada par con `hasSignal: true` **solapa** con la primera — duplicación de PERF-NET-001 a nivel de función), 6 en B3, 8 en B4–B7; todas `ok`, 0 abortadas.
- Los tiempos de escenarios del profiling (B5 509/225, B6 321/262, B7 614/501) son coherentes con los del build productivo (sección 9.2); el Profiler añade overhead en la apertura C500 (~50-100 ms). **No se mezclan duraciones entre builds.**

### 9.8 CPU del navegador (scripting/layout/paint/long tasks/GC)

Atribución por trazas CDP (primera repetición válida; categorías ausentes → NOT MEASURED, no cero):

| Escenario | FunctionCall | Layout | UpdateLayoutTree | Paint | RasterTask | GC principal |
|---|---:|---:|---:|---:|---:|---|
| B1 (Home frío) | 163,0 ms (50) | 94,8 ms (16) | 24,5 ms (45) | 27,1 ms (69) | 156,3 ms (119) | scavenger ~16 ms |
| B3 frío (entrada Library) | 371,8 ms (138) | 146,6 ms (21) | 62,2 ms (61) | 41,1 ms (82) | 360,7 ms (196) | scavenger ~22 ms |
| B3 caliente | 389,9 ms (150) | 105,5 ms (20) | 48,3 ms (67) | 40,1 ms (99) | 292,8 ms (199) | scavenger ~18 ms |
| C20-real | 392,5 ms (522) | 136,6 ms (45) | 104,0 ms (147) | 53,3 ms (209) | 314,6 ms (505) | mark-compactor 52,3 ms |
| C100-real | 494,2 ms (486) | 175,9 ms (40) | 107,1 ms (149) | 102,9 ms (317) | 454,8 ms (539) | mark-compactor 46,7 ms |
| C500-real | 540,3 ms (484) | 323,6 ms (38) | 169,4 ms (132) | 56,9 ms (238) | 371,4 ms (461) | mark-compactor 100,7 ms |

(Cifras de `cpuAttribution.traces.*`, primera repetición válida.)

**Tareas largas (PerformanceObserver, por escenario y repetición)** — conteo/total/máximo (mediana; n=5):

| Escenario | Conteo (mediana) | Total (ms, mediana) | Máx (ms, mediana) |
|---|---:|---:|---|
| B1 | 1 | 114 | 114 |
| B2 | 1 | 118 | 118 |
| B3 frío | 2 | 199 | 115 |
| B3 caliente | 2 | 220 | 125 |
| B4 | 3 | 259 | 115 |
| B5 (C20) | 2 | 243 | 118 |
| B6 (C100) | 3 | 262 | 111 |
| B7 (C500) | 6 | 644 | 158 |

Los `relativeStartOffsetsMs` (offsets relativos al `timeOrigin`, sanitizados) y el alcance de ventana están por repetición en `scenarios.*.samples[].snapshot.longTasks`; el cero sólo se registra cuando la observación estuvo activa (`zeroValid`); si el observador no estuvo activo, `NOT MEASURED`. La observación estuvo activa en todos los escenarios (Chromium los soporta).

**Atribución CPU de B4: NOT MEASURED** — la traza CDP de la ventana B4 no produjo eventos de interés en la primera repetición (anomalía de captura headless; `droppedEvents: 0`). **No se infiere la atribución CPU de B4 a partir de la duración total de las operaciones.**

### 9.9 Memoria

`performance.memory` (primera repetición válida; por repetición en las muestras; el `JSHeapUsedSize` de CDP se registra aparte, API distinta no comparable):

| Punto | usedJSHeapSize |
|---|---:|
| antes de entrar a Library (B3 frío) | 6,2 MB |
| después de Library utilizable (B3 frío) | 8,2 MB (+2,0 MB) |
| antes de entrar a Library (B3 caliente) | 7,9 MB |
| después de Library utilizable (B3 caliente) | 10,6 MB (+2,7 MB) |
| después del procesamiento B4 | 13,3 MB |
| después de abrir C20-real | 11,9 MB (tras GC diagnóstico: 6,3 MB) |
| después de abrir C100-real | 12,5 MB (tras GC diagnóstico: 6,4 MB) |
| después de abrir C500-real | 8,8 MB (tras GC diagnóstico: 8,2 MB) |

Las lecturas tras abrir cada mazo son muestras únicas por escenario (página fresca por escenario) y dependen del momento de GC; el GC explícito por CDP se etiqueta como medición diagnóstica.

### 9.10 DOM

Primera repetición válida (por repetición en `scenarios.*.samples[].snapshot.dom`):

| Superficie | Nodos totales | Nodos de la superficie | `<article>` | Botones | Imágenes | Fondos inline |
|---|---:|---:|---:|---:|---:|---|
| Home (B1) | 191 | — | 0 | 20 | 0 | — |
| Library raíz (B3 frío) | 569 | 492 | 0 | 51 | 0 | 2 |
| C20-real (grid) | 367 | 311 | 20 | — | — | 0 |
| C100-real (grid) | 1.567 | 1.511 | 100 | — | — | 0 |
| C500-real (grid) | 7.567 | 7.511 | 500 | — | — | 0 |

Delta C20→C100→C500: 311 → 1.511 → 7.511 nodos de mazo (×4,9 y ×5,0; exactamente 20/100/500 `<article>`). Los mazos seleccionados no tienen fondos (0 imágenes inline).

## 10. Errores y muestras descartadas

- Build productivo: 0 errores, 0 muestras fallidas, 5/5 repeticiones válidas.
- Build de profiling: 0 errores, 0 muestras fallidas, 5/5 repeticiones válidas.
- Los resultados de la versión anterior de la fase (correlación CDP reutilizando entradas, `appSha == harnessSha`, sin long tasks/React/DOM por repetición) quedan **invalidados** y fueron sustituidos por los presentes; las cifras antiguas no se reutilizan.
- B4 CPU: traza CDP vacía de eventos de interés en la primera repetición (NOT MEASURED para esa atribución).

## 11. Limitaciones

- Headless Chromium en el contenedor de investigación; no equivale a Safari/GPU/compositor de dispositivo físico (prohibido presentarlo como tal).
- El overlay artificial de 2.500 ms de `FlashcardsApp` no participa: se monta `DashboardScreen` real sin el retardo configurado.
- En el build productivo no hay Profiler: renders/commits provienen exclusivamente del build de profiling y nunca se mezclan.
- Con 5 muestras, p95 = NOT MEASURED (regla del encargo).
- `performance.memory` mide el heap JS del renderer; no es comparable con `JSHeapUsedSize` de CDP (se etiquetan por separado).
- La caché HTTP no se reutiliza entre escenarios: el "caliente" es una siembra de `localStorage`, no una caché HTTP caliente (los contextos son nuevos; las respuestas de caché intradocumento se identifican por `transferSize` 0).
- **Los tiempos de las operaciones de B4 incluyen la interacción completa (UI, apertura/cierre del ActionSheet, espera de estabilidad de 2 rAF) y no representan por sí solos el coste puro del algoritmo de filtrado u ordenamiento.** La atribución CPU de B4 es NOT MEASURED y no se infiere de la duración total.
- La correlación CDP es por orden causal dentro de cada (ventana, URL normalizada): con solicitudes simultáneas idénticas, TTFB/tamaños se asignan en orden de completación; los grupos con conteo desigual quedan señalados (`countMismatch`) y las solicitudes abortadas quedan `unmatched` (nunca heredan métricas ajenas).
- Los tiempos de red se miden con CDP sobre el backend productivo desde la máquina local (R0); no representan redes degradadas (R1/R2 quedan para investigación posterior).
- El tiempo de la página del harness añade la lectura `text()` + `JSON.parse` de la instrumentación (misma operación que realiza `res.json()`); la equivalencia semántica se verificó y el build productivo normal de la aplicación no incluye esta instrumentación.

## 12. Resultados del build de profiling (React)

Build de profiling de React (`react-dom/profiling`, sin Strict Mode), 5 repeticiones válidas (PASS PARCIAL; 160 eventos indexados, 0 legacy, 0 all-cards, 0 violaciones, 0 escrituras; `raw-results-2b-profiling.json`):

- **Renders/commits por escenario**: ver tabla de la sección 9.7. Los commits de B5/B6/B7 se separan en `first-open` y `warm-open` (bucket por marcas del harness); los de B3 en `library-entry`; los de B4 se atribuyen a cada operación (`mark:op:*`).
- **Invocaciones de loaders**: 4 en B1/B2, 6 en B3, 8 en B4–B7, con la duplicación solapada de PERF-NET-001 confirmada a nivel de función (segunda ejecución con `hasSignal: true` y `overlapped: true`); todas `ok`, 0 abortos.
- Los tiempos de escenarios del profiling son coherentes con el build productivo (B5 509/225 ms, B6 321/262 ms, B7 614/501 ms de mediana). **No se mezclan duraciones entre builds.**

## 13. Comparación prudente con la Fase 2A

Las cifras de 2A se citan como referencia de backend/API medida con un cliente Node; **no se copian como medidas por 2B**. 2B mide el navegador:

| Dato | 2A (cliente Node) | 2B (navegador) |
|---|---|---|
| Lista de mazos wire bytes | 303.769 B (sin compresión anunciada) | 303.769 B decodificados; mediana 222.527 B transferidos (gzip real del edge) |
| Lista latencia | 235,86 ms mediana (total HTTP) | TTFB mediana 556,5 ms; duración mediana 565,5 ms (CDP, incluye red) |
| C100-real detalle | 48.474 B / 148,08 ms | 48.474 B decodificados / 6.061 B gzip / TTFB mediana 146,2-154,2 ms |
| Parseo | <1,2 ms (Node) | body 1,8-15 ms + parse puro 0,1-0,8 ms en navegador (sección 9.6) |
| Render/storage/DOM/memoria/commits | NOT MEASURED | Medidos (secciones 9.5–9.10) |

La comparación es informativa y no directa: distinta herramienta, distinto protocolo de red y distinto punto de medición (el navegador añade parseo, estado, renders y paint que el cliente Node no ejecuta).

## 14. Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `node --test tests/performance/library-browser/library-browser-profile.test.js` (desde `frontend/`) | **54/54** (incluye 14 pruebas nuevas de correlación CDP uno a uno, esquema de persistencia, long tasks y timings de página) |
| `npm run test:library-browser` | **54/54** |
| `npm run test:image-delivery` | **74/74** |
| `cd backend && node --test test/libraryScaleBaseline.test.js` | **54/54** |
| `npm run build` (frontend) | correcto (~14 s; advertencias de chunk normales, no fallos) |
| Run productivo final (Commit A, árbol limpio, 5 muestras/escenario) | **PASS PARCIAL**, 5/5, 160 indexadas, 0 legacy, 0 all-cards, 0 escrituras, 0 violaciones |
| Run de profiling final (Commit A, árbol limpio, 5 muestras/escenario) | **PASS PARCIAL**, 5/5, 160 indexadas, 0 legacy, 0 all-cards, 0 escrituras, 0 violaciones |
| `node tests/performance/library-browser/validate-final-results.mjs raw-results-2b.json raw-results-2b-profiling.json` | **PASS en ambos** (esquema 3.0.0, sanitización/privacidad, guardia 5A) |
| `git diff --check` | sin salida (código 0) |

## 15. Hipótesis medidas (observaciones / resultados / inferencias separadas)

**Observaciones (hechos medidos):**

- 160 solicitudes protegidas, todas indexadas GET con `cover=thumbnail` en la lista; 0 legacy, 0 all-cards, 0 escrituras, 0 violaciones (ambos builds).
- 40 pares de solicitudes `deck-list` simultáneas y 40 de `materias` en 5 repeticiones (1 par solapado por ventana y repetición).
- 291 solicitudes `materia-domain-preview` abortadas sin respuesta (unmatched) en el run productivo; 428 en el de profiling.
- 10 solicitudes `deck-cards` por colección (5 iniciales + 5 calientes), 0 solapamientos.
- Long tasks: 1 (B1/B2), 2 (B3/B5/B6), 3 (B4), 6 (B7) de mediana; total mediana 644 ms en B7.
- `JSON.parse` puro de red: 0,1-0,8 ms de mediana (B1-B7); body 1,8-15 ms; transformación 0-0,35 ms; 0 fallbacks de parseo; equivalencia semántica verificada 100%.
- Commits de React: 10 (B1/B2), 14-15 (B3), 94 (B4), 33/31/30 (B5/B6/B7); separados por bucket first/warm en las aperturas.

**Resultados (conclusiones soportadas por las observaciones):**

- **PERF-NET-001 (invocaciones múltiples de loadDecks/loadMaterias) — CONFIRMADA con evidencia temporal**: pares simultáneos de solicitudes equivalentes en el arranque frío (2), entrada a Library (3) e ida y vuelta Home↔Library (4); a nivel de función, la segunda ejecución de cada par solapa con la primera y la duplicación de `materia-domain-preview` termina en abortos de la primera solicitud de cada par.
- **Compresión navegador/edge — CONFIRMADA**: gzip real (lista ~222-264 KB transferidos de 303.769 B; detalle C100 6.061 B de 48.474 B); cierra el NOT MEASURED de 2A.
- **Hidratación de safeLocalStorage — medida y barata**: 0,3-3,1 ms por hidratación completa de 303 KB y ~6 ms por stringify+setItem; no constituye un cuello de botella en este dataset.
- **Apertura de mazos — medida**: 544/344/696 ms (C20/C100/C500) y 220/291/530 ms en caliente (medianas); DOM lineal exacto (20/100/500 articles); la mejora caliente de C500 en mediana (~24%) es indicativa, no concluyente.
- **Renders/commits de React — medida** en el build de profiling por escenario y repetición (sección 9.7).

**Inferencias (no medidas directamente):**

- El cuello dominante de la apertura C500 está entre red (TTFB ~246-269 ms) y scripting/layout (FunctionCall 540 ms, Layout 324 ms en la ventana completa); la atribución commit-por-commit de la apertura queda para la investigación posterior (el build de profiling ya la permite).
- El coste del ordenamiento en B4 (~1,4 s de mediana) está dominado por la interacción (ActionSheet + estabilidad) y el re-render de la lista completa; no se atribuye un coste puro del algoritmo de ordenamiento (CPU de B4 = NOT MEASURED).

**Hipótesis para fases posteriores (sin implementar):**

- El punto de quiebre con cardinalidad sintética (D100/D500, C1000) y redes degradadas (R1/R2); el enriquecimiento de Home por materia (fan-out de domain-preview con abortos) merece medición dedicada; la separación commit-por-commit de la apertura C500.

## 16. Estado de los cortes

- **Corte 5A**: la ventana de observación continúa activa. Esta fase emitió exclusivamente solicitudes indexadas (`contract=indexed`; `cover=thumbnail` en la lista) y **cero eventos legacy, cero all-cards, cero escrituras y cero violaciones** en ambos builds.
- **Corte 5B**: continúa **BLOCKED**.
- **Migración del Corte 4**: continúa **NOT RUN**.
- Esta fase **no implementa optimizaciones productivas** (confirmado en el diff: sólo instrumentación inerte con bandera + harness).

## 17. Esquema de `raw-results-2b.json` (3.0.0)

Claves raíz: `schemaVersion` (3.0.0), `kind`, `buildMode`/`mode`, `applicationBaseSha`, `harnessSha`, `measuredAtUtc`, `user`, `samplesRequested`, `samplesValid`, `scenarios` (B1/B2 `{samples:[{homeUsableMs, hydration, snapshot}], aggregate}`; B3 `{cold, warm, *Aggregate}` con snapshots por repetición; B4 `{ops, reps}`; B5/B6/B7 `{samples:[{firstOpenMs, warmOpenMs, verifiedElements, cardinalityExact, backUsableMs, memorias, snapshot}], aggregate}`), `storage` (hidratación fría/caliente y escrituras, primera repetición válida), `pageTimings` (nota; detalle por repetición en los snapshots), `longTasks` (`scenarios.*.reps` + agregados), `network` (`bySurface` con muestras y `*Aggregate` sólo correlacionadas + `matched`/`unmatched`, `byCollection` C20/C100/C500 first/warm, `correlation` con grupos redactados, `source`), `guard` (`totalIndexedEvents`, `legacyEvents`, `allCards`, `protectedRequests`, `otherRequests`, `totalRequests`, `writes`, `cdpPreflights`, `violations`, `methods`), `requests` (grupos equivalentes con URL redactada `:id` y correlación por muestra), `memory`, `react` (sólo profiling: `aliasVerified`, `scenarios.*.reps` con renders/loaders/commits), `cpuAttribution` (trazas CDP primera repetición; B4 NOT MEASURED explícito), `dom` (`summary`; detalle por repetición en los snapshots), `samplesCompleted`, `samplesFailed`, `errors`, `environment`, `limitations`, `notMeasured` (lista explícita), `status`. Todos los valores persistidos pasan `sanitizeResults` y la validación post-run (`validate-final-results.mjs`).

## 18. Siguiente investigación sugerida (sin implementar)

1. Confirmar el punto de quiebre con cardinalidad sintética (D100/D500, C1000) y perfiles de red R1/R2 sobre el mismo harness.
2. Separación commit-por-commit de la apertura C500 (el build de profiling ya la permite: commits con bucket `first-open`/`warm-open`).
3. Medición dedicada del fan-out de `materia-domain-preview` (duplicación con abortos observada: 291/428 solicitudes abortadas por run).
4. Entorno M1/M2 (móvil) cuando exista evidencia física autorizada; no sustituir por emulación.
5. Validar la reutilización de la respuesta indexada al regresar de un mazo con caché HTTP caliente real.
6. El explain del aggregate completo de Library sigue NOT MEASURED (2A) y no forma parte de 2B.

## 19. Veredicto

**PASS PARCIAL** — todos los escenarios centrales se ejecutaron con 5 repeticiones válidas en el build productivo real y en el build de profiling, desde el Commit A con árbol limpio y con `harnessSha`/`applicationBaseSha` correctos y distintos. La correlación CDP es uno a uno (sin reutilización de entradas), los agregados de red no duplican bytes ni tiempos, el JSON persiste por escenario y repetición las mediciones separadas de body, `JSON.parse` puro y transformación, las tareas largas, el DOM, la memoria y el perfil de React de B1–B7, y las colecciones C20/C100/C500 son distinguibles (inicial/caliente). La guardia 5A registra únicamente solicitudes indexadas GET (0 legacy, 0 all-cards, 0 escrituras) y no existe filtración de datos sensibles (validación automática PASS). Elementos legítimamente NOT MEASURED, enumerados en `notMeasured`: **p95** (regla de las 5 muestras) y **cpuAttribution.B4** (traza CDP sin eventos de interés; no se infiere de la duración). No hay elementos BLOCKED ni FAIL, cero errores en ambos runs y **ninguna optimización implementada**.

## 20. Flujo de commits (Commit A → corrección del validador → Commit B)

El flujo de dos commits separa el código del harness de los artefactos:

- **Commit A** (`harnessSha = 611ffb0…`): runner, instrumentación de la página, utilidades puras, pruebas deterministas, validador y correcciones de integridad de la medición. Es el commit desde el que se ejecutaron ambos runs finales con el árbol limpio; cualquier cambio en runner/instrumentación/serializador/esquema posterior invalidaría los resultados.
- **Corrección post-run del validador** (commit separado, tras Commit A): `validate-final-results.mjs` acepta las subcadenas de 24 hex de los SHAs públicos y el identificador `kind`, sin aflojar el resto de la sanitización. Es una herramienta de verificación, no parte de la medición: **no altera las muestras persistidas** ni cambia el `harnessSha`, y se documenta aquí para mantener la trazabilidad.
- **Commit B** (último commit): contiene **únicamente** resultados sanitizados y documentación — `raw-results-2b.json` y `raw-results-2b-profiling.json` (esquema 3.0.0), este informe y las actualizaciones factuales de los README. No contiene cambios de producto ni de la instrumentación de medición; su hash y la URL del PR #12 se registran en el cuerpo del PR.
