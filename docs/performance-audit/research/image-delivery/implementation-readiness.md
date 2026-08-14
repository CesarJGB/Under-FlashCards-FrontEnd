# Estado de preparación para implementar

Esta fase **recomienda** implementar la [arquitectura recomendada](./recommended-architecture.md) (Alternativa A en la primera onda). No la autoriza: la autorización final es humana, con los puntos pendientes abajo.

## Definiciones exigidas por la fase

| Requisito | Estado | Dónde |
|---|---|---|
| Contrato objetivo | **GO** — diccionario `backgrounds` + `bgImageIndex`; resumen de mazo sin `cardBackgrounds` | [recommended-architecture.md](./recommended-architecture.md) |
| Compatibilidad heredada | **GO** — campo dual `bgImage` para clientes sin versión; índice `-1`/diccionario vacío | [migration-rollout-rollback.md](./migration-rollout-rollback.md) |
| Migración | **GO (onda 1)** — sin migración de datos; assets (Corte 3) requieren decisión humana; herramienta del Corte 4 implementada (migración NOT RUN) | [migration-rollout-rollback.md](./migration-rollout-rollback.md) |
| Rollback | **GO** — C1/C2 reversibles desplegando backend previo; C5 sin rollback limpio por diseño | [implementation-cuts.md](./implementation-cuts.md) |
| Autorización | **PARTIAL** — la onda 1 no añade recursos; la lectura de mazos/tarjetas sigue sin protección efectiva (IDL-005); assets futuros requieren diseño | [current-image-contract.md](./current-image-contract.md) §9 |
| Eliminación de assets | **PARTIAL** — GC definido (Corte 4) pero sin ejecutar; huérfanos preexistentes (IDL-003) | [implementation-cuts.md](./implementation-cuts.md) Corte 4 |
| Caché e invalidación | **PARTIAL** — contrato resumen reduce stringify/parse; política de TTL/invalidación y dueño de revalidación pendientes (no tocar `?t=` aún) | [consumer-compatibility-matrix.md](./consumer-compatibility-matrix.md) |
| Comportamiento offline | **GO** — sin nuevas peticiones en onda 1; assets requieren caché de recursos | [alternatives-comparison.md](./alternatives-comparison.md) |
| Consumidores | **GO** — matriz campo→consumidor completa; `cardBackgrounds` sin consumidores (IDL-001) | [consumer-compatibility-matrix.md](./consumer-compatibility-matrix.md) |
| Criterios de aceptación | **GO** — presupuestos por contrato y métricas por corte | [implementation-cuts.md](./implementation-cuts.md) |

## Gates

| Gate | Estado | Evidencia | Bloqueos | ¿Autoriza implementación? |
|---|---|---|---|---|
| IMG-CONTRACT | **GO** | shape objetivo y legacy definidos y medidos (raw-results.json, contratos `current`/`normalized`); consumidores inventariados | ninguno para C1 | Sí, para Corte 1 tras aprobación humana |
| IMG-STORAGE | **PARTIAL** | onda 1 sin cambio de almacenamiento (cero riesgo); BSON refs vs legacy medido (0.3 KiB vs 3,734 KiB) | decisión humana sobre Corte 3 (proveedor/almacenamiento); sin base MongoDB representativa | No para assets; sí para C1 (no toca storage) |
| IMG-MIGRATION | **GO** | onda 1 sin migración de datos; dual-write modelado (+0.04% en lista); plan por cortes | migración de assets exige entorno de staging y aprobación | Sí para C1/C2; No para C3 sin aprobación |
| IMG-CACHE | **PARTIAL** | contratos de resumen cuantificados con el baseline corregido: Corte 1 `without_backgrounds` con reducción aproximada de 74.8% y `stringify` ≈ 81.98 ms (puede seguir excediendo cuotas locales con 500 portadas completas); `metadata_only` con reducción cercana a 99.8% y `stringify` cercano a 0.4 ms (sólo control, no conserva apariencia); Corte 2 `thumbnail_summary` con reducción aproximada de 83.8% y `stringify` ≈ 47.13 ms (miniaturas pendientes de decisión humana); caché HTTP real sólo con assets | política TTL/invalidación, dueño de revalidación, fallback `safeLocalStorage` | No: diseñar política antes de tocar cachés |
| IMG-CONSUMERS | **GO** | matriz completa; cero consumidores de `cardBackgrounds`; consumidores de `bgImage` mapeados | — | Sí, para C1 (resolver en cliente) |
| IMG-IMPLEMENTATION | **PARTIAL** | recomendación con cortes, presupuestos, rollback y dependencias | aprobación humana de: cabecera de versión/dual, alcance de `contentImage`, miniaturas, política de caché, GC, futuro storage | No: requiere aprobación humana |

## Puntos que requieren aprobación humana (lista corta)

1. Negociación de versión durante la transición (cabecera `Accept`/campo dual) y duración del periodo legacy.
2. Alcance de `contentImage` (deduplicar o no).
3. Miniaturas: presupuesto visual/bytes y dónde se generan (Corte 2/3).
4. Política de caché e invalidación antes de modificar `?t=` o `safeLocalStorage`.
5. GC de fondos huérfanos y límites/presupuestos por mazo.
6. Si se desea almacenamiento de assets (Corte 3): cuándo, dónde y con qué proveedor — requiere nueva fase de medición con distribución real (BLOCKED hoy).

## Qué debe pasar para continuar la implementación

- César aprobó los puntos 1–4 para el Corte 1 (negociación por `?contract=indexed`, `contentImage` por tarjeta, miniaturas diferidas, caché diferido) y el Corte 1 está **TERMINADO** (Fase 1D).
- César autorizó el **Corte 2** (miniaturas generadas en el frontend, almacenadas como campo opcional `coverImageThumb`, sin migración ni backfill) y el Corte 2 está **TERMINADO** (Fase 1E).
- **Corte 3**: omitido deliberadamente (assets/almacenamiento externo); si algún día se retoma, requiere aprobación humana de los puntos 4 (política de caché), 5 (GC de fondos huérfanos) y 6 (almacenamiento de assets).
- **Corte 4 (limitado)**: la herramienta está terminada (Fase 1F), pero **aplicarla contra una base real requiere autorización explícita** y las precondiciones del [phase-1f-cut-4-report.md](./phase-1f-cut-4-report.md): backup verificado, ventana de mantenimiento y MongoDB con soporte de transacciones. La migración de producción sigue **NOT RUN**.
- **Corte 5A**: terminado (Fase 1G, [phase-1g-cut-5a-report.md](./phase-1g-cut-5a-report.md)): telemetría temporal y segura del contrato legacy en las cinco lecturas (una línea JSON estable por petición, sin PII ni contadores; contrato legacy intacto). De las cinco superficies, tres son **activas** en el frontend productivo (`deck-list`, `deck-cards`, `all-cards` — ambos modos de repaso usan `all-cards` vía `SessionPlayer.jsx`) y dos **dormidas** (`continuous-session`, `normal-session`, rutas de compatibilidad sin consumidores frontend). La ventana de observación de 14 días está **OBSERVATION NOT STARTED**: comienza sólo tras desplegar el SHA del Corte 5A; cualquier petición legacy produce **NO-GO** y reinicia la ventana; la ausencia total de tráfico no demuestra readiness.
- **Corte 5B**: **BLOCKED** hasta aprobar los 14 días completos con **cero peticiones legacy** en las cinco rutas, **tráfico indexado positivo** en las tres superficies activas (Home/Library → `deck-list`; abrir mazo y PDF → `deck-cards`; repaso normal/continuo → `all-cards`), **ausencia estática de consumidores productivos** en las dos rutas dormidas (`continuous-session`, `normal-session`; no se exige tráfico en ellas) y **comprobación funcional de las escrituras** (crear/editar/borrar, lote/importación), aunque no produzcan eventos 5A. El alcance del 5B (indexadas por defecto, retiro de negociación y ramas legacy, ACK indexados, adaptación de consumidores, revisión del pipeline IA V1, retiro de `Flashcard.serialize()` sólo sin usos, retiro del fallback legacy del resolver, retiro de la telemetría temporal) está documentado en el reporte del 5A; no se implementa en la Fase 1G.
- Se confirma que las suites existentes siguen verdes en el HEAD de trabajo (Fase 1E: contratos 51/51 backend y 74/74 frontend; manual-editor 58/58, schedule 44/44, pdf-extraction 8/8, build OK).
- No se requiere cierre de IMG-RENDER (PENDING — DEVICE REQUIRED) para los cortes 1–2, que no cambian render ni efectos: se documenta que el beneficio de rendimiento percibido se validará después con dispositivo físico.

## Estado del Corte 0 (Fase 1C), del Corte 1 (Fase 1D) y del Corte 2 (Fase 1E)

- **Corte 0 — TERMINADO** ([phase-1c-cut-0-report.md](./phase-1c-cut-0-report.md)): contratos legacy y objetivo congelados mediante fixtures; 36/36 contract tests en verde (18 backend + 18 frontend); resolver cliente de referencia dentro del árbol de pruebas; sin cambios productivos. Suites de caracterización del plan: manual-editor 58/58, schedule 44/44, pdf-extraction 8/8.
- **Corrección de precedencia aplicada (post-cierre)**: el resolver de referencia usa `bgImageIndex` cuando la tarjeta lo posee e ignora `bgImage`; `bgImage` es fallback exclusivo para shapes sin `bgImageIndex`, coincidiendo con [migration-rollout-rollback.md](./migration-rollout-rollback.md) (§Convivivencia dual). Fixtures legacy sin `bgImageIndex`; pruebas duales A–F añadidas.
- **Corte 1 — TERMINADO** ([phase-1d-cut-1-report.md](./phase-1d-cut-1-report.md)): lecturas negociadas con `?contract=indexed` (`getCardsByDeck`, `continuous-session`, `normal-session`, `all-cards`, lista de mazos sin `cardBackgrounds`); utilidad productiva única `backend/src/utils/imageDelivery.js` y resolver `frontend/src/lib/imageDelivery.js`; contrato legacy intacto por defecto; escrituras sin cambios; 34+36 contract tests en verde; presupuestos A/B/C cumplidos con la implementación productiva.
- **Corte 2 — TERMINADO** ([phase-1e-cut-2-report.md](./phase-1e-cut-2-report.md)): contrato ligero de lista `?contract=indexed&cover=thumbnail` con `coverImageThumb` opcional; miniaturas generadas en el frontend (`frontend/src/lib/coverThumbnail.js`, canvas/WebP, presupuesto ~24 KiB, sin dependencias nuevas); campo opcional `coverImageThumb` en `Deck` sin migración ni backfill; fallback a `coverImage` para mazos antiguos; protección del flujo de edición (`buildDeckCoverPayload`, `coverChanged`); presupuesto de 500 mazos con miniatura cumplido (11.91 MiB ≤ 15 MiB; mediana stringify 43.81 ms ≤ 60 ms) con la implementación productiva; 51 contract tests backend y 74 frontend en verde.
- **Corte 3 — OMITIDO deliberadamente** (assets/almacenamiento externo, miniaturas servidas, GC de assets): exige decisión humana de proveedor/presupuesto y una fase de medición con distribución real; no se implementó en la Fase 1F.
- **Corte 4 (limitado) — HERRAMIENTA TERMINADA, migración NOT RUN** ([phase-1f-cut-4-report.md](./phase-1f-cut-4-report.md)): normalización segura de `cardBackgrounds` — planificador puro (`backend/src/utils/imageBackgroundCompaction.js`), parseo puro de argumentos (`imageBackgroundMigrationArgs.js`), script `npm run migrate:image-backgrounds` (dry-run por defecto; apply con transacciones, `--backup-confirmed`, `--maintenance-confirmed` y verificación de soporte de transacciones antes de la primera escritura) y 45 pruebas deterministas. **La migración de producción queda expresamente NOT RUN**; no se modificó el flujo runtime (no hay limpieza automática en crear/actualizar/borrar tarjetas).
- Bloqueo preexistente documentado: 5 tests backend (`aiService.test.js`, `deckRecovery.test.js`) fallan por configuración de modelo IA del entorno, idénticos en el HEAD anterior `b0b36e6` y sin cambios en `e4d86aa`, `0921717`, en la Fase 1E, en la Fase 1F ni en la Fase 1G.
- **Corte 5A — TERMINADO** (Fase 1G, [phase-1g-cut-5a-report.md](./phase-1g-cut-5a-report.md)): telemetría temporal del contrato legacy (utilidad pura + instrumentación de las cinco lecturas + 21 pruebas deterministas; contrato legacy intacto; contract tests 51/51 y `test:image-delivery` 74/74 en verde). De las cinco superficies, `deck-list`, `deck-cards` y `all-cards` son **activas** en el frontend productivo; `continuous-session` y `normal-session` son rutas de compatibilidad **dormidas** sin consumidores frontend. **OBSERVATION NOT STARTED**: la ventana de 14 días comienza tras el despliegue.
- **Corte 5B — BLOCKED** (requiere aprobar los 14 días de observación: cero peticiones legacy en las cinco rutas, tráfico indexado positivo en las tres superficies activas y ausencia estática de consumidores en las dos dormidas — sin exigir tráfico en ellas; las escrituras se comprueban funcionalmente aunque no generen eventos 5A). IMG-RENDER permanece PARTIAL — PENDING — DEVICE REQUIRED.

## Estado final de esta fase

| Item | Estado |
|---|---|
| IMG-DATA | GO (heredado) |
| IMG-RENDER | PARTIAL — PENDING — DEVICE REQUIRED (sin cambios; no se cierra en la Fase 1E) |
| IMG-CACHE | PARTIAL (sin cambios; política TTL/invalidación pendiente; `?t=` intacto) |
| IMG-STORAGE | PARTIAL (sin cambios; almacenamiento intacto en el Corte 2) |
| Investigación de entrega | COMPLETA |
| Implementación | Cortes 0, 1, 2 y 5A TERMINADOS (Fases 1C/1D/1E/1G); Corte 3 OMITIDO deliberadamente; Corte 4 (limitado) HERRAMIENTA TERMINADA — migración NOT RUN (Fase 1F); Corte 5B BLOCKED hasta aprobar los 14 días de observación |
