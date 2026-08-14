# Fase 2A — Baseline real de escala de Library y apertura de mazos

## Cómo leer esta carpeta

- [phase-2a-real-baseline.md](./phase-2a-real-baseline.md): reporte completo de la fase (objetivo, entorno, metodología, resultados clasificados, inspección estática, limitaciones y siguiente investigación).
- [raw-results.json](./raw-results.json): resultados crudos **sanitizados** (esquema en la sección 15 del reporte): inventario agregado, selección C20/C100/C500, mediciones de API (5 muestras por caso) y explain MongoDB. Sólo aliases (`real-user-A`, `C20-real`, `C100-real`, `C500-real`), conteos, tamaños, tiempos y etapas genéricas de plan.
- Harness: `backend/scripts/performance/libraryScaleBaseline.js` (+ utilidades puras en `backend/scripts/performance/libraryScaleBaselineUtils.js`), con pruebas deterministas en `backend/test/libraryScaleBaseline.test.js`.

## Resumen

La Fase 2A construyó el harness read-only y determinista y lo ejecutó contra el **entorno productivo autorizado** (contenedor backend en Coolify/Docker del mismo servidor, con la URI Mongo como variable temporal del subshell y el dominio público documentado como `production-backend-A`). Resultado: **MEASURED** en inventario, API indexada y explain:

- 29 mazos propios, 5.877 tarjetas (suma por mazo; 5.879 por `userId`), mediana 100, máximo 545; 9 mazos ≥ 500 tarjetas.
- API (5 muestras/caso, todas 200 OK, sin Content-Encoding visible): lista 304 KB / 236 ms mediana; C20 9.4 KB / 134 ms; C100 48 KB / 146 ms; C500 261 KB / 255 ms. p95 = NOT MEASURED (5 muestras).
- Explain: la lista de mazos hace COLLSCAN + sort en memoria (36 docs examinados); los conteos son covered query sobre `deckId_1`; la apertura por mazo usa `deckId_1` con sort en memoria (`{createdAt:-1}` sin compuesto `{deckId, createdAt}`).
- Cero eventos legacy en la telemetría del Corte 5A (103 eventos `indexed`); cero escrituras.

Tres defectos reales del harness se detectaron y corrigieron durante la ejecución (resumen genérico del plan MongoDB para no filtrar ObjectIds, opciones de cursor para agregaciones compatibles con Atlas, y casting explícito de ObjectId en agregaciones), cada uno con pruebas deterministas (45/45).

## Estado de los cortes

- Corte 5A: continúa desplegado y en observación (cero peticiones legacy emitidas por esta fase).
- Corte 5B: continúa **BLOCKED**.
- Migración del Corte 4 (`migrate:image-backgrounds`): continúa **NOT RUN**.
- Esta fase **no implementa optimizaciones productivas**.

## Cómo reproducir

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
