# Fase 1D — Reporte de cierre del Corte 1 (normalización de entrega de imágenes)

Documento de cierre de la Fase 1D. Implementa **exclusivamente** el Corte 1 del plan de [implementation-cuts.md](./implementation-cuts.md): normalización de la entrega de imágenes mediante el query parameter `?contract=indexed`, conservando intacto el contrato legacy por defecto y las respuestas de escritura. No implementa los Cortes 2–5.

## Estado del repositorio

| Dato | Resultado |
|---|---|
| Fecha UTC | `2026-08-13T01:00:19Z` |
| Rama | `main` |
| HEAD inicial efectivo | `e4d86aa9404ac0331f0b54966e2c5a00f991e26d` |
| `origin/main` tras `git fetch origin` | `e4d86aa9404ac0331f0b54966e2c5a00f991e26d` |
| HEAD observado indicado en el encargo | `e4d86aa9404ac0331f0b54966e2c5a00f991e26d` |
| Drift | **Ninguno**: `HEAD == origin/main == HEAD observado` |
| Estado inicial del árbol | `?? .agents/` y `?? package-lock.json` (preexistentes, ajenos; no entran al commit) |

Las entradas no rastreadas preexistentes no se modificaron y no entran al commit.

## Decisiones humanas aplicadas (autorizadas para este corte)

1. Negociación mediante query parameter: `?contract=indexed`.
2. `contract=indexed` presente ⇒ backend devuelve el contrato nuevo; ausente o con cualquier otro valor ⇒ contrato legacy exacto.
3. `contentImage` permanece dentro de cada tarjeta: sin deduplicar, sin mover al diccionario, sin cambiar su almacenamiento.
4. Las respuestas de escritura (POST/PUT/bulk de tarjetas) permanecen legacy para no romper el flujo optimista del editor.
5. Miniaturas, caché, TTL, invalidación, GC, migraciones y almacenamiento externo diferidos.
6. Sin pruebas físicas en iPhone para este corte.

## Archivos modificados o creados

| Archivo | Acción | Contenido |
|---|---|---|
| `backend/src/utils/imageDelivery.js` | creado | **única fuente productiva de verdad** del contrato indexado: `isIndexedContractRequest`, `buildIndexedCardPayload`, `buildIndexedSessionPayload` |
| `backend/src/models/Flashcard.js` | modificado | método nuevo `serializeIndexed(bgImageIndex)`; `serialize()` intacto |
| `backend/src/models/Deck.js` | modificado | método nuevo `serializeSummary(cardCount)` (sin `cardBackgrounds`); `serialize()` intacto |
| `backend/src/controllers/flashcardController.js` | modificado | `getCardsByDeck`: rama indexada vía utilidad; escrituras intactas |
| `backend/src/controllers/reviewController.js` | modificado | `getContinuousSessionCards`, `getNormalSessionCards`, `getAllSessionCards`: envelope indexado vía utilidad; selección/shuffle/lógica intactos |
| `backend/src/controllers/deckController.js` | modificado | `getDecks`: resumen sin `cardBackgrounds` vía `serializeSummary` cuando se negocia indexado |
| `backend/test/imageDeliveryContracts.test.js` | ampliado | 16 pruebas nuevas (negociación, normalizador, serializadores, envelopes, presupuestos A/B/C) |
| `frontend/src/lib/imageDelivery.js` | creado | resolver productivo: `resolveCardBackground`, `resolveCard`, `resolveCards`, `extractAndResolveCards`, `stripCardBackgrounds`, `sanitizeDeckSummaries` |
| `frontend/src/components/DeckInterior.jsx` | modificado | carga `?contract=indexed` y resolución única tras `response.json()` |
| `frontend/src/components/StudySection.jsx` | modificado | `loadCards` del PDF solicita `contract=indexed` y resuelve antes de exportar |
| `frontend/src/components/SessionPlayer.jsx` | modificado | `all-cards?contract=indexed` resuelto antes de `allCardsRef.current` |
| `frontend/src/App.jsx` | modificado | lista `contract=indexed` (conserva `?t=`); sanitización de `cardBackgrounds` antes de `setDecks`/`setJSON` y al leer el caché en el estado inicial |
| `frontend/tests/image-delivery/image-delivery-contracts.test.js` | ampliado | 18 pruebas nuevas de la utilidad productiva + oráculo comparativo contra la referencia del Corte 0 |
| `docs/performance-audit/research/image-delivery/phase-1d-cut-1-report.md` | creado | este reporte |
| `docs/performance-audit/research/image-delivery/README.md` | modificado | estado del Corte 1 |
| `docs/performance-audit/research/image-delivery/implementation-readiness.md` | modificado | estado del Corte 1 |
| `docs/performance-audit/research/image-delivery/phase-1c-cut-0-report.md` | corregido | conteos de la tabla inicial: 13→18 backend y 12→18 frontend |

## Contrato legacy final (congelado, sin cambios)

- `GET /api/flashcards/deck/:deckId` sin `contract=indexed` (o con valor distinto): array legacy de tarjetas con `bgImage` expandido vía `Flashcard.serialize()`; 16 campos exactos, sin `bgImageIndex`.
- `GET /api/decks/:deckId/{continuous-session,normal-session,all-cards}` sin negociación: `{ success: true, cards: [{ bgImage }] }`.
- `GET /api/decks/:userId` sin negociación: array legacy con `cardBackgrounds` y `coverImage` completa.
- `Flashcard.serialize()` y `Deck.serialize()` no modificados (verificado por tests F y `indexed: Deck.serialize keeps the frozen legacy contract`).
- Escrituras (`POST/PUT /api/flashcards…`, `POST /api/flashcards/bulk`), exportación/importación, creación/edición de mazos, IA y telemetría: intactos, sin `contract=indexed` en ningún flujo.

## Contrato indexado final

- Detalle: `{ "backgrounds": ["data:image/..."], "cards": [{ "id", "bgImageIndex": 0, ... }] }` — sin `bgImage` dentro de las tarjetas.
- Sesiones: `{ "success": true, "backgrounds": [...], "cards": [{ "bgImageIndex": 0, ... }] }`.
- Lista de mazos: array raíz actual con metadatos, `coverImage` completa y conteo; `cardBackgrounds` excluido por completo. Sin `coverImageThumb`.
- Diccionario: sólo cadenas realmente referenciadas por las tarjetas devueltas, deduplicadas por valor exacto, orden estable por primera aparición en el orden final; remapeo de índices almacenados (dos índices a cadenas idénticas ⇒ una sola entrada); `-1`/no entero/fuera de rango/cadena inválida ⇒ `bgImageIndex: -1` sin excepción y sin rescate de `bgImage`; `contentImage` idéntico por tarjeta; sin construir primero tarjetas expandidas (la rama indexada no llama a `serialize()`).

## Endpoints versionados

| Endpoint | Sin `contract=indexed` | Con `contract=indexed` |
|---|---|---|
| `GET /api/flashcards/deck/:deckId` | array legacy (`bgImage`) | `{ backgrounds, cards }` |
| `GET /api/decks/:deckId/continuous-session` | `{ success, cards }` legacy | `{ success, backgrounds, cards }` |
| `GET /api/decks/:deckId/normal-session` | `{ success, cards }` legacy | `{ success, backgrounds, cards }` |
| `GET /api/decks/:deckId/all-cards` | `{ success, cards }` legacy | `{ success, backgrounds, cards }` |
| `GET /api/decks/:userId` | array legacy con `cardBackgrounds` | array sin `cardBackgrounds` |

Sin cambios en errores, códigos HTTP, selección, shuffle ni lógica de sesiones.

## Consumidores actualizados (fronteras de red)

- `DeckInterior.jsx` — lectura de detalle; acepta también el array legacy de un backend anterior; las respuestas POST/PUT/bulk legacy se mezclan con las tarjetas ya resueltas (ambas llevan `bgImage`).
- `StudySection.jsx` — carga directa para PDF; el exportador PDF no cambió y recibe `bgImage` materializado.
- `SessionPlayer.jsx` — `all-cards` versionado; `allCardsRef.current` recibe tarjetas resueltas; construcción de lotes, shuffle, frágiles, telemetría, lógica y render intactos.
- `App.jsx` — lista versionada conservando `?t=`; `cardBackgrounds` sanitizado al entrar en estado y `safeLocalStorage` (incluido el caché antiguo en el estado inicial), sin cambiar TTL, claves ni política de revalidación.
- Componentes presentacionales (`FlashcardGrid`, `CardFace`, `ReviewMode`, exportador PDF, etc.) sin cambios: siguen recibiendo `bgImage` materializado.
- Revisados todos los fetch productivos a los cinco endpoints: los únicos consumidores reales de lectura eran los cuatro actualizados.

## Pruebas y conteos reales

| Comando | Resultado |
|---|---|
| `node --test test/imageDeliveryContracts.test.js` (backend) | **34 tests, 34 pass, 0 fail** (18 del Corte 0 + 16 del Corte 1) |
| `npm test` (backend, suite completa) | **75 tests, 70 pass, 5 fail** — los 5 fallos son exactamente los preexistentes documentados en `e4d86aa` (`aiService.test.js` ×2, `deckRecovery.test.js` ×3); no aumentó el número de fallos; ninguna prueba relacionada con imágenes, contratos, mazos, editor, sesiones o PDF falla |
| `npm run test:image-delivery` (frontend) | **36 tests, 36 pass, 0 fail** (18 del Corte 0 + 18 del Corte 1) |
| `npm run test:manual-editor:unit` (frontend) | **58 tests, 58 pass, 0 fail** |
| `npm run test:schedule` (frontend) | **44 tests, 44 pass, 0 fail** |
| `npm run test:pdf-extraction` (frontend) | **8 tests, 8 pass, 0 fail** |
| `npm run build` (frontend) | **OK** (13.78 s; aviso preexistente de tamaño de chunk, sin errores) |
| `git diff --check` | limpio |

Sin dependencias nuevas (ni Supertest ni otras). No se ejecutó Playwright, Safari ni pruebas físicas en iPhone.

## Métricas y presupuestos observados (implementación productiva, datos sintéticos)

| Presupuesto | Exigido | Observado (productivo) | Observado (harness modelado) |
|---|---|---|---|
| A. 1000 tarjetas, fondo grande compartido — JSON | ≤ 1.5 MiB | 1,315,789 B (1.255 MiB) ✓ | 1,347,569 B (1.285 MiB) ✓ |
| A. gzip | ≤ 0.8 MiB | 723,884 B (0.69 MiB) ✓ | 728,834 B (0.695 MiB) ✓ |
| A. `backgrounds.length` | 1 | 1 ✓ | 1 ✓ |
| A. copias de la cadena / índices fuera de rango / `bgImage` en cards | 1 / 0 / 0 | 1 / 0 / 0 ✓ | — |
| B. 1000 fondos distintos — `backgrounds.length` | 1000 | 1000 ✓ | 1000 ✓ |
| B. cada cadena una vez / índices válidos | sí | sí ✓ | — |
| C. Lista 500 mazos portada+fondos — JSON | ≤ 22 MiB | 22,047,891 B (21.03 MiB) ✓ | 22,082,891 B (21.06 MiB) ✓ |
| C. gzip | ≤ 17 MiB | 16,608,136 B (15.84 MiB) ✓ | 16,623,767 B (15.85 MiB) ✓ |
| C. reducción frente al contrato actual modelado | ≥ 70% | 74.84% ✓ | 74.81% ✓ |
| C. `cardBackgrounds` ausente / `coverImage` conservada | sí | sí ✓ | sí ✓ |

Tiempos observados (mediciones modeladas, **sin aserción temporal frágil**): `JSON.stringify` del resumen de 500 mazos ≈ 206–673 ms en la suite productiva y mediana 81.13 ms en el harness; payload indexado de 1000 tarjetas + stringify ≈ 42–47 ms. No se introdujo ninguna aserción dependiente de máquina.

Harness de la Fase 1B ejecutado hacia archivo temporal (`/tmp/image-delivery-cut-1.json`): **PASS**, 40,002 invariantes aprobadas, 0 fallidas. `docs/performance-audit/research/image-delivery/raw-results.json` **no** fue editado ni regenerado.

## Fallos preexistentes

- 5 tests backend (`aiService.test.js` ×2, `deckRecovery.test.js` ×3) siguen fallando por la configuración del modelo IA del entorno: **idénticos a los de `e4d86aa`**, sin aumento de fallos, documentados como preexistentes y fuera del alcance de este corte. No se corrigieron.

## Compatibilidad frontend/backend en ambas direcciones

- **Frontend nuevo + backend antiguo**: el backend ignora `contract=indexed` y devuelve el array legacy; `extractAndResolveCards` lo acepta (tests `cut1: extractAndResolveCards accepts the legacy array…` y `…legacy session envelope…`).
- **Backend nuevo + frontend antiguo**: al no enviar `contract=indexed`, el backend devuelve exactamente la respuesta legacy (tests de negociación: ausencia o valor desconocido ⇒ contrato legacy; `serialize()`/`Deck.serialize()` congelados).

## Confirmaciones

- **No hubo migración** de datos ni cambios de esquema almacenado; MongoDB intacto (`bgImageIndex` + `cardBackgrounds` como estaban).
- **`contentImage` no cambió**: permanece por tarjeta, sin deduplicación y sin entrar al diccionario (tests backend `indexed: contentImage and every other card field stay intact` y frontend `cut1: new frontend + indexed response…`).
- **Sin miniaturas** (`coverImageThumb` no existe), **sin caché/TTL/`?t=`** modificados, **sin cambios de UI/UX**, sin endpoints de assets, sin S3/GridFS, sin GC.
- **Corte 2 no comenzó**: no hay `coverImageThumb`, ni políticas de caché nuevas, ni resumen con miniaturas.
- `IMG-RENDER`, `IMG-CACHE` e `IMG-STORAGE` **no se cierran** (siguen PARTIAL / PENDING).

## Rollback

Revertir el commit restaura el backend previo (el serializador vuelve a expandir `bgImage` y la lista vuelve a incluir `cardBackgrounds`) y el frontend previo (no negocia el contrato). Los datos no se tocaron en ningún momento, por lo que no existe migración inversa. El frontend nuevo funciona igualmente contra el backend revertido gracias al fallback legacy del resolver.

## Riesgos restantes

- IMG-RENDER: el beneficio percibido en Safari/iPhone sigue sin validación física (**PENDING — DEVICE REQUIRED**; fuera de alcance por autorización).
- Clientes antiguos del backend: si una instalación antigua del frontend llamara con `contract=indexed` (no es el caso: ninguna versión anterior lo envía), el backend devolvería el shape nuevo; no existe tal cliente.
- Cachés locales (`decks_<user>` en `safeLocalStorage`) con `cardBackgrounds`: saneados al entrar en estado, sin cambiar claves ni revalidación; un `safeLocalStorage` muy antiguo seguirá conteniendo el campo en disco hasta su próxima reescritura (la lectura ya lo filtra).
- Fondos huérfanos en `cardBackgrounds` (IDL-003) y GC: diferidos al Corte 4 por plan.
- Los 5 fallos preexistentes de IA deben resolverse o reaprobarse antes de declarar verde cualquier gate que los incluya.

## Veredicto

**PASS**

- Contrato indexado generado por una única utilidad productiva (`backend/src/utils/imageDelivery.js`), utilizada por los cuatro controladores afectados.
- Contrato legacy idéntico por defecto; escrituras intactas.
- El nuevo frontend acepta respuestas legacy e indexadas (tests explícitos en ambas direcciones).
- Todos los consumidores reciben `bgImage` materializado; lista versionada sin `cardBackgrounds`; `coverImage` conservada; `contentImage` por tarjeta.
- Presupuestos de bytes cumplidos (A, B y C) con la implementación productiva y con el harness modelado.
- Pruebas nuevas en verde (34 backend + 36 frontend de contratos); suites de caracterización 58/58, 44/44, 8/8; build OK; `git diff --check` limpio.
- Sin cambios de almacenamiento, migración, caché o UI. El Corte 2 sigue pendiente.
