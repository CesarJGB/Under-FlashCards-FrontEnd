# Estado de preparación para implementar

Esta fase **recomienda** implementar la [arquitectura recomendada](./recommended-architecture.md) (Alternativa A en la primera onda). No la autoriza: la autorización final es humana, con los puntos pendientes abajo.

## Definiciones exigidas por la fase

| Requisito | Estado | Dónde |
|---|---|---|
| Contrato objetivo | **GO** — diccionario `backgrounds` + `bgImageIndex`; resumen de mazo sin `cardBackgrounds` | [recommended-architecture.md](./recommended-architecture.md) |
| Compatibilidad heredada | **GO** — campo dual `bgImage` para clientes sin versión; índice `-1`/diccionario vacío | [migration-rollout-rollback.md](./migration-rollout-rollback.md) |
| Migración | **GO (onda 1)** — sin migración de datos; assets (Corte 3) requieren decisión humana | [migration-rollout-rollback.md](./migration-rollout-rollback.md) |
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

## Qué debe pasar para pasar a implementación

- César aprueba los puntos 1–6 (o el subconjunto del primer corte).
- Se ejecuta el Corte 0 (contract tests) y se congela un entorno de staging.
- Se confirma que las suites existentes siguen verdes en el HEAD de trabajo.
- No se requiere cierre de IMG-RENDER (PENDING — DEVICE REQUIRED) para los cortes 1–2, que no cambian render ni efectos: se documenta que el beneficio de rendimiento percibido se validará después con dispositivo físico.

## Estado del Corte 0 (Fase 1C)

- **Corte 0 — TERMINADO** ([phase-1c-cut-0-report.md](./phase-1c-cut-0-report.md)): contratos legacy y objetivo congelados mediante fixtures; 36/36 contract tests en verde (18 backend + 18 frontend); resolver cliente de referencia dentro del árbol de pruebas; sin cambios productivos. Suites de caracterización del plan: manual-editor 58/58, schedule 44/44, pdf-extraction 8/8.
- **Corrección de precedencia aplicada (post-cierre)**: el resolver de referencia usa `bgImageIndex` cuando la tarjeta lo posee e ignora `bgImage`; `bgImage` es fallback exclusivo para shapes sin `bgImageIndex`, coincidiendo con [migration-rollout-rollback.md](./migration-rollout-rollback.md) (§Convivivencia dual). Fixtures legacy sin `bgImageIndex`; pruebas duales A–F añadidas.
- Bloqueo preexistente documentado: 5 tests backend (`aiService.test.js`, `deckRecovery.test.js`) fallan por configuración de modelo IA del entorno, idénticos en el HEAD anterior `b0b36e6`.
- **Corte 1 — NO implementado** (requiere aprobación humana de los puntos 1–6). IMG-RENDER permanece PARTIAL — PENDING — DEVICE REQUIRED.

## Estado final de esta fase

| Item | Estado |
|---|---|
| IMG-DATA | GO (heredado) |
| IMG-RENDER | PARTIAL — PENDING — DEVICE REQUIRED (sin cambios) |
| Investigación de entrega | COMPLETA |
| Implementación | NO — recomendada, pendiente de aprobación humana |
