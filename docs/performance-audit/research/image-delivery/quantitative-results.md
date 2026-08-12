# Resultados cuantitativos — contratos de entrega de imágenes

Harness: `frontend/tests/performance/image-delivery/run-delivery-baseline.mjs` (Node 22, V8, sin dependencias nuevas; `bson` ya instalada). Comando:

```text
cd frontend
PERF_COMMIT=245bbc03450143d94cd5d10e01cca6efb1e7f659 \
  node --max-old-space-size=4096 tests/performance/image-delivery/run-delivery-baseline.mjs \
  /tmp/image-delivery-results.json
```

Resultado: 112 filas de respuestas de tarjetas (7 escenarios × 4 tamaños × 4 contratos), 48 filas de listas de mazos (4 escenarios × 3 tamaños × 4 contratos) y 3 filas BSON. Detalle completo en [raw-results.json](./raw-results.json) (esquema `1.1.0`).

## Clasificación

- Contratos comparados: `current` (serializadores vigentes), `normalized` (diccionario + `bgImageIndex`), `referenced` (referencias de asset, sin bytes), `hybrid` (miniaturas + referencias full).
- Tamaños JSON: **MODELED** (reproducción byte a byte de la forma de respuesta). gzip (nivel 6) y tiempos Node/V8 (stringify/parse, 5 repeticiones): **MEASURED** sobre el modelo. Perfil `thumb` (256×144, 20,480 B binarios): **ESTIMATED** (escala del perfil `small` medido en la Fase 1A: 32 KiB × (256×144)/(320×180)). BSON: **MEASURED** con `bson@7.3.1` presente en `backend/node_modules`. Requests en frío: **MODELED** (número de imágenes únicas).
- **BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE**: sin `explain()`, latencia, CPU ni plan MongoDB. **PENDING — DEVICE REQUIRED**: Safari/iPhone físico (IMG-RENDER no se toca).

## 1. Respuesta de tarjetas — 1000 tarjetas (JSON MiB / gzip MiB)

| Escenario | current | normalized | referenced | hybrid |
|---|---:|---:|---:|---:|
| sin imagen | 0.387 / 0.009 | 0.375 / 0.008 | 0.410 / 0.010 | 0.439 / 0.010 |
| fondo pequeño compartido | 42.076 / 31.687 | 0.375 / 0.008 | 0.437 / 0.010 | 0.475 / 0.010 |
| fondo mediano compartido | 333.744 / 251.372 | 0.375 / 0.008 | 0.437 / 0.010 | 0.475 / 0.010 |
| fondo grande compartido | 911.869 / 686.809 | **0.375 / 0.008** | 0.437 / 0.010 | 0.475 / 0.010 |
| fondos medianos distintos | 333.744 / 251.367 | 0.375 / 0.008 | 0.437 / 0.012 | 0.475 / 0.010 |
| `contentImage` 10% | 17.057 / 12.597 | 17.044 / 12.595 | 0.414 / 0.010 | 0.441 / 0.010 |
| `contentImage` 100% | 167.084 / 125.839 | 167.071 / 125.834 | 0.448 / 0.012 | 0.468 / 0.012 |

Lectura: el diccionario elimina el fondo repetido (−99.96% con fondo grande; 0.375 frente a 911.869 MiB). `contentImage` no se deduplica en `normalized` (igual que hoy); `referenced`/`hybrid` lo convierten en referencia, con el coste de 1 request por imagen.

## 2. Respuesta de tarjetas — 100 tarjetas (JSON MiB / gzip MiB)

| Escenario | current | normalized | referenced | hybrid |
|---|---:|---:|---:|---:|
| fondo pequeño compartido | 4.207 / 3.169 | 0.037 / 0.001 | 0.043 / 0.001 | 0.047 / 0.001 |
| fondo mediano compartido | 33.374 / 25.137 | 0.037 / 0.001 | 0.043 / 0.001 | 0.047 / 0.001 |
| fondo grande compartido | 91.187 / 68.681 | 0.037 / 0.001 | 0.043 / 0.001 | 0.047 / 0.001 |
| `contentImage` 100% | 16.708 / 12.584 | 16.707 / 12.583 | 0.045 / 0.002 | 0.047 / 0.002 |

A 20 y 500 tarjetas los valores son consistentes con la Fase 1A y con las tablas anteriores (ver raw-results.json). El contrato `current` a 1000 con fondo grande coincide con el modelo de la Fase 1A (911.85 → 911.87 MiB; dif. <0.01% por campos sintéticos del fixture).

## 3. Duplicación y parseo

- `current` 1000 fondo grande: 99.86% del JSON es la misma cadena repetida (`duplicatePercentOfJson`); copias lógicas: 1000.
- `normalized` 1000 fondo grande: **0.00% duplicación**; diccionario de 1 fondo; stringify/parse medianos 0.715 ms / 0.787 ms (MEASURED Node/V8) frente a `NOT RUN` para `current` (911 MiB supera el límite de string de V8 — sólo es modelable por streaming).

## 4. Lista de mazos (GET /api/decks/:userId) — JSON MiB / gzip MiB

| Mazos | Escenario | current | summary (sin imágenes) | thumb (sólo portada miniatura) | migration_dual (heredado + ids) |
|---:|---|---:|---:|---:|---:|
| 500 | sin imágenes | 0.235 / 0.004 | 0.217 / 0.004 | 0.235 / 0.004 | 0.248 / 0.004 |
| 500 | portadas | 21.080 / 15.870 | 0.217 / 0.004 | 13.580 / 10.054 | 21.093 / 15.877 |
| 500 | fondos | 62.774 / 47.279 | 0.217 / 0.004 | 0.235 / 0.004 | 62.804 / 47.295 |
| 500 | portada + fondos | 83.619 / 62.986 | **0.217 / 0.004** | 13.580 / 10.054 | 83.649 / 63.007 |

| Mazos | Escenario | current | summary | thumb |
|---:|---|---:|---:|---:|
| 100 | portadas | 4.22 / 3.17 | 0.04 / 0.00 | 2.72 / 2.01 |
| 100 | portada + fondos | 16.72 / 12.60 | 0.04 / 0.00 | 2.72 / 2.01 |

Lectura: **`cardBackgrounds` en la lista pesa ~63 MiB de los 83 MiB** con 500 mazos y **no tiene consumidores** (IDL-001). `summary` reduce la lista −99.7% (83.62 → 0.22 MiB) y el `JSON.stringify` síncrono de App/localStorage de 375.79 ms a 0.43 ms. `migration_dual` (onda de doble escritura conservando cadenas + ids) sólo añade ~0.03 MiB (0.04%): la convivencia es barata. `thumb` mantiene portada visual (−83.7% frente a `current`) con perfil ESTIMADO.

## 5. stringify/parse — lista de 500 mazos portada + fondos (MEASURED Node/V8)

| Contrato | stringify mediana | parse mediana |
|---|---:|---:|
| current | 375.79 ms | 70.92 ms |
| summary | 0.43 ms | 0.87 ms |
| thumb | 46.32 ms | 8.52 ms |
| migration_dual | 385.68 ms | 73.85 ms |

## 6. BSON — documento Deck con 3 fondos (MEASURED)

| Perfil | legacy (Data URL) | refs (asset ids) | ratio refs/legacy |
|---|---:|---:|---:|
| small | 171 KiB | 0.3 KiB | 0.0016 |
| medium | 1,366 KiB | 0.3 KiB | 0.0002 |
| large | 3,734 KiB | 0.3 KiB | 0.0001 |

Las referencias eliminan el peso del documento del mazo; la distancia al límite de documento de MongoDB con Data URL depende de la distribución real: **BLOCKED** (sin base representativa).

## 7. Requests en frío (MODELED)

| Contrato | Fondo compartido (1 único) | Fondos distintos (n) | contentImage 100% (n) |
|---|---|---|---|
| current / normalized | 1 | 1 | 1 |
| referenced / hybrid | 1 + 1 asset | 1 + n assets | 1 + n assets |

El diccionario (`normalized`) no añade requests; las referencias (`referenced`/`hybrid`) añaden 1 request por imagen única en frío, compensado por caché HTTP en cálido. En un mazo de 1000 tarjetas con 1 fondo compartido, `referenced` pagaría 1 request adicional; con fondos distintos, hasta 1000.

## 8. Almacenamiento local (MODELED)

`safeLocalStorage` intentaría escribir el JSON lógico: 500 mazos portada+fondos = 87,669,391 caracteres hoy (`current`), frente a 227,708 caracteres con `summary` (−99.7%). Los puntos de cuota observados en la Fase 1A (acepta 4.4 M, rechaza 13.2 M) sugieren que `summary` permanece muy por debajo del punto de fallo probado; no se declara una cuota universal.

## 9. Coherencia con la Fase 1A

- `current` reproduce las cifras de la Fase 1A (diferencia <0.01%): 911.85/911.87 MiB; 686.79/686.81 MiB gzip; 83.61/83.62 MiB y 62.98/62.99 MiB para la lista de 500.
- BSON del Deck (portada+1 fondo grande): la Fase 1A midió 1,911,677 B; esta fase mide 3,734 KiB para portada+3 fondos grandes, consistente (3× fondo).

## Limitaciones

- Todos los tamaños son del contrato en Node; no incluyen HTTP real, middleware de compresión del edge, parseo del navegador ni memoria raster.
- El perfil `thumb` es ESTIMADO por escalado de píxeles; el ahorro real de miniaturas depende del contenido.
- No hay base MongoDB representativa: latencia, `explain()` y selectividad son **BLOCKED**.
- `content_*` escenarios en `normalized` conservan el peso actual (no se deduplica contenido); la deduplicación de `contentImage` por diccionario es una extensión no medida.
- Las URL de `referenced`/`hybrid` son sintéticas (`/api/assets/...`); su longitud real no altera las conclusiones.
