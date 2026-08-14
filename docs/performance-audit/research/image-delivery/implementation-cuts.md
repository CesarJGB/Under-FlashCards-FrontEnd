# Plan de implementación por cortes

Plan de trabajo futuro, pequeño y reversible. **No se implementa en esta fase.** Cada corte define archivos probables, contratos, migración, compatibilidad dual, pruebas, métricas de aceptación, rollback, riesgos y dependencias.

Dependencias estrictas: `C0 → C1 → C2 → C3/C4 → C5`. C1 no puede omitir C0; C5 sólo existe tras métricas de C1-C4.

---

## Corte 0 — Contratos y pruebas de caracterización

**Objetivo**: congelar el comportamiento actual y los contract tests de ambos shapes antes de tocar producción.

- Archivos probables: `backend/test/` (contract tests nuevos), `frontend/tests/` (tests del resolver de diccionario), `backend/src/models/Flashcard.js` (sólo si se añade un serializador explícito `serializeLegacy` — sin cambiar el actual).
- Contratos: shape legacy (expandido) y shape objetivo (diccionario + índice) como fixtures.
- Migración: ninguna. Compatibilidad dual: n/a (sólo pruebas).
- Pruebas:
  - Contract tests del shape objetivo: `backgrounds` único por cadena; `bgImageIndex` resuelve; `-1` → sin fondo.
  - Tests del resolver cliente: `resolveBackgrounds(cards, backgrounds)` para grid/caras/editor/PDF.
  - Caracterización: las suites existentes (manual-editor unit 58/58, schedule 44/44, pdf-extraction 8/8) como gate.
- Métricas de aceptación: contract tests verdes; ningún test existente rojo; `git diff --check` limpio.
- Rollback: eliminar los tests (no hay código productivo).
- Riesgos: bajo. Dependencia: ninguna.

## Corte 1 — Eliminar la duplicación del fondo en las respuestas

**Objetivo**: la respuesta de tarjetas envía el fondo una sola vez; la lista de mazos deja de enviar `cardBackgrounds`. Sin cambiar almacenamiento.

- Archivos probables:
  - Backend: `flashcardController.js` (getCardsByDeck, createCard, updateCard, createBulkCards → devolver `{backgrounds, cards}` o shape dual), `reviewController.js` (tres endpoints de sesión), `deckController.js` (lista sin `cardBackgrounds` en `Deck.serialize` para el resumen), `models/Flashcard.js` (helper `serializeIndexed(backgrounds)`), `models/Deck.js` (helper `serializeSummary()`).
  - Frontend: `lib/` nuevo resolver (`resolveCardBackgrounds`), `FlashcardGrid.jsx`, `CardFace.jsx`, `ReviewMode.jsx`, `FastDeleteMode.jsx`, `LivePreview.jsx`, `DeckInterior.jsx` (handleEdit), `utils/pdf/*` (resolver antes de exportar), `SessionPlayer.jsx` (reparto de diccionario).
- Contratos: lectura de tarjetas y sesiones → `{backgrounds, cards}`; lista de mazos → resumen sin `cardBackgrounds`; escritura/ACK → expandido (dual) para no romper el editor.
- Migración: ninguna de datos. Compatibilidad dual: campo `bgImage` (expandido) sólo para clientes sin cabecera de versión; servidor dual.
- Pruebas: contract tests C0 en verde; matriz funcional editor/repaso/sesión/PDF/import/export; harness `image-delivery` como verificación (el shape `normalized` es el producido).
- Métricas de aceptación: presupuestos separados por escenario y contrato (sintéticos/modelados con margen, no SLO reales de producción):
  - Respuesta de tarjetas — 1000 tarjetas con fondo grande **compartido** (`normalized`): JSON ≤ 1.5 MiB; gzip ≤ 0.8 MiB; una sola copia del fondo; `dictionaryCount = 1`; duplicación repetida = 0.
  - Respuesta de tarjetas — 1000 fondos **distintos** (`normalized`): no exigir reducción relevante; `dictionaryCount = 1000`; cada imagen aparece una vez; ningún índice fuera de rango.
  - Lista 500 mazos portada+fondos (`without_backgrounds`): JSON ≤ 22 MiB; gzip ≤ 17 MiB; reducción mínima de 70% respecto al contrato actual; `cardBackgrounds` ausente; `coverImage` conservada; `JSON.stringify` Node/V8 ≤ 100 ms como presupuesto modelado, no como garantía de producción.
  - duplicación de fondo = 0% en shape nuevo; 0 errores de resolución en logs; sin regresiones funcionales.
- Rollback: desplegar backend previo (vuelve a expandir); el cliente nuevo sigue funcionando con el shape expandido.
- Riesgos: consumidor que olvide resolver (fallback a color sólido, degradación no catastrófica); `contentImage` no se deduplica (alcance aprobado).
- Dependencias: C0.

## Corte 2 — Contratos ligeros de Library/materias con miniaturas o referencias

**Objetivo**: reducir aún más lo que ve Library/materias (portada en miniatura opcional) y preparar el caché de recursos.

- Archivos probables: `deckController.js`/`Deck.serialize` (resumen con `coverImageThumb` opcional), `DeckCard.jsx` (usar `coverImageThumb` con fallback a `coverImage`), `App.jsx` (`loadDecks` contrato resumen), `LibrarySection`/`HomeSection` (sin cambios salvo campos), `safeLocalStorage` (opcional: presupuesto por clave).
- Contratos: resumen de mazo ligero; detalle bajo demanda con diccionario (C1).
- Migración: ninguna (campo nuevo opcional). Compatibilidad: `coverImageThumb` ausente → `coverImage`.
- Pruebas: contract tests resumen; tests de `DeckCard` con/sin miniatura; matriz Home/Library/búsqueda/orden/persistencia.
- Métricas (Corte 2, presupuesto modelado, no SLO de producción): lista 500 mazos con portada en miniatura ⇒ JSON ≤ 15 MiB (referencia: 13.56 MiB `thumbnail_summary` vs 83.61 MiB actual — ESTIMADO); `JSON.stringify` Node/V8 de `decks_<user>` ≤ 60 ms; sujeto a aprobación de calidad visual y generación de miniaturas; sin regresiones de búsqueda/orden.
- Rollback: ignorar `coverImageThumb` (el código ya tiene fallback).
- Riesgos: fidelidad de portada en grid (decisión humana de presupuesto visual); dependencia de generación de miniaturas (cliente o servidor — decisión pendiente).
- Dependencias: C1.

## Corte 3 — Almacenamiento y entrega futura de assets

**Objetivo (sólo si se aprueba)**: mover bytes a assets (Mongo/GridFS/objetos) con referencias cacheables y miniaturas servidas. Es la alternativa D/B/C.

- Archivos probables: nuevo modelo/colección de assets (`backend/src/models/Asset.js` o GridFS), endpoint de recuperación autenticado, escritura dual en `deckController`/`flashcardController`/`aiDeckGenerator`, resolver cliente con caché de assets, GC.
- Contratos: referencias (`assetId`/`url`) en tarjetas y mazos; cadenas legacy conservadas.
- Migración: **sí** — extracción por lotes idempotente con doble escritura ([migration-rollout-rollback.md](./migration-rollout-rollback.md)).
- Compatibilidad: fallback a cadena si falta el asset.
- Pruebas: migración en entorno controlado; recuperación con/ sin auth; CORS/CSP; offline con caché; multi-instancia.
- Métricas: referencia en vez de bytes en JSON (ver §6 raw-results: refs 0.3 KiB vs 3,734 KiB BSON); N assets huérfanos = 0 tras GC; tasa de fallback a cadena < umbral.
- Rollback: desactivar recuperación de assets (sirve cadenas); migración no destructiva.
- Riesgos: autorización de assets (hoy los endpoints no autentican lecturas), privacidad, consistencia multi-instancia, exportación portátil, CORS/CSP.
- Dependencias: C2; decisión humana previa (proveedor/almacenamiento, presupuesto).

## Corte 4 — Migración gradual de datos antiguos

**Objetivo**: normalizar datos legados y limpiar huérfanos (`cardBackgrounds` sin tarjetas referenciantes; assets sin referencias).

- Archivos probables: script de migración (no productivo) + `flashcardController.deleteCard`/`deckController.deleteDeck` con limpieza; utilidad de recuento de referencias.
- Migración: por lotes, idempotente, con dry-run y reporte.
- Compatibilidad: la limpieza no altera el contrato; sólo elimina bytes no referenciados.
- Pruebas: dry-run sobre fixture; verificación de que ningún `bgImageIndex` apunte a un fondo borrado.
- Métricas: recuento de huérfanos antes/después; 0 índices rotos.
- Rollback: restaurar backup; la migración es no destructiva si se ejecuta con retención.
- Riesgos: GC borra un fondo aún referenciado (mitigado por recuento real de referencias).
- Dependencias: C1/C3 según el origen de los datos.

## Corte 5 — Limpieza del contrato heredado (dividido en 5A y 5B)

**Corte 5A — Observabilidad del contrato legacy (TERMINADO, Fase 1G — [phase-1g-cut-5a-report.md](./phase-1g-cut-5a-report.md))**: telemetría temporal y segura que clasifica el contrato negociado por las cinco lecturas (`deck-list`, `deck-cards`, `continuous-session`, `normal-session`, `all-cards`) y emite una línea JSON estable por petición (`image_delivery_contract_usage`, schemaVersion 1, con `at` ISO UTC y clasificaciones `indexed`/`legacy-missing`/`legacy-other` y `thumbnail`/`absent`/`other`/`not-applicable`). Sin PII, sin contadores en memoria, sin base de datos ni dependencias; el logger nunca rompe la petición. **No elimina compatibilidad ni cambia respuestas.** La ventana de observación de 14 días está **OBSERVATION NOT STARTED**: comienza sólo tras desplegar el SHA del 5A; cualquier petición legacy produce **NO-GO** y reinicia la ventana; la ausencia total de tráfico no demuestra readiness.

**Corte 5B — Limpieza del contrato heredado (BLOCKED hasta aprobar los 14 días)**: eliminar el campo `bgImage` expandido del shape y el legacy `cardBackgrounds` de la lista cuando no haya consumidores legacy.

- Archivos probables: `Flashcard.serialize` (eliminar expansión), `Deck.serialize` (eliminar `cardBackgrounds` del resumen), campo dual del servidor (retirar), consumidores que resuelven diccionario (ya en C1), ACK de crear/actualizar/lote al envelope indexado, pipeline IA V1, fallback legacy del resolver frontend, telemetría del 5A.
- Migración: ninguna (sólo contrato). Compatibilidad: **fin de soporte de clientes viejos** — requiere métricas sostenidas de tráfico legacy = 0 durante 14 días con tráfico real representativo.
- Pruebas: contract tests del shape final; suite completa.
- Métricas: 0 requests con contrato legacy durante 14 días (N aprobado); suite verde.
- Rollback: **no limpio** (no borra datos pero sí el shape); por eso se exige el periodo de observación del 5A.
- Riesgos: cliente no actualizado pierde fondos (visible como color sólido).
- Dependencias: C1-C4 y aprobación de la ventana del 5A.

## Resumen de dependencias y presupuestos

| Corte | Archivos/área principal | Sin migración | Rollback | Depende de |
|---|---|---:|---|---|
| 0 | tests/contracts | sí | sí | — |
| 1 | serializadores + consumidores | sí | sí | C0 |
| 2 | resumen + thumbnails | sí | sí | C1 |
| 3 | assets (sólo si se aprueba) | **no** | parcial | C2 + decisión humana |
| 4 | GC/migración de datos | **no** | backup | C1/C3 |
| 5A | observabilidad del contrato legacy (telemetría) | sí | sí | C1-C4 |
| 5B | contrato final (limpieza) | sí | no limpio | C1-C4 + ventana 5A aprobada |

Presupuestos por contrato (propuestos; sujetos a aprobación), separados por escenario:

- Respuesta de tarjetas — 1000 tarjetas con fondo grande compartido (`normalized`): JSON ≤ 1.5 MiB; gzip ≤ 0.8 MiB; `dictionaryCount = 1`; una sola copia del fondo; duplicación repetida = 0.
- Respuesta de tarjetas — 1000 fondos distintos (`normalized`): sin exigir reducción relevante; `dictionaryCount = 1000`; cada imagen aparece una vez; ningún índice fuera de rango.
- Lista de 500 mazos con portada y fondos (`without_backgrounds`, Corte 1): JSON ≤ 22 MiB; gzip ≤ 17 MiB; reducción mínima de 70% respecto al contrato actual; `cardBackgrounds` ausente; `coverImage` conservada; `JSON.stringify` Node/V8 ≤ 100 ms.
- Portada en miniatura (`thumbnail_summary`, Corte 2): JSON ≤ 15 MiB; `JSON.stringify` Node/V8 ≤ 60 ms; sujeto a aprobación de calidad visual y generación de miniaturas.

Estos umbrales son presupuestos sintéticos/modelados con margen, no SLO reales de producción ni mediciones de tráfico real.
