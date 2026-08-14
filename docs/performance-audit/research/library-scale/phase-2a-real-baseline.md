# Fase 2A — Reporte del baseline real de escala de Library y apertura de mazos

## 1. Estado del repositorio

| Dato | Resultado |
|---|---|
| Rama | `perf/phase-2a-library-scale-baseline` (creada desde `origin/main`) |
| HEAD base esperado | `ef8c4d0c257b70f4d4167a2c3b232b6ed89086fa` |
| `origin/main` tras `git fetch origin` | `ef8c4d0c257b70f4d4167a2c3b232b6ed89086fa` |
| Drift | **Ninguno**: `origin/main == HEAD esperado` |
| Estado inicial del árbol | Archivos de sesión ajenos sin seguimiento (`session-ses_*.md`), conservados |
| Corte 5A | Desplegado y en observación |
| Corte 5B | **BLOCKED** |
| Migración del Corte 4 | **NOT RUN** |

Las entradas no rastreadas no se modificaron, no se leyeron como evidencia y no entran en ningún commit.

## 2. Objetivo y alcance

**Objetivo**: construir y ejecutar una investigación reproducible y estrictamente read-only para medir la escala real de Library, la distribución de tarjetas por mazo, la apertura de mazos grandes, el tamaño y la latencia de las respuestas indexadas, el coste de las consultas MongoDB y los puntos candidatos de cuello de botella.

**Alcance autorizado e implementado**:

- Harness determinista y read-only: `backend/scripts/performance/libraryScaleBaseline.js`.
- Utilidades puras: `backend/scripts/performance/libraryScaleBaselineUtils.js`.
- Pruebas deterministas: `backend/test/libraryScaleBaseline.test.js` (54).
- Resultados crudos sanitizados: `raw-results.json` (esquema documentado en la sección 15).
- Documentación de esta carpeta y actualizaciones localizadas de `docs/performance-audit/README.md` y `docs/performance-audit/prioritized-roadmap.md`.

**Fuera de alcance (no implementado)**: paginación, virtualización, `React.memo`, cambios de filtros, consolidación de loaders, cambios de caché o localStorage, nuevos endpoints, cambios de payload o índices, instrumentación productiva permanente, cambios de imágenes o UI, Corte 5B, migraciones, benchmarks de escritura, Playwright, pruebas físicas de iPhone y dependencias nuevas.

## 3. Entorno y acceso autorizado

El checkout no contiene credenciales (`backend/.env` inexistente). El acceso autorizado se obtuvo del entorno del **contenedor productivo del backend** (Coolify/Docker en el mismo servidor), tras resolver los permisos del socket Docker (el operador añadió el usuario al grupo `docker`).

Identificación del contenedor (sólo comandos read-only, sin imprimir secretos):

| Comprobación | Resultado |
|---|---|
| `docker ps` | Backend Node identificado por imagen construida con el SHA `ef8c4d0c…` (Corte 5A desplegado) y proceso `node src/server.js` |
| Presencia de `MONGO_URL`/`MONGO_URI` en el contenedor | `mongo-configured` (sólo presencia, nunca el valor) |
| Dominio público del backend (regla `Host(...)` de los labels de routing) | `production-backend-A` (el dominio real no se incluye en archivos commiteados; el harness lo redacta como `<base-url>` en los resultados) |
| Verificación de salud | `GET /api/health` → `{"status":"ok","service":"flashcards-backend","db":1}` |

La URI de MongoDB se utilizó **exclusivamente como variable temporal del subshell** que ejecutó el harness (`export MONGO_URL="$(docker exec … printf …)"`): nunca se imprimió, escribió, commiteó ni apareció en errores o resultados; se descartó al terminar cada subshell. No se modificó el contenedor, no se copiaron archivos dentro, no se reinició ni se cambió su configuración.

### 3.1 Historial del bloqueo previo

Los dos intentos anteriores quedaron BLOCKED: (1) sin credenciales en el checkout y (2) socket Docker sin permisos (`/var/run/docker.sock` no accesible, sin grupo `docker`, sudo con contraseña). El operador resolvió el segundo añadiendo el usuario al grupo `docker`; los comandos seguros de desbloqueo quedan documentados en este historial para reproducibilidad (identificación del contenedor, `test -n` de presencia, subshell con variable temporal).

## 4. Metodología

1. Verificación de base: `git status`, rama, HEAD, fetch y comparación con el HEAD esperado (sin drift).
2. Lectura completa de la documentación obligatoria de `docs/performance-audit/` y `research/image-delivery/` (incluido el reporte 1G del Corte 5A).
3. Lectura estática del código relacionado (frontend y backend; sección 8).
4. Implementación del harness y las utilidades puras con validación estricta y `--help`.
5. Corrección de defectos reales detectados al ejecutar (sección 6): resumen genérico del plan MongoDB (el `winningPlan` crudo contiene ObjectIds reales), opciones de cursor para agregaciones compatibles con Atlas (Mongoose 9 no expone `Aggregate.maxTimeMS()` y la etapa `$maxTimeMS` no está permitida en Atlas) y casting explícito de ObjectId en `$match` de agregaciones.
6. Ejecución del harness contra el entorno autorizado (inventario + API indexada + explain), con máximo 5 solicitudes secuenciales por caso y `maxTimeMS` ≤ 5000 ms (límite máximo impuesto por construcción; ver sección 5).
7. Verificación de cero eventos legacy en la telemetría del Corte 5A (logs del contenedor).
8. Verificaciones reglamentarias de backend y frontend (sección 9).
9. Documentación con clasificación explícita de cada resultado (MEASURED / STATICALLY CONFIRMED / MODELED / BLOCKED / NOT RUN).

### 4.1 Reproducibilidad y SHA del harness

- `sha = ef8c4d0c…` en `raw-results.json` identifica la **versión de la aplicación productiva medida** (el HEAD de `origin/main` sobre el que corría el contenedor backend), no un commit del harness.
- El harness se ejecutó inicialmente desde el **árbol de trabajo de la rama `perf/phase-2a-library-scale-baseline` antes de su commit** (`21fe564`); el raw-results.json no prueba que el harness formara parte del commit `ef8c4d0c`.
- El harness publicado vive en el **PR #11** (versión publicada en el HEAD de ese PR). Las correcciones posteriores de validación y documentación (límite `maxTimeMS`, estado parcial de API, nombre de la consulta de conteos) no alteran las muestras persistidas ni los valores medidos.
- El harness no es byte-idéntico a ningún commit productivo: es una herramienta de investigación del PR, no código de producción.

## 5. Límites de carga y garantía read-only

- Máximo **5 solicitudes secuenciales por caso** (constante `MAX_SAMPLES_PER_CASE`, aplicada por `clampSamples`). Sin concurrencia, sin carga ni estrés.
- **`maxTimeMS` con tope por construcción**: la constante única `MAX_TIME_MS = 5000` limita toda consulta MongoDB (find/aggregate/explain) a un entero entre 1 y 5000; `validateArgs` y `buildAggregateOptions` rechazan 0, 5001, 60000, negativos, decimales y texto. El timeout adicional que envuelve las promesas (`maxTimeMs + 1000/2000`) es sólo **margen local de cierre** del proceso Node y nunca llega a MongoDB: ninguna consulta recibe más de 5000 ms.
- Método HTTP únicamente `GET` (rechazado cualquier otro por `assertReadOnlyMethod`).
- Contrato exclusivamente indexado: `contract=indexed` (y `cover=thumbnail` en la lista). `buildLibraryUrl`/`buildDeckCardsUrl` rechazan cualquier valor legacy (`assertIndexedContract`); `classifyContract` distingue `indexed`/`legacy-missing`/`legacy-other` como la telemetría del 5A.
- Prohibido por construcción: `save`, `update`, `insert`, `delete`, `bulkWrite`, creación de índices, migraciones, ejecución del script del Corte 4 y pruebas concurrentes.
- Timeouts sin fabricar resultados: `withTimeout` + `BaselineTimeoutError`; las muestras fallidas no cuentan como latencia; con ≤5 muestras el p95 queda `NOT MEASURED`.

## 6. Defectos reales corregidos en el harness (no productivos)

Detectados ejecutando contra el entorno real; cada corrección incluye pruebas deterministas:

1. **`winningPlan` crudo rechazado por la guarda de seguridad**: el plan de MongoDB contiene valores reales (`indexBounds`/`filter` con ObjectIds del usuario/mazos). Se sustituyó por un **resumen genérico** (`summarizeWinningPlan`): etapas, nombre del índice, `keyPattern` y `sortPattern` — nunca valores. Cubierto por pruebas (incluida una con ObjectId real en un plan sintético).
2. **`Flashcard.aggregate(...).maxTimeMS is not a function`**: Mongoose 9.7.4 no expone `Aggregate.maxTimeMS()`. La etapa `$maxTimeMS` tampoco es válida en MongoDB Atlas. Solución: opción de cursor `Aggregate.option(buildAggregateOptions(maxTimeMS))` → `{ maxTimeMS }`. Cubierto por pruebas.
3. **Casting de ObjectId en `$match` de agregaciones**: `Model.aggregate()` no castea strings a ObjectId (a diferencia de `find`), lo que producía `$match: { userId }` con 0 resultados y `$in` de deckIds con 0 coincidencias. Solución: cast explícito con `mongoose.Types.ObjectId`. Verificado contra datos reales: el inventario por mazo (5.877 tarjetas) y por userId (5.879) ahora coinciden en magnitud.

## 7. Resultados de medición — MEASURED

### 7.1 Inventario agregado (escala real de Library) — MEASURED

Usuario `real-user-A` (alias del usuario autorizado), SHA `ef8c4d0c…`, `measuredAtUtc` 2026-08-14T22:08:50Z:

| Métrica | Valor |
|---|---:|
| Mazos propios | **29** |
| Tarjetas en mazos propios (suma por `deckId`) | **5.877** |
| Tarjetas etiquetadas con `userId` (aggregate por `userId`) | **5.879** (discrepancia real de 2; ver sección 10) |
| Mínimo por mazo | 0 |
| Mediana por mazo | 100 |
| p95 por mazo | 519.5 |
| Máximo por mazo | 545 |
| Mazos 0–20 tarjetas | 6 |
| Mazos 21–100 | 11 |
| Mazos 101–499 | 3 |
| Mazos 500+ | **9** |

Imágenes (sólo presencia, cantidad y longitud agregada; nunca contenido):

| Métrica | Valor |
|---|---:|
| Mazos con `coverImage` | 2 (longitud agregada 290.398 caracteres) |
| Mazos con `coverImageThumb` | 0 |
| Mazos con `cardBackgrounds` | 5 (8 entradas en total; longitud agregada 1.375.528 caracteres) |
| Tarjetas con `contentImage` | 6 (longitud agregada 390.374 caracteres) |

Selección local determinista (radio relativo 25%, desempate por id):

| Alias | Tarjetas | Distancia al objetivo |
|---|---:|---:|
| `C20-real` | 20 | 0 |
| `C100-real` | 100 | 0 |
| `C500-real` | 500 | 0 |

### 7.2 Medición de API (lista indexada y aperturas) — MEASURED

5 solicitudes secuenciales por caso, todas `200 OK`, contrato indexado. `Content-Encoding` estuvo **ausente** en las solicitudes del harness, cuyo cliente Node no anunció compresión (no envía `Accept-Encoding`); esto no demuestra si el navegador recibe o no respuestas comprimidas (medición navegador/edge = NOT MEASURED).

| Caso | Elementos | Bytes (wire, todas las muestras idénticos) | Latencia total mediana | Mínimo | Máximo | p95 |
|---|---|---:|---:|---:|---:|---:|
| `deck-list` (contract=indexed&cover=thumbnail) | 29 | 303.769 | 235.86 ms | 231.29 ms | 665.49 ms | NOT MEASURED |
| `deck-cards` C20-real (contract=indexed) | 20 | 9.433 | 145.55 ms | 137.18 ms | 437.60 ms | NOT MEASURED |
| `deck-cards` C100-real | 100 | 48.474 | 148.08 ms | 143.09 ms | 160.69 ms | NOT MEASURED |
| `deck-cards` C500-real | 500 | 261.005 | 245.74 ms | 236.29 ms | 261.85 ms | NOT MEASURED |

Desglose de muestras (TTFB/total/parse/bytes) en `raw-results.json`. Observaciones medidas:

- `JSON.parse` es marginal (0.1–1 ms en todas las muestras): el parseo local no es el cuello en este entorno Node del harness.
- El TTFB domina el tiempo total (≈ total − 0.2–3 ms): la latencia es de red + backend, no de descarga.
- La lista de 29 mazos (303.769 B, ~304 KB) es el payload más pesado: 29 mazos ≈ 10.5 KB por mazo de media.
- C500-real transporta 261.005 B (~255 KB) con `Content-Encoding` ausente en las solicitudes del harness (cliente Node sin anuncio de compresión; el navegador no se midió).

### 7.3 Consultas MongoDB con explain — MEASURED

Una ejecución por consulta, `explain("executionStats")`, `maxTimeMS` 5000:

| Consulta | Etapas | Índice | nReturned | docsExamined | keysExamined | Sort | Tiempo |
|---|---|---|---|---:|---:|---:|---|---:|
| `Deck.find({$or:[userId,isDefault,isPublicReadOnly]}).sort({createdAt:-1})` | SUBPLAN → SORT → **COLLSCAN** | ninguno | 29 | 36 | 0 | sí (en memoria) | 0 ms |
| Muestra de conteos `Flashcard.aggregate($match deckId $in + $group)` sobre **sólo C20/C100/C500-real** | IXSCAN → PROJECTION_COVERED → GROUP | `deckId_1` | 3 | 0 | 620 | no | 0 ms |
| `Flashcard.find({deckId}).sort({createdAt:-1})` C20-real | IXSCAN → FETCH → **SORT** | `deckId_1` | 20 | 20 | 20 | sí (en memoria) | 0 ms |
| Idem C100-real | IXSCAN → FETCH → SORT | `deckId_1` | 100 | 100 | 100 | sí (en memoria) | 0 ms |
| Idem C500-real | IXSCAN → FETCH → SORT | `deckId_1` | 500 | 500 | 500 | sí (en memoria) | 1 ms |

**Alcance del explain de conteos (`deck-counts-selected-sample`)**: la evidencia corresponde exclusivamente a los **tres mazos seleccionados** (C20-real + C100-real + C500-real = 620 tarjetas: `keysExamined 620` = 20+100+500 exactamente). Demuestra **cualitativamente** el plan cubierto con `deckId_1`, pero **no mide el coste completo** del aggregate del endpoint de Library, que en producción agrega sobre los **29 mazos visibles**; el explain del aggregate completo de Library queda **NOT MEASURED** y **no se debe extrapolar** 620 keys al endpoint completo.

Hallazgos medidos (no inferencias):

- La **lista de mazos hace COLLSCAN** (36 documentos examinados) con sort en memoria; con la cardinalidad actual es barato (0 ms), pero el coste crece linealmente con el total de mazos visibles de la colección.
- La **muestra de conteos de los tres mazos seleccionados** es una covered query (PROJECTION_COVERED sobre `deckId_1`, sin fetch: docsExamined 0, keysExamined 620): el índice simple `deckId_1` basta para el conteo por mazo en esta muestra; el aggregate completo de Library (29 mazos) no se explain-eó.
- La **apertura por mazo es selectiva** (docsExamined == keysExamined == nReturned), pero el **sort `{createdAt:-1}` se ejecuta en memoria** (stage SORT; no existe el compuesto `{deckId, createdAt}`). Con 500 tarjetas el coste reportado sigue siendo 0–1 ms.

### 7.4 Ejecuciones del harness

```text
node scripts/performance/libraryScaleBaseline.js --help                → exit 0
node scripts/performance/libraryScaleBaseline.js                       → error de validación; exit 2
PERF_TEST_USER_ID=… node scripts/performance/libraryScaleBaseline.js   → BLOCKED sin credenciales; exit 3
(con MONGO_URL temporal + --base-url production-backend-A)             → inventory/api/explain MEASURED; raw-results.json escrito; exit 0
```

Cuatro ejecuciones contra el entorno real (read-only e idempotentes): las tres primeras sirvieron para detectar los defectos de la sección 6 (la última con el harness corregido produjo `raw-results.json`); la API repitió como máximo 5 solicitudes secuenciales por caso en cada ejecución.

## 8. Inspección estática del frontend — STATICALLY CONFIRMED

Verificada sobre el HEAD `ef8c4d0c257b70f4d4167a2c3b232b6ed89086fa`. Confirma (no mide en navegador) los mecanismos de crecimiento, con líneas actualizadas:

### 8.1 Invocadores de `loadDecks` y `loadMaterias`

Definidos en `App.jsx:82-100` (`loadDecks`) y `App.jsx:102-120` (`loadMaterias`), cada uno con `?t=${Date.now()}&contract=indexed&cover=thumbnail` (mazos) y `?t=${Date.now()}` (materias). Invocadores reales:

| Invocador | Líneas | Circunstancia |
|---|---|---|
| `App` (DashboardScreen) | `App.jsx:122-130` | montaje, con `AbortController` |
| `HomeSection` | `HomeSection.jsx:487-490` | montaje (sincronización pasiva) |
| `LibrarySection` | `LibrarySection.jsx:31-34` | montaje |
| `LibrarySection` (volver de mazo) | `LibrarySection.jsx:298-299` | `onBack` de DeckInterior |
| `LibrarySection` (`onRefreshData`) | `LibrarySection.jsx:301-304` | tras crear/editar/borrar/importar tarjetas y lotes |
| `LibrarySection` (mutaciones) | `:186`, `:211`, `:257`, `:264`, `:284` | borrado de carpeta, fallo de actualización, 401/fallo de borrado, importación |
| `RadarDebugPanel` | `RadarDebugPanel.jsx:42` | sólo depuración (`Promise.all`) |

**Cargas equivalentes o duplicadas confirmadas**: App + HomeSection + LibrarySection pueden solicitar ambas colecciones completas al entrar; el timestamp hace únicas las URLs (sin reutilización HTTP); cada mutación de tarjetas dispara `onRefreshData` → ambas cargas completas; `DeckInterior` al abrir un mazo descarga todas las tarjetas y, al iniciar una sesión, `SessionPlayer.jsx:377` descarga otra colección completa (`all-cards?userId=...&contract=indexed`).

### 8.2 Persistencia con `safeLocalStorage`

- `App.jsx:62-64` inicializa estado desde `getJSON('decks_<id>')`/`getJSON('materias_<id>')` y los parsea de nuevo para `loading` (`:66-70`).
- Cada carga exitosa hace `setJSON` síncrono de la colección completa (`App.jsx:94`, `:114`); `LibrarySection` también persiste tras mutaciones locales (`:110`, `:150`, `:179`, `:193`, `:236`, `:262`).
- `safeLocalStorage.js`: `setJSON` hace `JSON.stringify` síncrono; ante cuota conserva el último valor en un Map en memoria; `getJSON` devuelve `null` si la clave falta y sólo consulta el Map ante error de parseo (sin TTL, versión ni evicción).

### 8.3 Filtros, búsquedas, ordenamientos y conteos

- `useLibraryState.js:146-176`: `processedDecks` filtra por búsqueda y camino académico y ordena por `recent/oldest/alpha/cards-desc/cards-asc`.
- `useLibraryState.js:11-40` (`sortFolders`) y `TemasLevel.jsx:28,62` / `SubtemasLevel.jsx:44,76`: conteos por carpeta con `decks.filter(...)` dentro de `.map(...)` → **O(carpetas × mazos)**.
- `MateriasLevel.jsx:167`: `unclassifiedDecks` filtrado por memo sobre la colección completa.
- `SearchResults` (búsqueda global): recorridos lineales de materias/temas/subtemas/mazos con relaciones resueltas por `find` anidados.
- `FlashcardCollection.jsx:46-50`: `useDeferredValue` + filtro/sort de la lista completa de tarjetas.

### 8.4 Camino desde abrir un mazo hasta renderizar las tarjetas

1. `DeckCard` → `LibrarySection` (`setCurrentDeck`/`setInitialMode`) → render de `DeckInterior`.
2. `DeckInterior.jsx:60-77` (`loadCards`): `GET /api/flashcards/deck/:id?contract=indexed` con `AbortController` al desmontar (`:79-85`); `extractAndResolveCards` materializa `bgImage` por tarjeta desde el diccionario (`lib/imageDelivery.js:53-60`).
3. `CardCollectionView`/`FlashcardCollection`: filtro/orden local de toda la lista.
4. `FlashcardGrid`: `map` de **todas** las tarjetas filtradas; sin paginación, ventana, virtualización ni caché por mazo (reabrir repite red, consulta, parseo y render).

### 8.5 Costes sin medir en navegador — NOT RUN

Commits React y duración de render (Profiler), nodos DOM, heap JS, `JSON.parse`/`stringify` de los payloads reales en el navegador, `localStorage` síncrono, decode/paint de fondos CSS, red real del dispositivo y latencia de interacción: sin harness de navegador en esta fase; sus procedimientos siguen en `measurement-plan.md` (matrices B/C/D).

## 9. Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `node --test test/libraryScaleBaseline.test.js` (backend) | **54 tests, 54 pass, 0 fail** |
| `node --test test/imageContractTelemetry.test.js` (backend) | **21 tests, 21 pass, 0 fail** |
| `node --test test/imageDeliveryContracts.test.js` (backend) | **51 tests, 51 pass, 0 fail** |
| `npm test` (backend, suite completa) | **212 tests, 207 pass, 5 fail** — exactamente los 5 fallos preexistentes (`aiService.test.js` ×2 en líneas 70 y 101; `deckRecovery.test.js` ×3 en líneas 91, 116 y 135), idénticos a los documentados en el reporte 1G; no aumentó el número; no se modificaron |
| `npm run test:image-delivery` (frontend) | **74 tests, 74 pass, 0 fail** |
| `git diff --check` | limpio |
| Eventos 5A en logs del contenedor (últimos 45 min) | **103 eventos, todos `contract: indexed`**; 28 `cover: thumbnail` (deck-list) y 75 `cover: not-applicable` (deck-cards/all-cards); **cero `legacy-missing` / `legacy-other`** |

**Fallos preexistentes**: `aiService.test.js` (2) y `deckRecovery.test.js` (3) por drift histórico de contrato IA/recuperación (`PERF-TEST-001`). No se corrigieron (fuera de alcance) y se demostró que son los mismos (archivos y líneas idénticos al reporte de la Fase 1G).

**Verificaciones no ejecutadas**: Playwright (`test:manual-editor`), benchmarks IA, migraciones, build frontend (cero cambios frontend) y mediciones de navegador (fuera de alcance de esta fase).

## 10. Limitaciones y datos aún faltantes

- Las latencias medidas incluyen red (host → dominio público → Traefik → contenedor) y backend; **no separan** tiempo de handler, queries y serialización (sin `Server-Timing`). Los tiempos de `explain` (0–1 ms) son los reportados por MongoDB para las consultas individuales, no el handler completo.
- `Content-Encoding` estuvo ausente en las solicitudes del harness, cuyo cliente Node no anunció compresión (`Accept-Encoding` no enviado); esto **no demuestra si el navegador recibe o no respuestas comprimidas**. La compresión navegador/edge queda **NOT MEASURED**; no se verificaron otras rutas ni rangos horarios.
- **Discrepancia real de 2 tarjetas** entre la suma por mazos propios (5.877) y el conteo por `userId` (5.879): indica tarjetas cuyo `userId` no coincide con el de sus mazos (o viceversa) en los datos existentes. Sin acceso a contenido (prohibido) no se profundizó; es un hallazgo de calidad de datos, no una medición errónea.
- `coverImageThumb` en 0 mazos: el Corte 2 (miniaturas) no tiene datos aún en este usuario; la lista sigue transportando `coverImage` completa cuando existe (2 mazos, 290 KB agregados).
- Con 5 muestras por caso, **p95 de latencia = NOT MEASURED** (regla del encargo).
- Costes de navegador (render, pintura, storage, parseo real en el cliente) siguen sin medir (NOT RUN).
- Sin dataset sintético D100/D500: la curva de escalado de Library se infiere de 29 mazos reales; no se extrapola.

## 11. Atribución del cuello de botella

**Evidencia parcial, sin atribución concluyente.** Con la escala real del usuario (29 mazos, ~5.900 tarjetas, máx. 545):

- MEASURED: la API responde con medianas de 145.55–245.74 ms (C20–C500) y 235.86 ms en la lista; el parseo local es <1 ms; las consultas individuales de apertura y la muestra de conteos están bien indexadas (IXSCAN, covered query) con sort en memoria barato a esta cardinalidad; la lista hace COLLSCAN (36 docs) aún barato.
- MEASURED: los payloads reales son 9.4 KB (C20), 48 KB (C100), 261 KB (C500) y 304 KB (lista de 29 mazos), con `Content-Encoding` ausente en las solicitudes del harness (cliente Node sin anuncio de compresión; navegador/edge NOT MEASURED).
- STATICALLY CONFIRMED (sin medir en navegador): grid completo sin virtualización, filtros O(F×D), triple carga de loaders y persistencia síncrona completa.
- **No hay evidencia para atribuir un cuello dominante** entre backend, serialización, red, parseo o render; los datos sugieren que el crecimiento futuro (más mazos/tarjetas con imágenes) impacta primero el payload y el render del cliente, y que un índice compuesto `{deckId, createdAt}` y la cobertura del sort de la lista son los puntos de consulta a vigilar — como hipótesis, no como conclusión.

## 12. Siguiente investigación o corte recomendado

1. Añadir `Server-Timing`/marcas temporales en entorno de investigación para separar handler, queries y serialización (procedimiento del `measurement-plan.md`, P5).
2. Ejecutar la matriz D10/D100/D500 con dataset sintético (fuera de producción) para trazar la curva de COLLSCAN/sort en memoria de la lista.
3. Medir en navegador (matriz B/C/D): parseo de 304 KB, `JSON.stringify` de `safeLocalStorage`, commits React y nodos DOM con C500.
4. Decidir con evidencia si la siguiente fase aborda contrato de resumen/detalle (curva de Library), apertura incremental, deduplicación de loaders o índices compuestos (`{deckId, createdAt}`), con los criterios del `prioritized-roadmap.md` (P0 — Curvas de escala de Library y apertura).

## 13. Estado de los cortes

- **Corte 5A**: continúa desplegado y en observación. Esta fase emitió exclusivamente peticiones indexadas (103 eventos `indexed`, cero legacy) — la ventana de observación no se reinició.
- **Corte 5B**: continúa **BLOCKED**.
- **Migración del Corte 4**: continúa **NOT RUN**.
- **Esta fase no implementa optimizaciones productivas.**

## 14. Veredicto

**PASS**

- Harness read-only verificado (54/54 pruebas deterministas) y ejecutado contra el entorno autorizado: inventario, API indexada y explain **MEASURED** con resultados reales sanitizados en `raw-results.json`.
- Cero escrituras, cero datos sensibles persistidos, cero peticiones legacy, ninguna optimización productiva, contenedor sin modificar.
- Fallos de la suite: sólo los 5 históricos demostrados en líneas idénticas.
- Bloqueos previos resueltos por el operador (permisos Docker); los defectos del harness detectados durante la ejecución real se corrigieron con pruebas.

## 15. Esquema de `raw-results.json`

```text
{ sha, measuredAtUtc, user: "real-user-A",
  sections: {
    inventory: { own: { decks, totalDecks, totalCards, min, median, p95, max, buckets[], images{} },
                 visible: {…}, cards: { totalCards, withContentImage, contentImageLength },
                 selectedDecks: [{ alias, cardCount, distance }] },
    api: { cases: { "deck-list": {…}, "deck-cards": { "C20-real": {…}, "C100-real": {…}, "C500-real": {…} } } },
    explain: { queries: { "deck-list": {…}, "deck-counts-selected-sample": {…}, "deck-cards:C20-real": {…}, … } }
  } }
```

Notas del esquema:

- `sha = ef8c4d0c…` identifica la **versión de la aplicación productiva medida**, no un commit del harness: el harness se ejecutó desde el árbol de trabajo de la rama antes de su propio commit y se publicó en el PR #11; el raw no prueba que el harness formara parte del commit `ef8c4d0c`.
- `explain.queries["deck-counts-selected-sample"]` es la **muestra de conteos de los tres mazos seleccionados** (C20/C100/C500-real = 620 tarjetas); no es el aggregate completo del endpoint de Library (29 mazos visibles), cuyo explain queda **NOT MEASURED** y no debe extrapolarse a partir de `keysExamined = 620`.
- La sección `api` es `MEASURED` sólo cuando los cuatro casos esperados (`deck-list`, `C20-real`, `C100-real`, `C500-real`) tienen al menos una muestra correcta; un éxito parcial se marca `BLOCKED` con `partialResults: true`.

Contiene exclusivamente aliases, conteos, rangos, tamaños, tiempos, estadísticas de ejecución y etapas genéricas del plan MongoDB; nunca IDs reales, contenido, Data URLs, cuerpos HTTP, URIs ni tokens (garantizado por `serializeRawResults`).
