# Fase 1B — Investigación de arquitectura de entrega de imágenes

## Objetivo y alcance

Esta fase cierra la investigación abierta por la [Fase 1A](../../experiments/image-baseline/README.md) (`IMG-DATA = GO`): decide, con evidencia cuantitativa, cómo eliminar la duplicación de imágenes Base64, aligerar Library/materias y la carga de mazos, y preparar miniaturas y caché **sin romper** editor, repaso, sesiones, PDF, importación/exportación u offline.

No implementa nada en producción. No instala infraestructura. No modifica UX, contrato de API, modelos, controladores ni dependencias. Termina con una recomendación técnica concreta, un plan por cortes y una tabla de gates para aprobación humana.

## Preparación y versión investigada

| Dato | Resultado |
|---|---|
| Fecha UTC inicial | `2026-08-12T22:40:00Z` |
| Rama | `main` |
| HEAD inicial | `245bbc03450143d94cd5d10e01cca6efb1e7f659` |
| `origin/main` tras `git fetch origin` | `245bbc03450143d94cd5d10e01cca6efb1e7f659` |
| HEAD observado indicado en el encargo | `245bbc03450143d94cd5d10e01cca6efb1e7f659` |
| Drift | Ninguno: `HEAD == origin/main == HEAD observado` |
| Estado inicial del árbol | `?? .agents/` y `?? package-lock.json` (preexistentes, ajenos) |

Las entradas no rastreadas no se modificaron, no se leyeron como evidencia y no entran en el commit.

## Cómo leer esta carpeta

- [current-image-contract.md](./current-image-contract.md): recorrido completo de cada clase de imagen (portada, fondo compartido, contenido) desde el archivo seleccionado hasta cada consumidor, con rutas, símbolos y líneas.
- [consumer-compatibility-matrix.md](./consumer-compatibility-matrix.md): matriz de consumidores con datos mínimos, momento, resolución, offline, autorización, caché, compatibilidad heredada y riesgo.
- [alternatives-comparison.md](./alternatives-comparison.md): comparación de las cuatro familias obligatorias (A normalización mínima, B assets backend, C object storage, D híbrida) sobre ~30 dimensiones.
- [quantitative-results.md](./quantitative-results.md): mediciones del harness `frontend/tests/performance/image-delivery/`, con clasificación MEASURED / STATICALLY CONFIRMED / MODELED / ESTIMATED / BLOCKED / NOT RUN / PENDING — DEVICE REQUIRED.
- [recommended-architecture.md](./recommended-architecture.md): alternativa recomendada, respaldo y decisión cuantificada.
- [migration-rollout-rollback.md](./migration-rollout-rollback.md): migración gradual, convivencia dual y rollback.
- [implementation-cuts.md](./implementation-cuts.md): plan por cortes (Corte 0 a Corte 5) con contratos, pruebas, métricas de aceptación, rollback y riesgos.
- [implementation-readiness.md](./implementation-readiness.md): gates de implementación y autorizaciones pendientes.
- [raw-results.json](./raw-results.json): esquema `1.1.0`, 163 resultados de contrato (112 respuestas de tarjetas, 48 listas de mazos, 3 BSON). Sólo tamaños y tiempos; no contiene Base64.

El harness está en `frontend/tests/performance/image-delivery/run-delivery-baseline.mjs` (no productivo; sin dependencias nuevas; reutiliza la `bson` ya instalada en `backend/node_modules`).

## Resumen ejecutivo

La duplicación de imágenes no es un problema de almacenamiento sino de **contrato de salida**:

1. **El fondo compartido se expande por tarjeta en la respuesta.** Con el contrato actual, 1000 tarjetas con un fondo grande compartido son **911.87 MiB JSON / 686.81 MiB gzip**, de los que 99.86% son la misma cadena repetida. El mismo escenario con un diccionario de fondos + índice (Alternativa A) baja a **0.375 MiB JSON / 0.008 MiB gzip** (reducción ~99.96%).
2. **La lista de mazos transporta campos que ningún consumidor usa.** `cardBackgrounds` no tiene **ningún** consumidor en el frontend (verificado estáticamente; sólo aparece en el harness de pruebas). `Deck.serialize()` lo incluye igualmente en `GET /api/decks/:userId`, que App además copia a `safeLocalStorage`. Con 500 mazos con portada + 3 fondos, la lista cae de **83.62 MiB JSON / 62.99 MiB gzip** a **0.22 MiB / 0.004 MiB** si el resumen no lleva imágenes de fondo.
3. **El cambio mínimo con mayor impacto es de serialización, no de infraestructura.** No requiere S3, GridFS, miniaturas servidas ni nuevos endpoints para capturar el 99.7–99.96% del peso repetido.

**Recomendación**: adoptar la **Alternativa A (diccionario de fondos + índice en la respuesta de tarjetas y resumen de mazo sin `cardBackgrounds`)** como primera onda de implementación, conservando el almacenamiento actual (Data URL en MongoDB). **Respaldo**: la **Alternativa D (híbrida)**, añadiendo miniaturas y referencias de asset cuando Library necesite menos bytes aún o el render lo exija. B (assets en backend) y C (object storage) quedan documentadas como opciones futuras de mayor coste y riesgo, sin decisión de proveedor.

Los detalles, cifras y matices por alternativa están en [recommended-architecture.md](./recommended-architecture.md). La implementación sigue sin estar autorizada: requiere la aprobación de los puntos de [implementation-readiness.md](./implementation-readiness.md).

## Gates de la fase

| Gate | Estado | Detalle |
|---|---|---|
| IMG-DATA | **GO** (heredado de 1A) | compara contratos con la misma matriz; no elige proveedor |
| IMG-RENDER | **PARTIAL** (heredado de 1A) | **PENDING — DEVICE REQUIRED**; no se cerró ni se repitió |
| IMG-CONTRACT | **GO** | contrato objetivo definido y cuantificado |
| IMG-STORAGE | **PARTIAL** | primera onda sin cambio de almacenamiento; object storage diferido |
| IMG-MIGRATION | **GO** | onda 1 no requiere migración de datos; dual read compatible |
| IMG-CACHE | **PARTIAL** | política de invalidación/TTL pendiente de decisión humana |
| IMG-CONSUMERS | **GO** | inventario campo→consumidor completo |
| IMG-IMPLEMENTATION | **PARTIAL** | recomendado, requiere aprobación humana |

## Clasificación usada

- **MEASURED**: el comando produjo directamente el valor (gzip, tiempos Node/V8, BSON, pruebas).
- **STATICALLY CONFIRMED**: el flujo se demostró siguiendo archivo/símbolo/línea.
- **MODELED**: reproducción determinista del contrato en Node, sin afirmar tráfico real.
- **ESTIMATED**: fórmula y supuestos explícitos (perfil de miniatura).
- **BLOCKED**: sin base MongoDB representativa ni captura de dispositivo.
- **NOT RUN**: medición no ejecutada y no presentada como aprobada.
- **PENDING — DEVICE REQUIRED**: iPhone/Safari físico.

## Limitaciones

- **BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE**: no hubo `explain()`, latencia, CPU ni plan MongoDB real.
- WebKit headless no equivale a Safari/iPhone; IMG-RENDER permanece PARTIAL.
- Los perfiles de imagen son bytes sintéticos deterministas y un perfil de miniatura ESTIMADO; no son fotografías reales.
- No se midió compresión del edge/API en producción (cabeceras reales).
- No se verificó la cuota de localStorage en dispositivos reales; sólo se modeló el tamaño de escritura.
