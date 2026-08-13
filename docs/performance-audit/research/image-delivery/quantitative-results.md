# Resultados cuantitativos — contratos de entrega de imágenes (corregidos)

Versión corregida del harness `frontend/tests/performance/image-delivery/run-delivery-baseline.mjs` (Node 22, V8, sin dependencias nuevas; `bson` ya instalada). Comando:

```text
cd frontend
PERF_COMMIT=c7c169038d0197a97c6c96c5e14e2d1134deb9e0 \
  node --max-old-space-size=4096 tests/performance/image-delivery/run-delivery-baseline.mjs \
  /tmp/image-delivery-results.json
```

Resultado: 112 filas de respuestas de tarjetas (7 escenarios × 4 tamaños × 4 contratos), 60 filas de listas de mazos (4 escenarios × 3 tamaños × 5 contratos) y 3 filas BSON; 40,002 invariantes aprobadas. Detalle completo en [raw-results.json](./raw-results.json) (esquema `1.2.0`).

## Corrección aplicada

La versión anterior de `buildNormalizedCards()`/`buildHybridCards()` leía una propiedad inexistente (`bg`) de `cardImagesFor()` (que devuelve `bgImage`), omitiendo los fondos. Ahora ambos constructores recorren todas las tarjetas, registran cada fondo único exactamente una vez y asignan `bgImageIndex` dentro de rango (`-1` si no hay fondo). El diccionario `normalized` incluye una copia real de cada fondo; `hybrid` genera una entrada de miniatura por fondo único con IDs únicos.

## Clasificación

- Contratos de tarjetas: `current` (serializadores vigentes), `normalized` (diccionario + `bgImageIndex`), `referenced` (referencias de asset, sin bytes en JSON), `hybrid` (miniaturas inline + referencias full).
- Contratos de listas de mazos: `current`, `without_backgrounds` (Corte 1: sin `cardBackgrounds`, portada completa), `metadata_only` (control: sin portada ni fondos), `thumbnail_summary` (Corte 2: portada en miniatura, sin fondos), `migration_dual` (heredado + ids).
- Tamaños JSON: **MODELED** (reproducción byte a byte de la forma de respuesta). gzip (nivel 6) y tiempos Node/V8 (stringify/parse, 5 repeticiones): **MEASURED** sobre el modelo. Perfil `thumb` (256×144, 20,480 B binarios) y bytes externos de assets: **ESTIMATED**. BSON: **MEASURED** con `bson@7.3.1` presente en `backend/node_modules`. Requests en frío: **MODELED**.
- `externalAssetBytes` son bytes de recursos **fuera del JSON** (binario estimado por perfil, no Base64); nunca se suman a `jsonUtf8Bytes` ni a `imageUtf8Bytes`.
- **BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE**: sin `explain()`, latencia, CPU ni plan MongoDB. **PENDING — DEVICE REQUIRED**: Safari/iPhone físico (IMG-RENDER no se toca).

## 1. Respuesta de tarjetas — 1000 tarjetas (JSON MiB / gzip MiB)

| Escenario | current | normalized | referenced | hybrid |
|---|---:|---:|---:|---:|
| sin imagen | 0.387 / 0.009 | 0.375 / 0.008 | 0.410 / 0.010 | 0.439 / 0.010 |
| fondo pequeño compartido | 42.076 / 31.687 | 0.415 / 0.041 | 0.437 / 0.010 | 0.501 / 0.031 |
| fondo mediano compartido | 333.744 / 251.372 | 0.707 / 0.260 | 0.437 / 0.010 | 0.501 / 0.031 |
| fondo grande compartido | 911.869 / 686.809 | **1.285 / 0.695** | 0.437 / 0.010 | 0.501 / 0.031 |
| fondos medianos distintos | 333.744 / 251.367 | 333.736 / 251.100 | 0.437 / 0.012 | 27.194 / 20.114 |
| `contentImage` 10% | 17.057 / 12.597 | 17.044 / 12.595 | 0.414 / 0.010 | 0.441 / 0.010 |
| `contentImage` 100% | 167.084 / 125.839 | 167.071 / 125.834 | 0.449 / 0.012 | 0.469 / 0.012 |

Lectura honesta:

- `normalized` elimina la **repetición** del fondo compartido, pero conserva **una copia real**: 1.285 MiB con fondo grande (0.911 MiB de diccionario + 0.375 MiB de metadatos de 1000 tarjetas) frente a 911.869 MiB (−99.86%).
- Con 1000 fondos **distintos** no hay ahorro: 333.736 MiB frente a 333.744 MiB (−0.002%), porque cada fondo es único y viaja una vez en el diccionario. El diccionario evita duplicación, no comprime imágenes únicas.
- `contentImage` no se deduplica en `normalized` (igual que hoy): 167.071 MiB con contenido al 100%.
- `hybrid` sólo transporta miniaturas en el JSON (1 por fondo único; 27.3 KiB ESTIMADO cada una): 0.501 MiB con fondo grande compartido y **27.194 MiB con 1000 fondos distintos**; la resolución completa se obtiene con requests separados.
- `referenced` deja el JSON mínimo (0.437–0.449 MiB) y traslada todos los bytes a requests externos.

## 2. Respuesta de tarjetas — 100 tarjetas (JSON MiB / gzip MiB)

| Escenario | current | normalized | referenced | hybrid |
|---|---:|---:|---:|---:|
| sin imagen | 0.039 / 0.001 | 0.037 / 0.001 | 0.041 / 0.001 | 0.044 / 0.001 |
| fondo pequeño compartido | 4.207 / 3.169 | 0.079 / 0.033 | 0.043 / 0.001 | 0.074 / 0.022 |
| fondo mediano compartido | 33.374 / 25.137 | 0.371 / 0.252 | 0.043 / 0.001 | 0.074 / 0.022 |
| fondo grande compartido | 91.187 / 68.681 | 0.949 / 0.688 | 0.043 / 0.001 | 0.074 / 0.022 |
| fondos medianos distintos | 33.374 / 25.137 | 33.373 / 25.110 | 0.043 / 0.002 | 2.719 / 2.012 |
| `contentImage` 10% | 1.705 / 1.260 | 1.704 / 1.260 | 0.041 / 0.001 | 0.044 / 0.001 |
| `contentImage` 100% | 16.708 / 12.584 | 16.707 / 12.583 | 0.045 / 0.002 | 0.047 / 0.002 |

A 20 y 500 tarjetas los valores siguen la misma relación (ver raw-results.json). El contrato `current` a 1000 con fondo grande coincide con el modelo de la Fase 1A (911.85 → 911.87 MiB; dif. <0.01% por campos sintéticos del fixture).

## 3. Duplicación y parseo

- `current` 1000 fondo grande: 99.86% del JSON es la misma cadena repetida (`duplicatePercentOfJson`); copias lógicas: 1000.
- `normalized` 1000 fondo grande: **0.00% duplicación**; diccionario de 1 fondo (0.911 MiB); stringify/parse medianos **4.6 ms / 0.8 ms** (MEASURED Node/V8) frente a `NOT RUN` para `current` (911 MiB supera el límite de string de V8 — sólo es modelable por streaming).
- `normalized` 1000 fondos distintos: dict de 1000 fondos; stringify/parse medianos 1536.2 ms / 80.7 ms (MEASURED); el tamaño no baja porque no hay repetición que eliminar.

## 4. Lista de mazos (GET /api/decks/:userId) — JSON MiB / gzip MiB

| Mazos | Escenario | current | without_backgrounds | metadata_only | thumbnail_summary | migration_dual |
|---:|---|---:|---:|---:|---:|---:|
| 500 | sin imágenes | 0.225 / 0.004 | 0.215 / 0.004 | 0.207 / 0.004 | 0.217 / 0.004 | 0.238 / 0.004 |
| 500 | portadas | 21.070 / 15.863 | 21.060 / 15.854 | 0.207 / 0.004 | 13.563 / 10.054 | 21.083 / 15.869 |
| 500 | fondos | 62.764 / 47.271 | 0.215 / 0.004 | 0.207 / 0.004 | 0.217 / 0.004 | 62.794 / 47.287 |
| 500 | portada + fondos | 83.609 / 62.979 | **21.060 / 15.854** | 0.207 / 0.004 | 13.563 / 10.054 | 83.639 / 62.999 |

| Mazos | Escenario | current | without_backgrounds | metadata_only | thumbnail_summary |
|---:|---|---:|---:|---:|---:|
| 100 | portadas | 4.212 / 3.171 | 4.212 / 3.171 | 0.041 / 0.001 | 2.712 / 2.011 |
| 100 | portada + fondos | 16.722 / 12.596 | 4.212 / 3.171 | 0.041 / 0.001 | 2.712 / 2.011 |

Lectura:

- **`cardBackgrounds` en la lista pesa ~62.5 MiB de los 83.6 MiB** con 500 mazos portada + 3 fondos y **no tiene consumidores** (IDL-001). `without_backgrounds` —el **Corte 1** recomendado— conserva la portada completa: **21.06 MiB / 15.85 MiB** (−74.8%).
- `metadata_only` (0.207 MiB) es **sólo un control**: elimina también la portada, no es el contrato propuesto.
- `thumbnail_summary` (Corte 2, ESTIMADO): 13.56 MiB con miniaturas de portada (500 × ~27.3 KiB).
- `migration_dual` (doble escritura conservando cadenas + ids) añade ~0.03 MiB (+0.04%): la convivencia es barata.

## 5. stringify/parse — lista de 500 mazos portada + fondos (MEASURED Node/V8)

| Contrato | stringify mediana | parse mediana |
|---|---:|---:|
| current | 368.60 ms | 75.98 ms |
| without_backgrounds | 81.98 ms | 21.26 ms |
| metadata_only | 0.40 ms | 0.45 ms |
| thumbnail_summary | 47.13 ms | 9.06 ms |
| migration_dual | 369.90 ms | 69.79 ms |

## 6. BSON — documento Deck con 3 fondos (MEASURED)

| Perfil | legacy (Data URL) | refs (asset ids) | ratio refs/legacy |
|---|---:|---:|---:|
| small | 171 KiB | 0.3 KiB | 0.0016 |
| medium | 1,366 KiB | 0.3 KiB | 0.0002 |
| large | 3,734 KiB | 0.3 KiB | 0.0001 |

Las referencias eliminan el peso del documento del mazo; la distancia al límite de documento de MongoDB con Data URL depende de la distribución real: **BLOCKED** (sin base representativa).

## 7. Requests en frío y bytes externos (MODELED/ESTIMATED, fuera del JSON)

| Contrato | Escenario | Requests fríos | Bytes externos (binario estimado) | Bytes en JSON |
|---|---|---|---|---|
| current / normalized | cualquier | 0 | 0 | todos |
| referenced | fondo compartido (1 único) | 1 | ~0.7 MiB (large) | 0.437 MiB |
| referenced | 1000 fondos distintos | 1000 | ~250.0 MiB | 0.437 MiB |
| referenced | contentImage 100% (1000) | 1000 | ~125.0 MiB | 0.449 MiB |
| hybrid | fondo compartido (1) | 1 (full) | ~0.7 MiB (large) | 0.501 MiB (miniatura inline) |
| hybrid | 1000 fondos distintos | 1000 (full) | ~250.0 MiB | 27.194 MiB (1000 miniaturas) |
| hybrid | contentImage 100% (1000) | 1000 (full) | ~125.0 MiB | 0.469 MiB (sin miniaturas de fondo) |

`referenced` paga 1 request por asset único en frío; `hybrid` paga 1 request full por fondo único y por contenido, con las miniaturas inline en el JSON. En un mazo de 1000 tarjetas con 1 fondo compartido, ambos añaden 1 request; con fondos distintos, hasta 1000.

## 8. Almacenamiento local (MODELED)

`safeLocalStorage` intentaría escribir el JSON lógico de la lista: 500 mazos portada + fondos ≈ **87,664,087 caracteres** hoy (`current`), frente a **22,082,266** con `without_backgrounds` (−74.8%), **217,090** con `metadata_only` (−99.8%) y **14,221,570** con `thumbnail_summary` (−83.8%). Los puntos de cuota observados en la Fase 1A (acepta 4.4 M, rechaza 13.2 M) sugieren que `without_backgrounds` a 500 mazos podría seguir cerca o por encima del punto de fallo probado con portadas completas; no se declara una cuota universal y la decisión de portada completa vs miniatura es de producto.

## 9. Coherencia con la Fase 1A

- `current` reproduce las cifras de la Fase 1A (diferencia <0.01%): 911.85/911.87 MiB; 686.79/686.81 MiB gzip; 83.61/83.62 MiB y 62.98/62.99 MiB para la lista de 500.
- BSON del Deck (portada+3 fondos grandes): 3,734 KiB, consistente con el dato de la Fase 1A para 1 fondo (1,911,677 B) escalado a 3.

## Limitaciones

- Todos los tamaños son del contrato en Node; no incluyen HTTP real, middleware de compresión del edge, parseo del navegador ni memoria raster.
- El perfil `thumb` y los bytes externos son ESTIMATED; el ahorro real de miniaturas depende del contenido y del codec.
- No hay base MongoDB representativa: latencia, `explain()` y selectividad son **BLOCKED**.
- `content_*` escenarios en `normalized` conservan el peso actual (no se deduplica contenido); la deduplicación de `contentImage` por diccionario es una extensión no medida.
- Las URL de `referenced`/`hybrid` son sintéticas (`/api/assets/...`); su longitud real no altera las conclusiones.
