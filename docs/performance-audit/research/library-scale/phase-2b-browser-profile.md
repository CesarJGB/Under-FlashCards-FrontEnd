# Fase 2B — Perfil real de navegador de Library y apertura de mazos

## 1. Estado del repositorio

| Dato | Resultado |
|---|---|
| Rama | `perf/phase-2b-library-browser-profile` (creada desde `origin/main`) |
| HEAD base esperado | `ecb025914435fa4659200c9890a0e4ffea916175` |
| `origin/main` tras `git fetch origin` | `ecb025914435fa4659200c9890a0e4ffea916175` |
| Drift | **Ninguno**: `origin/main == HEAD esperado` |
| HEAD de aplicación medido | `ecb025914435fa4659200c9890a0e4ffea916175` (el contenedor backend productivo usa exactamente esta imagen) |
| HEAD del harness | `ecb025914435fa4659200c9890a0e4ffea916175` |
| Estado inicial del árbol | Instrumentación del corte sin commitear (sesión previa interrumpida), revisada y validada en este corte; archivos de sesión ajenos sin seguimiento (`session-ses_*.md`), conservados |
| Corte 5A | En observación (ventana de 14 días continúa activa) |
| Corte 5B | **BLOCKED** |
| Migración del Corte 4 | **NOT RUN** |

Las entradas no rastreadas ajenas no se modificaron y no entran en ningún commit.

## 2. Objetivo y alcance

**Objetivo**: instrumentar y medir el comportamiento real del frontend en Chromium (build de producción de Vite + navegador controlado con Playwright) contra los datos reales ya caracterizados en la Fase 2A, atribuyendo por separado red, recepción del cuerpo, `JSON.parse`, hidratación desde `safeLocalStorage`, procesamiento JavaScript, renders y commits de React, layout, paint, tareas largas, memoria y crecimiento del DOM, además del tiempo hasta que Library y los mazos quedan realmente utilizables. Fase exclusivamente de medición e investigación: **no implementa optimizaciones, correcciones de rendimiento, deduplicación de loaders, memoización nueva, virtualización, paginación, índices, cambios de API ni modificaciones de UX**.

**Alcance autorizado e implementado**:

- Instrumentación mínima con bandera en código productivo: `frontend/src/lib/perfLibraryProfile.js` (inerte; eliminada por tree-shaking del build normal), contadores de renders e invocaciones de `loadDecks`/`loadMaterias` en `App.jsx`, `HomeSection.jsx`, `LibrarySection.jsx`, `DeckInterior.jsx`, `FlashcardCollection.jsx` y `FlashcardGrid.jsx`, y export nombrado `DashboardScreen` desde `App.jsx` para montar la superficie real.
- Harness de navegador: `frontend/tests/performance/library-browser/` (`index.html`, `main.jsx`, runner `run-browser-profile.mjs`, utilidades puras `libraryBrowserProfileUtils.mjs`, pruebas deterministas `library-browser-profile.test.js`).
- Scripts npm `test:library-browser` y `perf:library-browser` (frontend).
- Ejecución real contra el backend productivo autorizado: **5 repeticiones válidas por escenario en el build productivo** y **5 en el build de profiling** (renders/commits; nunca mezcladas).
- Resultados crudos sanitizados: `raw-results-2b.json` (build productivo) y `raw-results-2b-profiling.json` (build de profiling).
- Este informe y actualizaciones factuales mínimas de `README.md` (carpeta), `docs/performance-audit/README.md` y `docs/performance-audit/prioritized-roadmap.md`.

**Fuera de alcance (no implementado)**: deduplicación de `loadDecks`/`loadMaterias`, cambios en dependencias de efectos, cancelación/coordinación nueva de solicitudes, caché compartida, React Query/SWR u otras dependencias, memoización nueva, virtualización, paginación, lazy loading, cambios de payload, índices MongoDB, Server-Timing, cambios de compresión, thumbnails/migraciones de imágenes, eliminación de `?t=`, modificación de `safeLocalStorage`, corrección de filtros O(F×D), dataset sintético D100/D500, C1000, variantes I0–I3, sesiones all-cards, editor/guardado/review, pruebas físicas de iPhone y recomendaciones definitivas de arquitectura.

## 3. Entorno de medición

| Dato | Resultado |
|---|---|
| Build | `vite build` productivo servido con `vite preview` en `localhost:3000` (sin servidor de desarrollo, sin React Strict Mode) |
| Navegador | Chromium headless real de Playwright 1.62.1 (`chromium-1234`) |
| Versión | `151.0.7922.34` (`raw-results-2b.json` → `environment.chromiumVersion`) |
| Viewport | 1280×900, DPR 1, `reducedMotion: 'reduce'` |
| Throttling CPU | ninguno (baseline principal) |
| Memoria | `--enable-precise-memory-info` (`performance.memory` real; no se usan placeholders) |
| Caché HTTP | controlada por contexto: contexto nuevo por escenario; arranque caliente sólo con siembra explícita de `localStorage` |
| Ejecución | contenedor `mcr.microsoft.com/playwright:v1.62.1-jammy` (la máquina host carece de las librerías de sistema del binario; el contenedor es de investigación y no modifica el repo salvo lo que el runner escribe con `--out`) |
| Node/SO/CPU/RAM | `environment.node`, `environment.platform`, `environment.cpuModel`, `environment.logicalCpuCount`, `environment.totalMemoryBytes` |
| Backend | `production-backend-A` (dominio real sólo en memoria/entorno del proceso; nunca persistido) |
| Usuario | `real-user-A` (ID real sólo en variable de entorno del proceso; nunca persistido) |

El harness monta el `DashboardScreen` real de producción directamente (sin el overlay artificial de 2.500 ms de `FlashcardsApp`, declarado en las limitaciones).

## 4. Metodología

1. Verificación de base: `git fetch origin`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git rev-parse origin/main` (sin drift frente a `ecb0259`).
2. Lectura completa de la documentación obligatoria (`AGENTS.md`, skill `implement-cut`, `docs/performance-audit/`, reporte 2A y `raw-results.json`) y de los flujos productivos relevantes (`App.jsx`, `HomeSection`, `LibrarySection`, `useLibraryState`, `DeckInterior`, `FlashcardCollection`, `FlashcardGrid`, `safeLocalStorage`).
3. Revisión del harness 2B ya iniciado en el árbol (sesión previa interrumpida) y corrección de defectos reales detectados, cada uno verificado con diagnóstico de página y/o pruebas deterministas:
   - **Marcadores de nivel sensibles a mayúsculas CSS**: `innerText` devuelve el texto renderizado y los títulos con `text-transform: uppercase` (`TUS MATERIAS`, `TODOS LOS MAZOS DE ESTE TEMA`, `MAZOS DEL SUBTEMA`) hacían fallar `whenLibraryLevel` (causa de los timeouts de 60 s del smoke previo en B4/B5/B6/B7).
   - **Navegación para mazos sin `materiaId`**: la búsqueda global de la app no incluye mazos sin clasificar; C100-real y C500-real se abren directamente en la raíz.
   - **Emparejado de título exacto**: `findDeckCard`/`findDeckSearchResult` casaban por substring ("test" casaba con "test animaciones") y podían abrir el mazo equivocado; ahora el `<p>` del título debe coincidir por completo y el conteo de tarjetas debe casar.
   - **Etiqueta de ordenamiento**: "Más antiguos" (el harness usaba "Más antiguas", inexistente en `LibraryToolbar`).
   - **Conteo de materias**: expresión regular insensible a mayúsculas para `TUS MATERIAS`.
   - **Memoria precisa**: `--enable-precise-memory-info` para `performance.memory` real en headless (sin él Chromium devuelve un placeholder plano de 10 MB).
   - **Red real**: sin `Timing-Allow-Origin` el Resource Timing cross-origin llega enmascarado (TTFB/bytes = 0); se instrumentó el dominio **CDP Network** (`responseReceived`/`dataReceived`/`loadingFinished`) para TTFB, descarga, `transferSize`, `encodedBodySize`, `decodedBodySize` y `Content-Encoding` reales.
   - **Sanitización endurecida**: el serializador anterior sólo detectaba IDs de 24 hex en cadenas aisladas; ahora rechaza cualquier 24-hex en cualquier posición (incluso incrustado en URLs), salvo aliases o tokens explícitamente permitidos (SHAs públicos). Un artefacto de la sesión previa que contenía IDs reales incrustados en URLs fue detectado por este endurecimiento y no forma parte de esta fase.
   - **Redacción de dumps de diagnóstico** (nombres reales → `<nombre>`, origen del backend → `<backend-url>`, IDs reales → `<id>`) antes de persistir errores.
   - **Agregados serializables**: los agregados de B1/B2/B5/B6/B7 viven en objetos (`{ samples, aggregate }`), no en arrays (las propiedades extra de arrays no sobreviven a JSON).
   - **Hitos de entrada a Library** (interacción/contenido/estable) persistidos por separado.
   - **Conteo de crashes del navegador**: sólo se cuentan desconexiones no intencionales.
4. Verificación determinista del harness (40 pruebas, sección 14) y suites relacionadas.
5. Ejecución real: 5 repeticiones válidas por escenario en build productivo y 5 en build de profiling.
6. Serialización segura: `sanitizeResults` con aliases y redacción del origen real; el runner se niega a escribir si la validación falla (verificado durante la ejecución: un intento de profiling previo fue rechazado por la clave `name` en `loaderInvocations`, corregida a `loader`).
7. Comparación prudente con 2A (sección 13): las cifras de 2A se citan como referencia de backend/API, nunca como medidas por 2B.

## 5. Instrumentación productiva (mínima y con bandera)

`frontend/src/lib/perfLibraryProfile.js` expone un singleton que sólo se activa cuando el build define `VITE_PERF_LIBRARY_PROFILE === '1'` (el build de profiling del harness la define; el build productivo normal no). Desactivada, todas las funciones son no-ops sin estado, sin User Timing y sin lecturas de reloj: no cambian estado, solicitudes, orden visual ni UX. Verificado además por eliminación: **el build productivo normal no contiene ninguna referencia a `perfLibrary`** (`grep -r perfLibrary dist/assets/` → sin coincidencias; el módulo se elimina por tree-shaking).

Puntos instrumentados en código productivo:

- `renderCount(name)` al inicio del cuerpo de `DashboardScreen`, `HomeSection`, `LibrarySection`, `DeckInterior`, `FlashcardCollection` y `FlashcardGrid`.
- `beginLoader('loadDecks' | 'loadMaterias', { showSpinner, signal })` al inicio de ambos loaders y `end('ok' | 'error')` en su terminación, con detección de solapamiento de ejecuciones equivalentes.
- Export nombrado `export { DashboardScreen }` al final de `App.jsx` (el entry productivo sigue consumiendo el default export).

No altera solicitudes, respuestas, estado, renders ni UX; no añade dependencias; no introduce User Timing en producción.

## 6. Harness y guardia del Corte 5A

El harness monta el `DashboardScreen` real y mide desde la página (patch de `fetch` observacional, `PerformanceObserver` de long tasks/layout-shift/paint/measure, conteo de DOM, `performance.memory`, `Profiler` en el build de profiling) y desde el runner (CDP tracing de scripting/layout/paint/raster/GC, CDP Network, `Performance.getMetrics`, `HeapProfiler.collectGarbage` diagnóstico).

La guardia `assertRequestGuard` (utilidad pura, probada) inspecciona cada solicitud antes de continuarla y **falla inmediatamente** (aborta la solicitud, marca el reporte como `FAIL` y detiene las siguientes repeticiones) si:

- una superficie protegida (`deck-list`, `deck-cards`, `all-cards`) no lleva `contract=indexed`;
- la lista de mazos no lleva `cover=thumbnail`;
- aparece una solicitud legacy (contract ausente o distinto de `indexed`);
- aparece un método distinto de `GET`.

Las preflights `OPTIONS` del navegador se identifican aparte y no se cuentan. Las superficies que no participan en el contrato de imágenes (materias, temas, subtemas, preferencias, balance, health, domain-preview) se clasifican como `other` y **nunca** como legacy.

## 7. Datos reales, privacidad y credenciales

- Identificadores reales (usuario y mazos) recibidos únicamente por variable de entorno (`PERF_TEST_USER_ID`) o seleccionados en memoria desde la respuesta indexada de Library por conteos exactos; nunca hardcodeados ni persistidos.
- El usuario real se verificó contra la base productiva con consultas read-only de conteo (29 mazos propios / 5.879 tarjetas por `userId`, idéntico al inventario de 2A).
- No se persiste ni muestra: IDs reales, nombres de mazos/materias/temas/subtemas, preguntas/respuestas, Data URLs, cuerpos completos, tokens/cookies/credenciales, la URL real del backend ni headers de autenticación.
- Los resultados persistidos usan únicamente `real-user-A`, `C20-real`, `C100-real`, `C500-real`, `production-backend-A` y el patrón `<backend-url>`.
- La sanitización (`sanitizeResults`) rechaza claves de contenido, tokens (`data:`), cadenas largas sin alias y cualquier 24-hex sin alias o sin permiso explícito (sólo los SHAs públicos del informe); el runner escribe el archivo únicamente si la validación completa pasa. Las pruebas demuestran que un ID incrustado en una URL se rechaza.
- Artefactos temporales con datos reales (trazas CDP crudas en memoria, logs del contenedor de ejecución) viven fuera del repositorio (`/tmp`) y no entran en Git. Un artefacto del smoke previo de la sesión anterior con IDs incrustados fue eliminado del árbol y no se publica.

## 8. Escenarios ejecutados y matriz

Mínimo de **cinco repeticiones válidas por escenario** en el build productivo; con cinco muestras se reporta mínimo, mediana, máximo y muestras correctas/fallidas; **p95 = NOT MEASURED** (no se calcula un p95 engañoso con cinco muestras).

| Escenario | Descripción | Muestras | Estado |
|---|---|---|---|
| B1 | Arranque frío: contexto nuevo, sin caché `decks_<userId>` ni `materias_<userId>`, dashboard real hasta Home estable; invocaciones de loaders y solicitudes efectivas | 5 | 5/5 OK |
| B2 | Arranque caliente: siembra de `localStorage` con los datos reales capturados en B1; `getItem`/`JSON.parse`/sanitización/hidratación completas y revalidación de red real | 5 | 5/5 OK |
| B3 | Entrada a Library desde Home (interacción real): acción→interacción habilitada, →contenido visible, →estado estable ("Library useful"); fría y caliente; sin `networkidle` como definición de utilizable | 5 frías + 5 calientes | 5/5 OK |
| B4 | Procesamiento de Library sobre los 29 mazos: filtro por path académico, búsquedas, 5 ordenamientos, conteos y enriquecimiento de Home | 5 | 15 ops × 5 ejecuciones, 0 fallos |
| B5 | Apertura de C20-real (exactamente 20 tarjetas): primera apertura y reapertura caliente; cardinalidad verificada | 5 | 5/5 OK |
| B6 | Apertura de C100-real (exactamente 100 tarjetas) | 5 | 5/5 OK |
| B7 | Apertura de C500-real (exactamente 500 tarjetas) | 5 | 5/5 OK |

Los mazos se seleccionan en memoria con la **misma regla que 2A** (radio relativo 25 %, desempate por id lexicográfico; distancia 0 requerida, de lo contrario el escenario queda BLOCKED, nunca aproximado). La cardinalidad se verifica doble: `article` montados en el DOM (`whenDeckUsable`) y `cards.length` de la respuesta indexada capturada (`cardinalityExact`).

## 9. Resultados medidos principales (build productivo)

### 9.1 Tiempo hasta utilizable

| Escenario | Muestras | Mín (ms) | Mediana (ms) | Máx (ms) | p95 |
|---|---:|---:|---:|---:|---|
| B1 Home útil (frío) | 5 | 824 | 887 | 1.237 | NOT MEASURED |
| B2 Home útil (caliente) | 5 | 615 | 740 | 849 | NOT MEASURED |
| B3 Library útil — entrada fría (estable) | 5 | 579 | 674 | 1.041 | NOT MEASURED |
| B3 Library útil — entrada caliente (estable) | 5 | 639 | 743 | 1.041 | NOT MEASURED |
| B3 entrada fría — interacción habilitada | 5 | 512 | 614 | 973 | NOT MEASURED |
| B3 entrada fría — contenido visible | 5 | 546 | 641 | 1.008 | NOT MEASURED |
| B3 entrada caliente — interacción habilitada | 5 | 591 | 686 | 988 | NOT MEASURED |
| B3 entrada caliente — contenido visible | 5 | 606 | 710 | 1.007 | NOT MEASURED |

### 9.2 C20/C100/C500

| Caso | Apertura inicial (ms) min/med/max | Reapertura caliente (ms) min/med/max | Elementos verificados | Cardinalidad exacta | Muestras |
|---|---:|---:|---:|---:|---|
| C20-real | 497 / 560 / 764 | 230 / 242 / 276 | 20 | sí (5/5) | 5 |
| C100-real | 351 / 453 / 549 | 292 / 409 / 542 | 100 | sí (5/5) | 5 |
| C500-real | 566 / 679 / 1.070 | 540 / 683 / 913 | 500 | sí (5/5) | 5 |

`backUsableMs` (regreso a Library tras cerrar el mazo) y `firstCollectionMs` (hasta tarjetas montadas) están en `raw-results-2b.json`. La reapertura caliente es ~2,3× más rápida (C20) y ~1,4× (C500) porque el contenido del nivel ya está montado y la caché del contexto sirve las respuestas.

### 9.3 Loaders e invocaciones

Las **solicitudes efectivas** de los loaders (build productivo, todas GET con el contrato indexado): `deck-list` 130 solicitudes (26 por repetición; 2 en el arranque frío del dashboard, 3 al entrar a Library, 4 en ida y vuelta Home↔Library) y `materias` 130 (misma distribución). Los **solapamientos** de ejecuciones equivalentes: 40 pares simultáneos de `deck-list` y 40 de `materias` en las 5 repeticiones (≈8 pares por repetición, uno por carga de página), **confirmando la duplicación estática PERF-NET-001 con evidencia temporal**: varias invocaciones del mismo loader se solapan en la misma ventana (p. ej. App + HomeSection al montar, LibrarySection al entrar). Las **invocaciones de función** de `loadDecks`/`loadMaterias` (conteo, inicio/fin, resultado, abortos, solapamiento) se registran en el build de profiling (sección 9.7) porque la instrumentación con bandera sólo está activa allí; las solicitudes que producen se miden en ambos builds.

### 9.4 Solicitudes equivalentes y guardia del Corte 5A

- **Eventos indexados**: 160 solicitudes protegidas, todas `contract=indexed` (lista de mazos con `cover=thumbnail`).
- **Eventos legacy: 0.**
- **Métodos**: sólo `GET` (las preflights OPTIONS se identifican aparte y no se cuentan).
- **Violaciones de guardia**: 0 (el runner habría abortado y marcado FAIL).
- Grupos equivalentes sin duplicación de `deck-cards`: 10 por mazo (5 aperturas + 5 reaperturas), 0 solapamientos.
- `preferences` (85 solicitudes, 40 pares solapados) y `balance` (40) se disparan por montajes de Home/Library; `materia-domain-preview` 960 solicitudes (≈192 por repetición; el enriquecimiento de Home las emite por materia). No participan en el contrato de imágenes; se identifican aparte (nunca legacy).
- `temas`/`subtemas` sólo se solicitan al navegar por el path académico (10 cada una; 2 por repetición).

### 9.5 Almacenamiento (`safeLocalStorage`)

Hidratación medida en página con las funciones productivas (`getItem` + `JSON.parse` + `sanitizeDeckSummaries`), 5 muestras por clave:

| Operación | Tamaño | Muestras | Total min/med/max (ms) |
|---|---:|---:|---|
| `decks_<id>` frío (getItem+parse+sanitize) | 303.767 chars / 29 mazos | 5 | 0,4 / 0,5 / 2,8 |
| `materias_<id>` frío | 7.203 chars / 13 materias | 5 | 0,0 / 0,0 / 0,1 |
| `decks_<id>` caliente (siembra B1) | 303.767 chars | 5 | 0,1 / 0,3 / 0,4 |
| `materias_<id>` caliente | 7.203 chars | 5 | 0,0 / 0,0 / 0,1 |
| stringify + setItem (`decks_<id>`) | 303.767 chars | 5 | ≈2,6 ms total (stringify 0,8 + setItem 1,5) |
| stringify + setItem (`materias_<id>`) | 7.203 chars | 5 | ≈0,1 ms total |

`JSON.parse` individual: 0,0–2,7 ms (una muestra de 2,7 ms en frío; el resto ≤0,6 ms); sanitización de summaries: 0,0–0,1 ms; ausencias/errores: ninguno (todas `status: ok`). Los loaders persisten cada respuesta (`setJSON`) sin optimizaciones.

### 9.6 Red, parseo y render por superficie

Metadatos reales vía **CDP Network** (el Resource Timing cross-origin está enmascarado porque el backend no envía `Timing-Allow-Origin`); duraciones del runner (reloj propio). Medianas:

| Superficie | N | TTFB (ms) | Descarga (ms) | Total (ms) | Transferidos (B) | Decodificados (B) | Content-Encoding |
|---|---:|---:|---:|---:|---:|---:|---|
| deck-list | 130 | 409,0 | 4,7 | 617 | 264.333 | 303.769 | gzip |
| materias | 130 | 76,1 | 0 | 185,5 | 1.403 | 7.214 | gzip |
| deck-cards (C20/C100/C500) | 30 | 147,2 | 0 | 179 | 6.061 (mediana) | 48.474 (mediana) | gzip |
| temas | 10 | 136,7 | 0 | 147,5 | 605,5 | 1.130,5 | mixto |
| subtemas | 10 | 68,5 | 0 | 78,5 | 2 | 2 | ausente |
| preferences | 85 | 96,9 | 0 | 215 | 0 (caché de contexto) | 487 | — |
| balance | 40 | 211,4 | 0 | 312 | 0 (caché de contexto) | 561 | — |
| materia-domain-preview | 960 | 93,9 | 0 | 136 | 0 (caché de contexto) | 194 | — |

El tamaño decodificado de `deck-cards` (48.474 B de mediana) coincide con el de C100-real de 2A (48.474 B), y la lista (303.769 B) con los 303.769 B de 2A: **el contrato indexado es estable y la compresión gzip del edge reduce a ~264 KB (87 %) la lista y a 6.061 B (12,5 %) el detalle C100** — la compresión navegador/edge que 2A dejó NOT MEASURED queda ahora medida. `JSON.parse` del lado del cliente: 0,1–1 ms (tramos medidos en la hidratación; sección 9.5). Las respuestas de caché del contexto muestran 0 bytes transferidos (servidas de la caché HTTP del contexto); no son ceros medidos, están identificadas por su origen.

### 9.7 React (build de profiling)

Construcción de profiling de React (`react-dom/profiling`; la única forma de que `Profiler.onRender` se dispare en un build de producción; el build productivo normal no contiene Profiler y sus tiempos no se mezclan). Primera repetición válida:

- **Contadores de renders** (`renderCount`): `DashboardScreen` 6, `HomeSection` 10 (Library no está montada en el tab Home).
- **Invocaciones de loaders** (4 en B1): dos ejecuciones de `loadDecks` y dos de `loadMaterias`; la segunda de cada par (`hasSignal: true`, procedente del efecto de `DashboardScreen` con `AbortController`) **solapa** con la primera (`overlapped: true`, procedente del montaje de `HomeSection`). Todas terminan `ok`, ninguna abortada; duraciones: `loadDecks` 314,8→1.063,7 ms y 321,8→1.008,8 ms; `loadMaterias` 317,9→530,5 ms y 322,2→569,3 ms. **Confirma a nivel de invocación la duplicación de PERF-NET-001**: el arranque frío emite la lista de mazos y las materias dos veces en paralelo.
- **Commits** (B1, 10 commits): 1 `mount` (11,5 ms de `actualDuration`), 1 `nested-update`, 8 `update`; `actualDuration` total 33,4 ms, `baseDuration` total 29,0 ms; `startTime`/`commitTime` registrados por commit en `raw-results-2b-profiling.json`.

Los `renderCounts`/`loaderInvocations` de los demás escenarios (B2–B7) están en el JSON de profiling por repetición (sólo la primera repetición se resume en la sección `react`; los snapshots por escenario residen en el archivo).

### 9.8 CPU del navegador (scripting/layout/paint/long tasks/GC)

Atribución por trazas CDP (`devtools.timeline`, `blink`, `cc`, GC V8), primera repetición válida; categorías ausentes → NOT MEASURED, no cero:

| Escenario | FunctionCall | Layout | UpdateLayoutTree | Paint | RasterTask | GC (V8.GC_*) |
|---|---:|---:|---:|---:|---:|---|
| B1 (Home frío) | 170,7 ms (52) | 70,0 ms (17) | 25,8 ms (48) | 44,5 ms (70) | 167,5 ms (118) | scavenger 5,3 ms |
| B3 frío (entrada Library) | 251,1 ms (144) | 106,0 ms (19) | 46,0 ms (60) | 33,4 ms (86) | 202,4 ms (185) | scavenger 23,5 ms |
| B3 caliente | 231,1 ms (147) | 81,8 ms (20) | 43,1 ms (66) | 40,3 ms (93) | 222,7 ms (195) | scavenger 12,1 ms |
| C20-real | 411,4 ms (520) | 143,5 ms (46) | 95,9 ms (172) | 66,4 ms (252) | 308,9 ms (519) | mark-compactor 24,2 ms |
| C100-real | 373,6 ms (482) | 121,9 ms (39) | 95,4 ms (154) | 71,1 ms (311) | 352,0 ms (529) | mark-compactor 51,8 ms |
| C500-real | 487,8 ms (482) | 257,9 ms (38) | 149,4 ms (135) | 56,4 ms (240) | 278,1 ms (469) | mark-compactor 91,4 ms |

Long tasks >50 ms: capturadas por PerformanceObserver en página (arrays en `scenarios.*.snapshot.longTasks` de la primera repetición; no agregadas al resumen). La traza de B4 resultó vacía de eventos de interés en la primera repetición (anomalía de captura CDP; se registra como NOT MEASURED para la atribución CPU de B4; las duraciones de las operaciones de B4 sí están medidas). El crecimiento scripting/layout/paint C20→C100→C500 es marcado en Layout (143,5 → 121,9 → 257,9 ms) y en el total de eventos de render.

### 9.9 Memoria

`performance.memory` (API Chromium, `--enable-precise-memory-info`), primera repetición válida; el `JSHeapUsedSize` de CDP se registra aparte (API distinta, no comparable):

| Punto | usedJSHeapSize |
|---|---:|
| antes de entrar a Library (B3 frío) | 4,9 MB |
| después de Library utilizable (B3 frío) | 7,8 MB (+2,9 MB) |
| antes de entrar a Library (B3 caliente) | 6,5 MB |
| después de Library utilizable (B3 caliente) | 9,4 MB (+2,9 MB) |
| después del procesamiento B4 (filtros/búsquedas/ordenamientos) | 15,3 MB |
| después de abrir C20-real | 10,7 MB (tras GC diagnóstico: 6,1 MB) |
| después de abrir C100-real | 11,0 MB (tras GC diagnóstico: 6,1 MB) |
| después de abrir C500-real | 8,4 MB (tras GC diagnóstico: 7,8 MB) |

Las lecturas tras abrir cada mazo son muestras únicas por escenario (página fresca por escenario) y dependen del momento de GC; el GC explícito por CDP se etiqueta como medición diagnóstica. No se comparan valores de APIs distintas (los `jsHeapSizeLimit` y las métricas CDP se reportan por separado).

### 9.10 DOM

Primera repetición válida:

| Superficie | Nodos totales | Nodos de la superficie | `<article>` | Botones | Imágenes | Fondos inline |
|---|---:|---:|---:|---:|---:|---|
| Home (B1) | 191 | — | 0 | 20 | 0 | — |
| Library raíz (B3 frío) | 569 | 492 | 0 | 51 | 0 | 2 |
| C20-real (grid) | 367 | 311 | 20 | — | — | 0 |
| C100-real (grid) | 1.567 | 1.511 | 100 | — | — | 0 |
| C500-real (grid) | 7.567 | 7.511 | 500 | — | — | 0 |

Delta C20→C100→C500: 311 → 1.511 → 7.511 nodos de mazo (×4,9 y ×5,0; exactamente 20/100/500 `<article>`). Los mazos seleccionados no tienen fondos (0 imágenes inline); la superficie de tarjetas es texto/estilos puro.

## 10. Errores y muestras descartadas

- Build productivo: 0 errores, 0 muestras fallidas, 5/5 repeticiones válidas.
- Build de profiling: un intento previo fue rechazado por la serialización segura (clave `name` en `loaderInvocations`, colisión con claves de contenido); corregido (campo `loader`) y relanzado.
- Smoke inicial de la sesión previa (1 muestra): B4/B5/B6/B7 fallaban por los defectos de marcadores/título/substring ya corregidos; sus resultados no se publican (y el artefacto con IDs incrustados se eliminó del árbol).
- B4 CPU: traza CDP vacía de eventos de interés en la primera repetición (NOT MEASURED para esa atribución).

## 11. Limitaciones

- Headless Chromium en el contenedor de investigación; no equivale a Safari/GPU/compositor de dispositivo físico (prohibido presentarlo como tal).
- El overlay artificial de 2.500 ms de `FlashcardsApp` no participa: se monta `DashboardScreen` real sin el retardo configurado.
- En el build productivo no hay Profiler: renders/commits provienen exclusivamente del build de profiling y nunca se mezclan.
- Con 5 muestras, p95 = NOT MEASURED (regla del encargo).
- `performance.memory` mide el heap JS del renderer; no es comparable con `JSHeapUsedSize` de CDP (se etiquetan por separado).
- La caché HTTP no se reutiliza entre escenarios: el "caliente" es una siembra de `localStorage`, no una caché HTTP caliente (los contextos son nuevos; las respuestas de caché intradocumento se identifican por transferSize 0).
- Los tiempos de las operaciones de B4 incluyen la interacción y la espera de estabilidad (2 rAF), no sólo el trabajo síncrono del filtro/orden.
- La traza CDP de B4 no produjo eventos de interés en la primera repetición (NOT MEASURED).
- Los tiempos de red se miden con CDP sobre el backend productivo desde la máquina local (R0); no representan redes degradadas (R1/R2 quedan para investigación posterior).

## 12. Resultados del build de profiling (React)

Build de profiling de React (`react-dom/profiling`, sin Strict Mode), 5 repeticiones válidas (PASS; 160 eventos indexados, 0 legacy, 0 violaciones; `raw-results-2b-profiling.json`):

- **Renders (B1, primera repetición)**: `DashboardScreen` 6, `HomeSection` 10; **commits: 10** (1 mount, 1 nested-update, 8 update) con `actualDuration` total 33,4 ms y mount de 11,5 ms.
- **Invocaciones de loaders**: 4 en B1 (2 `loadDecks` + 2 `loadMaterias`), con la segunda de cada par solapada con la primera (duplicación de PERF-NET-001 confirmada a nivel de función); todas `ok`, 0 abortos.
- Los tiempos de escenarios del profiling (B5 644/245 ms, B6 348/321 ms, B7 690/527 ms) son coherentes con los del build productivo (sección 9.2); el Profiler añade ~50–150 ms en la apertura C500 por la instrumentación de profiling. **No se mezclan duraciones entre builds.**

## 13. Comparación prudente con la Fase 2A

Las cifras de 2A se citan como referencia de backend/API medida con un cliente Node; **no se copian como medidas por 2B**. 2B mide el navegador:

| Dato | 2A (cliente Node) | 2B (navegador) |
|---|---|---|
| Lista de mazos wire bytes | 303.769 B (sin compresión anunciada) | 303.769 B decodificados; 264.333 B transferidos (gzip real del edge) |
| Lista latencia | 235,86 ms mediana (total HTTP) | 607 ms mediana (duración completa incl. red + parseo/estado), TTFB 532,7 ms |
| C100-real detalle | 48.474 B / 148,08 ms | 48.474 B decodificados / 6.061 B gzip / TTFB mediana 155,7 ms (deck-cards global) |
| Parseo | <1,2 ms (Node) | 0,1–0,5 ms por hidratación en navegador (sección 9.5) |
| Render/storage/DOM/memoria/commits | NOT MEASURED | Medidos (secciones 9.5–9.10) |

La comparación es informativa y no directa: distinta herramienta, distinto protocolo de red y distinto punto de medición (el navegador añade parseo, estado, renders y paint que el cliente Node no ejecuta).

## 14. Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `node --test tests/performance/library-browser/library-browser-profile.test.js` (desde `frontend/`) | 40/40 |
| `npm run test:library-browser` | 40/40 |
| `npm run test:image-delivery` | 74/74 |
| `cd backend && node --test test/libraryScaleBaseline.test.js` | 54/54 |
| `npm run build` (frontend) | correcto (13,45 s; advertencias de chunk normales) |
| Build productivo del harness + Chromium (5 muestras/escenario) | **PASS**, 5/5, 160 eventos indexados, 0 legacy, 0 violaciones |
| Build de profiling del harness (5 muestras/escenario) | PASS (resultados en `raw-results-2b-profiling.json`) |
| `grep -r perfLibrary dist/assets/` (build normal) | sin coincidencias (instrumentación ausente) |
| `git diff --check` | sin salida (código 0) |

## 15. Hipótesis medidas

- **PERF-NET-001 (invocaciones múltiples de loadDecks/loadMaterias)** — **CONFIRMADA con evidencia temporal**: 2 solicitudes de `deck-list` en el arranque frío (App + HomeSection), 3 al entrar a Library, 4 con regreso Home↔Library; 40 pares de solicitudes equivalentes simultáneas de `deck-list` y 40 de `materias` en 5 repeticiones. El solapamiento es real y simultáneo; el coste duplicado de red en bytes se cuantifica (≈264 KB gzip por par adicional en frío).
- **Filtros/búsquedas/ordenamientos/conteos (PERF-LIB-002, PERF-LIB-001)** — **medidos, impacto acotado en este dataset**: búsqueda 109–122 ms, path-filter 104–291 ms, conteos 28–765 ms, ordenamientos ≈1,36 s (incluyen interacción del ActionSheet + estabilidad). Con 29 mazos no se observa degradación grave; el punto de quiebre con D100/D500 sintéticos queda fuera de alcance.
- **Hidratación de safeLocalStorage** — **medida y barata**: ≈0,5 ms por hidratación completa de 303 KB y ≈3 ms por stringify+setItem; no constituye un cuello de botella en este dataset.
- **Apertura de mazos (PERF-DECK-001)** — **medida**: 560/453/679 ms (C20/C100/C500) y 242/409/683 ms en caliente; el crecimiento DOM es lineal exacto (20/100/500 articles) y la reapertura caliente es ~2,3× más rápida (C20).
- **Compresión navegador/edge** — **CONFIRMADA**: gzip real (lista 87 %, detalle C100 12,5 % de los bytes decodificados); cierra el NOT MEASURED de 2A.
- **Duplicación de `deck-cards`** — **no observada**: 10 solicitudes por mazo (5 aperturas + 5 reaperturas), cero solapamientos; la duplicación estática de `all-cards` de sesiones (PERF-DECK-002) queda fuera de alcance (no se abren sesiones).
- **Renders/commits de React** — medida en el build de profiling (sección 12).
- Sigue **abierta** la atribución del cuello dominante en la apertura (los tramos red/parseo/estado/commits/paint de C500 están medidos; la separación precisa commit-por-commit está en la sección 12).

## 16. Estado de los cortes

- **Corte 5A**: la ventana de observación continúa activa. Esta fase emitió exclusivamente solicitudes indexadas (`contract=indexed`; `cover=thumbnail` en la lista) y **cero eventos legacy**; cero escrituras remotas; cero violaciones de guardia.
- **Corte 5B**: continúa **BLOCKED**.
- **Migración del Corte 4**: continúa **NOT RUN**.
- Esta fase **no implementa optimizaciones productivas** (confirmado en el informe del PR y en el diff: sólo instrumentación inerte con bandera + harness).

## 17. Esquema de `raw-results-2b.json`

Claves raíz: `schemaVersion`, `kind`, `buildMode`, `appSha`, `harnessSha`, `measuredAtUtc`, `user`, `samplesRequested`, `scenarios` (B1/B2 `{samples, aggregate}`; B3 `{cold, warm, *Aggregate}`; B4 `[{op, executions, aggregate, ...}]`; B5/B6/B7 `{samples, aggregate}`), `storage` (hidratación fría/caliente y escrituras), `network` (`bySurface` con `ttfbAggregate`/`downloadAggregate`/`durationAggregate`/`transferSize`/`encodedBodySize`/`decodedBodySize`/`contentEncodings` y `source`), `guard` (`totalIndexedEvents`, `legacyEvents`, `protectedRequests`, `otherRequests`, `violations`, `methods`), `requests` (grupos equivalentes con URL redactada `:id`), `memory`, `react` (sólo profiling), `cpuAttribution` (trazas CDP), `dom`, `samplesCompleted`, `samplesFailed`, `errors`, `environment`, `limitations`, `status` (`PASS`/`PASS PARCIAL`/`BLOCKED`/`FAIL`). Todos los valores persistidos pasan `sanitizeResults` (rechaza claves de contenido, tokens, cadenas largas sin alias y cualquier 24-hex sin alias/token permitido).

## 18. Siguiente investigación sugerida (sin implementar)

1. Confirmar el punto de quiebre con cardinalidad sintética (D100/D500, C1000) y perfiles de red R1/R2 sobre el mismo harness (sólo cambia el backend/dataset de destino; el harness es reutilizable).
2. Separación commit-por-commit de la apertura C500 (el build de profiling ya lo permite: `commitsB1FirstRep` por escenario) para atribuir render vs paint.
3. Entorno M1/M2 (móvil) cuando exista evidencia física autorizada; no sustituir por emulación.
4. Validar la reutilización de la respuesta indexada al regresar de un mazo (la reapertura caliente ya muestra ~2× mejora; queda medir con caché HTTP caliente real).
5. El explain del aggregate completo de Library sigue NOT MEASURED (2A) y no forma parte de 2B.

## 19. Veredicto

**PASS PARCIAL** — todos los escenarios centrales se ejecutaron con 5 repeticiones válidas en el build productivo real y en el build de profiling; las mediciones obligatorias (loaders, safeLocalStorage, Library useful, React, filtros/búsquedas/ordenamientos/conteos, scripting/layout/paint, long tasks, memoria, DOM, red/parseo/render) están cubiertas. Elementos legítimamente NOT MEASURED: p95 (regla de las 5 muestras), la atribución CPU de B4 (traza CDP vacía en la primera repetición), raster/composite detallado en superficies sin imágenes, entornos R1/R2/M1/M2 y la curva sintética. No hay elementos BLOCKED ni FAIL: cero solicitudes legacy, cero escrituras, resultados sanitizados y ninguna optimización implementada.
