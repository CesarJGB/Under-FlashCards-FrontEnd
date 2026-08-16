# Fase 2A — Baseline real de escala de Library y apertura de mazos

## Cómo leer esta carpeta

- [phase-2a-real-baseline.md](./phase-2a-real-baseline.md): reporte completo de la fase (objetivo, entorno, metodología, resultados clasificados, inspección estática, limitaciones y siguiente investigación).
- [phase-2b-browser-profile.md](./phase-2b-browser-profile.md): Fase 2B — perfil real de navegador de Library y apertura de mazos (red/parseo/hidratación/React/DOM/CPU/memoria en Chromium con los datos reales de 2A).
- [raw-results.json](./raw-results.json): resultados crudos **sanitizados** (esquema en la sección 15 del reporte): inventario agregado, selección C20/C100/C500, mediciones de API (5 muestras por caso) y explain MongoDB. Sólo aliases (`real-user-A`, `C20-real`, `C100-real`, `C500-real`), conteos, tamaños, tiempos y etapas genéricas de plan.
- [raw-results-2b.json](./raw-results-2b.json): resultados crudos **sanitizados** de la Fase 2B (esquema 3.0.0 en la sección 17 de su reporte): escenarios B1–B7 del navegador, red (correlación CDP uno a uno), body/`JSON.parse` puro/transformación por escenario y repetición, almacenamiento/memoria/DOM/CPU/long tasks/React y guardia del Corte 5A. Sólo aliases y agregados.
- [raw-results-2b-profiling.json](./raw-results-2b-profiling.json): idem en el build de profiling de React (renders/commits por escenario y repetición).
- Harness: `backend/scripts/performance/libraryScaleBaseline.js` (+ utilidades puras en `backend/scripts/performance/libraryScaleBaselineUtils.js`), con pruebas deterministas en `backend/test/libraryScaleBaseline.test.js`.
- Harness de navegador (2B): `frontend/tests/performance/library-browser/` (runner `run-browser-profile.mjs`, página `main.jsx`, utilidades puras `libraryBrowserProfileUtils.mjs` y pruebas deterministas `library-browser-profile.test.js`).

## Resumen

La Fase 2A construyó el harness read-only y determinista y lo ejecutó contra el **entorno productivo autorizado** (contenedor backend en Coolify/Docker del mismo servidor, con la URI Mongo como variable temporal del subshell y el dominio público documentado como `production-backend-A`). Resultado: **MEASURED** en inventario, API indexada y explain:

- 29 mazos propios, 5.877 tarjetas (suma por mazo; 5.879 por `userId`), mediana 100, máximo 545; 9 mazos ≥ 500 tarjetas.
- API (5 muestras/caso, todas 200 OK, `Content-Encoding` ausente en las solicitudes del harness, cuyo cliente Node no anunció compresión — navegador/edge NOT MEASURED): lista 304 KB / 235.86 ms mediana; C20 9.4 KB / 145.55 ms; C100 48 KB / 148.08 ms; C500 261 KB / 245.74 ms. p95 = NOT MEASURED (5 muestras).
- Explain: la lista de mazos hace COLLSCAN + sort en memoria (36 docs examinados); la **muestra de conteos de los tres mazos seleccionados** (C20/C100/C500 = 620 tarjetas) es covered query sobre `deckId_1` (el aggregate completo de Library, 29 mazos, queda sin explain: NOT MEASURED); la apertura por mazo usa `deckId_1` con sort en memoria (`{createdAt:-1}` sin compuesto `{deckId, createdAt}`).
- Cero eventos legacy en la telemetría del Corte 5A (103 eventos `indexed`); cero escrituras.

La Fase 2B cerró los NOT MEASURED de navegador sobre los mismos datos reales: [phase-2b-browser-profile.md](./phase-2b-browser-profile.md) mide en Chromium el tiempo hasta Library/mazos utilizables (B1–B7, 5 muestras/caso, p95 NOT MEASURED), la compresión efectiva y la separación red/body/`JSON.parse` puro/transformación/render, la hidratación de `safeLocalStorage`, los renders y commits de React (build de profiling separado), el DOM, la memoria, las tareas largas y la atribución scripting/layout/paint, y confirma la guardia del Corte 5A con cero eventos legacy, cero all-cards y cero escrituras.

Tres defectos reales del harness se detectaron y corrigieron durante la ejecución (resumen genérico del plan MongoDB para no filtrar ObjectIds, opciones de cursor para agregaciones compatibles con Atlas, y casting explícito de ObjectId en agregaciones), cada uno con pruebas deterministas. En 2B se corrigieron defectos reales del harness de navegador (marcadores de nivel sensibles a mayúsculas CSS, apertura de mazos sin `materiaId`, emparejado de título por substring, etiqueta de ordenamiento y memoria precisa en headless), cada uno verificado con el diagnóstico de página y las **54 pruebas deterministas** del harness, y posteriormente los defectos de integridad de la medición (correlación CDP uno a uno, separación y persistencia por repetición de body/parse/transformación, long tasks y React, y flujo de dos commits), cubiertos por 14 pruebas nuevas.

## Estado de los cortes

- Corte 5A: continúa desplegado y en observación (cero peticiones legacy emitidas por ambas fases).
- Corte 5B: continúa **BLOCKED**.
- Migración del Corte 4 (`migrate:image-backgrounds`): continúa **NOT RUN**.
- Las fases 2A y 2B **no implementan optimizaciones productivas**; 2B añade sólo instrumentación inerte con bandera (desactivada y no-op en el build normal; no se afirma eliminación por tree-shaking).

## Cómo reproducir

### Fase 2B (navegador)

```text
# Desde frontend/, con Chromium de Playwright disponible (npx playwright install chromium
# si @playwright/test ya está instalado y sólo falta el binario; sin sudo ni globales).
# Reproducibilidad: ejecutar desde el Commit A con árbol limpio; el runner se
# niega a medir con cambios rastreados (PERF_ALLOW_DIRTY=1 sólo para depuración).
PERF_TEST_USER_ID='<usuario-autorizado>' \
VITE_BACKEND_URL='https://<dominio-publico-backend>' \
PERF_SAMPLES=5 \
PERF_BUILD_MODE=production \
PERF_HARNESS_SHA='<sha-completo-del-commit-A>' \
PERF_APPLICATION_BASE_SHA='ecb025914435fa4659200c9890a0e4ffea916175' \
node tests/performance/library-browser/run-browser-profile.mjs \
  --out docs/performance-audit/research/library-scale/raw-results-2b.json

# Build de profiling (renders/commits de React; resultados nunca mezclados):
PERF_BUILD_MODE=profiling node tests/performance/library-browser/run-browser-profile.mjs \
  --out docs/performance-audit/research/library-scale/raw-results-2b-profiling.json

# Pruebas deterministas del harness:
npm run test:library-browser

# Validación post-run de esquema/sanitización/guardia 5A:
node tests/performance/library-browser/validate-final-results.mjs \
  docs/performance-audit/research/library-scale/raw-results-2b.json \
  docs/performance-audit/research/library-scale/raw-results-2b-profiling.json
```

Sólo emite GET con el contrato indexado; la guardia fail-fast detiene la ejecución ante cualquier solicitud legacy, all-cards o método distinto de GET. Los identificadores reales viven sólo en memoria del proceso; los resultados persistidos pasan `sanitizeResults` (aliases `real-user-A`, `C20-real`, `C100-real`, `C500-real` y `<backend-url>`).

### Fase 2A (API/backend)

```text
# Desde backend/, con permisos de Docker y el usuario autorizado:
(
  export MONGO_URL="$(docker exec <backend-container> sh -lc 'printf "%s" "${MONGO_URL:-${MONGO_URI:-}}"')"
  export PERF_TEST_USER_ID='<usuario-autorizado>'
  export PERF_BASE_URL='https://<dominio-publico-backend>'
  node backend/scripts/performance/libraryScaleBaseline.js \
    --base-url "$PERF_BASE_URL" \
    --out docs/performance-audit/research/library-scale/raw-results.json
)
```

La URI nunca se imprime, escribe ni commitea; el ID real nunca se hardcodea; los resultados persistidos sólo contienen aliases y agregados (garantizado por `serializeRawResults`).

**Reproducibilidad y SHA (Fase 2A)**: `sha = ef8c4d0c…` en `raw-results.json` identifica la versión de la aplicación productiva medida (HEAD de `origin/main` en el contenedor), **no** un commit del harness. El harness se ejecutó inicialmente desde el árbol de trabajo de la rama `perf/phase-2a-library-scale-baseline` antes de su commit y se publica en el PR #11; el raw no prueba que el harness formara parte del commit `ef8c4d0c`. Las correcciones posteriores de validación/documentación (límite `maxTimeMS`, estado parcial de API, nombre de la consulta de conteos) no alteran las muestras persistidas.

**Reproducibilidad y SHA (Fase 2B, corregida con flujo de dos commits)**: `applicationBaseSha = ecb025914435fa4659200c9890a0e4ffea916175` identifica la aplicación productiva medida y `harnessSha = 611ffb0fc614f98d79b9f8ee191897bd7206e53a` (Commit A) el harness con el que se ejecutaron ambos runs finales (productivo y profiling, 5 repeticiones válidas por escenario, desde árbol limpio). La versión anterior registraba `appSha == harnessSha == ecb0259…` con el harness sin commitear; esa evidencia no era reproducible y quedó sustituida. El runner exige árbol limpio (salvo `PERF_ALLOW_DIRTY=1`) y registra ambos SHAs por separado; cualquier cambio posterior en runner/instrumentación/serializador/esquema invalida los resultados.
