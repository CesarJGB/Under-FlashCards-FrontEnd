# Fase 1C — Reporte de cierre del Corte 0 (contratos y pruebas de caracterización)

Documento de cierre de la Fase 1C. Implementa **exclusivamente** el Corte 0 del plan de [implementation-cuts.md](./implementation-cuts.md): congela con fixtures y pruebas automatizadas los contratos legacy y objetivo de entrega de imágenes, y la compatibilidad del futuro resolver cliente. No implementa el Corte 1.

## Estado del repositorio

| Dato | Resultado |
|---|---|
| Fecha UTC | `2026-08-13T00:27:24Z` |
| Rama | `main` |
| HEAD inicial efectivo | `e0081b2f6177abb66c3ac96eccbb5771a11264b9` |
| `origin/main` tras `git fetch origin` | `e0081b2f6177abb66c3ac96eccbb5771a11264b9` |
| HEAD observado indicado en el encargo | `e0081b2f6177abb66c3ac96eccbb5771a11264b9` |
| Drift | **Ninguno**: `HEAD == origin/main == HEAD observado` |
| Estado inicial del árbol | `?? .agents/` y `?? package-lock.json` (preexistentes, ajenos; no entran al commit) |

No se modificaron ni se leyeron como evidencia las entradas no rastreadas preexistentes.

## Archivos creados o modificados

| Archivo | Acción | Contenido |
|---|---|---|
| `backend/test/imageDeliveryFixtures.js` | creado | fixtures sintéticos (Data URLs pequeñas deterministas) y helpers de referencia (`buildIndexedCards`, `resolveBackground`); no productivo |
| `backend/test/imageDeliveryContracts.test.js` | creado | 13 contract tests: caracterización de `Flashcard.serialize()` (F), contrato legacy expandido (E) e invariantes del contrato objetivo (A–D) |
| `frontend/tests/image-delivery/fixtures.js` | creado | fixtures ESM sintéticos, `legacyPayloadFixture` (shape congelado del payload legacy) |
| `frontend/tests/image-delivery/reference.js` | creado | resolver de referencia `resolveBackgrounds`/`resolveCardBackground` y normalizador `buildIndexedCards`; no productivo |
| `frontend/tests/image-delivery/image-delivery-contracts.test.js` | creado | 12 contract tests del resolver y del contrato normalizado (escenarios A–E) |
| `frontend/package.json` | modificado | script `test:image-delivery` para ejecutar los contract tests del frontend |
| `docs/performance-audit/research/image-delivery/phase-1c-cut-0-report.md` | creado | este reporte |
| `docs/performance-audit/research/image-delivery/README.md` | modificado | enlace al reporte de la Fase 1C |
| `docs/performance-audit/research/image-delivery/implementation-readiness.md` | modificado | refleja que el Corte 0 está terminado |

Ningún archivo productivo (`backend/src/`, `frontend/src/`) fue tocado.

## Contratos congelados

### Contrato heredado (actual)

- Tarjetas con `bgImage` expandido: `Flashcard.serialize(cardBackgrounds)` sustituye `bgImageIndex` por la Data URL completa en cada tarjeta (`backend/src/models/Flashcard.js:58-80`).
- Resolución actual desde `cardBackgrounds` (diccionario del `Deck`) + `bgImageIndex`:
  - índice válido `0 <= i < len` → `cardBackgrounds[i]`;
  - `-1` → `bgImage: ""` (también con diccionario poblado);
  - diccionario vacío o no-array (undefined/null) → `""`;
  - índice fuera de rango → `""` (fallback `|| ''`, nunca excepción).
- El shape serializado tiene exactamente 16 campos: `id, userId, deckId, question, answer, easeFactor, bgImage, textAlign, fontSize, contentImage, imageSide, difficulty, totalReviews, consecutiveErrors, lastReviewedAt, createdAt`. `bgImageIndex` no sobrevive al serializador.
- `contentImage` y campos de formato/telemetría/identificadores se conservan intactos.

### Contrato objetivo

- Respuesta `{ backgrounds, cards }`.
- `backgrounds`: una sola entrada por cadena única (orden de primera aparición).
- Cada tarjeta usa `bgImageIndex`; `-1` representa ausencia de fondo.
- Invariante: ningún índice válido queda fuera del diccionario (`-1` o `0 <= i < backgrounds.length`).
- `contentImage` permanece por tarjeta y no se deduplica; no entra al diccionario de fondos.

### Compatibilidad del futuro resolver cliente (referencia en `frontend/tests/image-delivery/reference.js`)

- Acepta el contrato normalizado (`resolveBackgrounds(cards, backgrounds)` → copias con `bgImage` materializado).
- Fallback legacy: una tarjeta con `bgImage` expandido se conserva tal cual (incluso con diccionario ausente o distinto).
- Índice inválido (negativo distinto de `-1`, fuera de rango, no-entero) → `bgImage: ""`, nunca excepción.
- No muta las tarjetas ni el diccionario recibidos (verificado con objetos congelados y `deepEqual`).
- Conserva todos los demás campos de la tarjeta.

## Escenarios probados

| Escenario | Backend | Frontend | Cubierto por |
|---|---|---|---|
| A — tarjeta sin fondo: diccionario vacío, `-1`, resultado `""` | ✓ | ✓ | `imageDeliveryContracts.test.js` (A) y `image-delivery-contracts.test.js` (A) |
| B — varias tarjetas con el mismo fondo: 1 entrada, mismo índice, sin copias repetidas | ✓ | ✓ | ambos archivos (B) |
| C — fondos distintos: entrada por fondo, índices estables por primera aparición, resolución exacta | ✓ | ✓ | ambos archivos (C) |
| D — contenido mixto: con fondo, sin fondo, índice inválido; fallback seguro; `contentImage` por tarjeta | ✓ | ✓ | ambos archivos (D) |
| E — compatibilidad heredada: `bgImage` sigue resolviéndose, el legacy conserva sus campos, el resolver no muta los originales | ✓ | ✓ | backend (E) y frontend (E) |
| F — caracterización del serializador actual: `serialize(cardBackgrounds)` con índice válido, `-1`, diccionario vacío, fuera de rango; conservación de campos | ✓ | — | `imageDeliveryContracts.test.js` (F) |

## Comandos ejecutados y resultados reales

| Comando | Resultado |
|---|---|
| `git fetch origin` | OK; sin drift |
| `node --test test/imageDeliveryContracts.test.js` (backend) | **13 tests, 13 pass, 0 fail** |
| `npm test` (backend, suite completa) | **54 tests, 49 pass, 5 fail** — los 5 fallos son preexistentes (ver bloqueos) |
| `node --test test/aiService.test.js test/deckRecovery.test.js` (en worktree limpio del HEAD base `e0081b2`) | **10 tests, 5 pass, 5 fail** — idénticos a los 5 fallos de la suite: confirmado preexistente |
| `npm run test:image-delivery` (frontend, nuevo) | **12 tests, 12 pass, 0 fail** |
| `npm run test:manual-editor:unit` (frontend) | **58 tests, 58 pass, 0 fail** (gate del plan: 58/58) |
| `npm run test:schedule` (frontend) | **44 tests, 44 pass, 0 fail** (gate del plan: 44/44) |
| `npm run test:pdf-extraction` (frontend) | **8 tests, 8 pass, 0 fail** (gate del plan: 8/8) |
| `git diff --check` | limpio |

Total de contract tests nuevos de esta fase: **25 (13 backend + 12 frontend), 25/25 pass**.

## Bloqueos y limitaciones

| Clasificación | Detalle |
|---|---|
| **BLOCKED (preexistente, ambiental)** | 5 tests backend fallan en `aiService.test.js` (2) y `deckRecovery.test.js` (3): el entorno configura el modelo `deepseek/deepseek-v4-flash-0731` (y una ratio de sobre-generación distinta) mientras los tests esperan `deepseek-chat` / otra redacción de prompt. Verificado idéntico sobre el HEAD base `e0081b2` en worktree limpio: no es causado por esta fase; ningún test previamente verde falla por la Fase 1C. |
| **NOT RUN** | Ninguna suite pedida quedó sin ejecutar. |
| **PENDING — DEVICE REQUIRED** | Sin cambios: IMG-RENDER no se tocó (no requiere pruebas de dispositivo en esta fase; no se ejecutó Playwright/iPhone/Safari). |

## Confirmaciones

- **Producción no cambió**: no se modificó ningún archivo bajo `backend/src/` ni `frontend/src/`; no cambiaron endpoints (`flashcardController.js`, `deckController.js`, `reviewController.js` intactos), ni `Flashcard.serialize()`/`Deck.serialize()`, ni almacenamiento MongoDB, ni UX/estilos/comportamiento visible, ni caché/`safeLocalStorage`/`?t=`, ni el harness de la Fase 1B (`frontend/tests/performance/image-delivery/` intacto, `raw-results.json` sin regenerar).
- **No se implementó el Corte 1**: las respuestas reales siguen expandiendo `bgImage`; `cardBackgrounds` sigue en la lista de mazos; no hay resolver en componentes productivos, ni cabeceras de versión, ni miniaturas, ni migraciones, ni dependencias nuevas instaladas.
- El resolver y el normalizador de referencia viven **exclusivamente** en el árbol de pruebas y no los importa producción.

## Riesgos pendientes para el Corte 1

- Negociación de versión / campo dual (decisión humana pendiente, [implementation-readiness.md](./implementation-readiness.md) punto 1).
- Cualquier consumidor que olvide resolver el diccionario degradaría a color sólido (fallback no catastrófico ya caracterizado en los tests).
- Índices corruptos en datos viejos: cubierto por el fallback `""` (escenario D), con log sugerido en la matriz de migración.
- `contentImage` no se deduplica en el Corte 1 (alcance aprobado; caracterizado en los tests: escenarios D/B).
- Los 5 fallos preexistentes de `aiService.test.js`/`deckRecovery.test.js` deben resolverse o reaprobarse antes de declarar verde cualquier gate que los incluya.

## Rollback de esta fase

Eliminar los archivos nuevos (`backend/test/imageDeliveryFixtures.js`, `backend/test/imageDeliveryContracts.test.js`, `frontend/tests/image-delivery/`, el script `test:image-delivery` de `frontend/package.json` y los párrafos añadidos a `README.md`/`implementation-readiness.md`). No hay código productivo que deshacer. Revertir el commit devuelve el árbol al HEAD `e0081b2`.

## Veredicto final del Corte 0

**PASS** con bloqueo preexistente documentado:

- Contract tests nuevos: 25/25 verdes (obligatorios, cumplidos).
- Escenarios A–F: cubiertos con fixtures claros en ambos árboles.
- Ningún cambio productivo; ningún endpoint ni comportamiento visible modificado.
- Ningún test previamente verde falla por esta fase (los 5 fallos backend son idénticos en el HEAD base).
- Suites de caracterización del plan: 58/58, 44/44, 8/8 verdes.
- `git diff --check` limpio.

El bloqueo ambiental preexistente (config de modelo IA en `.env` del entorno) no impide declarar PASS del Corte 0, pero queda explícito y debe tratarse antes del Corte 1. El Corte 1 **no** está implementado y **no** se cierra IMG-RENDER.
