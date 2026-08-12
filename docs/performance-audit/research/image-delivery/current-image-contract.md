# Contrato actual de imágenes (Fase 1B)

Inventario estático del recorrido completo de cada clase de imagen en el HEAD `245bbc0`, siguiendo: selección de archivo → validación → transformación → estado React → petición HTTP → controlador → modelo → serialización → respuesta → caché → consumidor. Todas las referencias se verificaron en el código; un comentario no se aceptó como prueba aislada.

## 1. Productores (ingesta en el cliente)

| Imagen | Productor | Líneas | Transformación | Límite |
|---|---|---|---|---|
| Portada (`coverImage`) | `DeckModal.jsx` `fileToBase64` + `handleFile` | `frontend/src/components/DeckModal.jsx:7-13,28-42` | `FileReader.readAsDataURL`, sin canvas, sin resize | 1.5 MiB binario (`:31`) |
| Fondo (`bgImage`) | `FlashcardCreator.jsx` `handleBgFile` | `frontend/src/components/FlashcardCreator.jsx:245-256` | `readAsDataURL`, sin resize | 700 KiB binario (`:248`) |
| Fondo (estilo, editor V2) | `StylePanel.jsx` (mismo handler recibido) | `frontend/src/components/creator/StylePanel.jsx:295,430-435,585` | idéntico a FlashcardCreator | idéntico |
| Contenido (`contentImage`) | `FlashcardCreator.jsx` `handleContentImageFile` | `frontend/src/components/FlashcardCreator.jsx:258-293` | `Image` + canvas en hilo principal; JPEG 0.7; ancho máx. 600 px | sin límite de entrada; decodifica el archivo completo |

Estado React: `DeckModal` guarda `coverImage` (`:19`); `DeckInterior` mantiene `bgImage`/`contentImage`/`imageSide` (`frontend/src/components/DeckInterior.jsx:29,41-42`) y los propaga a `FlashcardCreator` y `StylePanel`.

## 2. Peticiones HTTP (escritura)

| Flujo | Cliente | Body | Controlador |
|---|---|---|---|
| Crear/editar mazo | `DeckModal` → `onSave` → `LibrarySection` | `{title, coverImage, coverColor}` | `deckController.createDeck` / `updateDeck` (`backend/src/controllers/deckController.js:44-76,78-111`) |
| Crear/editar tarjeta | `DeckInterior.handleSubmit` | `{question, answer, bgImage, textAlign, fontSize, contentImage, imageSide}` | `flashcardController.createCard` / `updateCard` (`backend/src/controllers/flashcardController.js:35-90`) |
| Lote / importación | `DeckInterior.handleImportJSON` y bulk | `{batchStyles:{bgImage,...}, cards:[{bgImage, contentImage,...}]}` | `createBulkCards` (`flashcardController.js:104-160`) |
| IA | `FlashcardCreator.executeAiGeneration` | `{userId, deckId, text, count, batchStyles:{bgImage,...}}` | `generateAiCardsPipeline` (`backend/src/controllers/flashcard/aiDeckGenerator.js:76,197`) |

Nota: la mayoría de endpoints de mazos/tarjetas **no están protegidos** (sólo `deleteDeck`, `updateDefault`, `updatePublicReadOnly` y los de IA usan `protect`; ver `backend/src/routes/deckRoutes.js:8-17`, `flashcardRoutes.js:7-15`). La identidad viaja en `X-User-Id`/`userId` del body. Esto es relevante para cualquier contrato futuro con recursos referenciados.

## 3. Almacenamiento (modelos MongoDB)

| Campo | Modelo | Líneas |
|---|---|---|
| `Deck.coverImage: String` | `backend/src/models/Deck.js:11` | Data URL completa |
| `Deck.cardBackgrounds: [String]` | `backend/src/models/Deck.js:12` | array de Data URL, deduplicado por `indexOf` |
| `Flashcard.bgImageIndex: Number` | `backend/src/models/Flashcard.js:22` | índice contra `Deck.cardBackgrounds` |
| `Flashcard.contentImage: String` | `backend/src/models/Flashcard.js:25` | Data URL embebida por tarjeta, sin deduplicación |
| `Flashcard.imageSide` | `backend/src/models/Flashcard.js:26` | lado de la tarjeta donde se muestra |

Deduplicación del fondo: `getOrCreateBgIndex` busca `deck.cardBackgrounds.indexOf(cadena)`, añade y guarda sólo si falta (`flashcardController.js:7-19`); `createBulkCards` repite el patrón en memoria (`:122-132`); la IA usa `$addToSet` (`aiDeckGenerator.js:656-668`).

## 4. Serialización (expansión)

| Serializador | Comportamiento | Líneas |
|---|---|---|
| `Deck.serialize(cardCount)` | devuelve siempre `coverImage` y `cardBackgrounds` completos | `Deck.js:38-66` (campos en `:44,46`) |
| `Flashcard.serialize(cardBackgrounds)` | sustituye `bgImageIndex` por la Data URL completa (`bgImage`) en **cada** tarjeta | `Flashcard.js:58-80` (expansión en `:66`) |

## 5. Endpoints de lectura y dónde se duplica

| Endpoint | Controlador | Qué devuelve | Duplicación |
|---|---|---|---|
| `GET /api/decks/:userId` | `deckController.getDecks` (`:7-42`) | lista completa serializada (portadas + fondos + conteos agregados) | fondos enteros por mazo aunque nadie los consuma |
| `GET /api/flashcards/deck/:deckId` | `flashcardController.getCardsByDeck` (`:21-33`) | tarjetas con `bgImage` expandido | fondo × nº tarjetas |
| `GET /api/decks/:deckId/all-cards` | `reviewController.getAllSessionCards` (`:298-324`) | idéntico al anterior (sesiones) | fondo × nº tarjetas |
| `GET /api/decks/:deckId/continuous-session` | `reviewController.getContinuousSessionCards` (`:157-241`) | lote 30 con `serialize(backgrounds)` (`:235`) | fondo × 30 |
| `GET /api/decks/:deckId/normal-session` | `reviewController.getNormalSessionCards` (`:251-287`) | shuffle completo (`:281`) | fondo × n |
| `GET /api/decks/:id/export` | `deckController.exportDeck` (`:174-198`) | `deck.serialize()` + tarjetas con `bgImageIndex` **sin expandir** | única copia (contrato ya indexado) |
| `POST /api/decks/import` | `deckController.importDeck` (`:200-250`) | acepta `cardBackgrounds` + `bgImageIndex` | contrato indexado |
| Perfil público de materia | `academicController` (`:93-130`) | sólo conteos; **no transporta imágenes** | ninguna |

Respuestas de creación/edición de tarjeta (`flashcardController.js:57,85`) y de IA (`aiDeckGenerator.js:739`) también expanden el fondo en la tarjeta devuelta.

## 6. Caché / persistencia del cliente

- `App.jsx` carga `decks_<user>` y `materias_<user>` y los persiste con `setJSON` (`frontend/src/App.jsx:61-68,81-119`). La lista completa —con portadas y fondos— se serializa de nuevo a `safeLocalStorage` (`frontend/src/lib/safeLocalStorage.js:21-36`).
- `safeLocalStorage.setJSON` hace `JSON.stringify` síncrono; si falla la cuota, conserva la referencia en un `Map` en memoria (`:29-31`) — no garantiza persistencia.
- URLs de datos embebidas no son reutilizables por la caché HTTP; cada petición lleva `?t=${Date.now()}` (`App.jsx:84,104`).
- Cachés en memoria por montaje: temas/subtemas (`useLibraryState.js:57-58`). `pending_reviews_<user>` persiste colas de review (`SessionPlayer.jsx:239,256,279-294`), sin relación con imágenes.

## 7. Consumidores por superficie

### Portada `coverImage`
- `DeckCard.jsx:30-39` → fondo CSS de la tarjeta de mazo (grid y lista `:102,190`).
- `DeckModal.jsx:19,250-252` → preview al editar.
- **No la consume**: HomeSection, StudySection, LibrarySection (salvo a través de DeckCard), PublicMateriaPage, sesiones, PDF, export.

### `cardBackgrounds` (array del Deck)
- **Cero consumidores en frontend productivo** (verificado: la única aparición en `frontend/` es el harness `tests/performance/image-grid/run-payload-baseline.mjs:158-166`). Viaja y se persiste sin uso.

### `bgImage` expandido (tarjeta)
- `FlashcardGrid.jsx:13-23` → `backgroundImage` CSS por tarjeta; overlay en `:137`.
- `CardFace.jsx:28-29,87-98` → cara de sesión/flip (fondo + verificación `isSafeImageUrl`).
- `ReviewMode.jsx:42,59-62` → fondo de la tarjeta de repaso.
- `FastDeleteMode.jsx:92-105` → fondo en modo borrado rápido.
- `LivePreview.jsx:11-16` → preview del creador.
- PDF: `frontend/src/utils/pdf/renderers/printableCardsRenderer.js:61` y estimador `frontend/src/utils/pdf/images.js:248,261` (cuenta la repetición por tarjeta).
- Editor: `DeckInterior.handleEdit` lee `card.bgImage` para rellenar el formulario (`DeckInterior.jsx:277`).
- Sesiones: `SessionPlayer` recibe `all-cards` y los reparte a `CardFace` (`SessionPlayer.jsx:372-391,643`).

### `contentImage`
- `FlashcardGrid.jsx:159-193` → botón "Ver Imagen" + lightbox (el `<img>` sólo se monta al abrir).
- `CardFace.jsx:28,55-75` → imagen de la cara en sesión.
- `ReviewMode.jsx:130-197` → imagen + zoom.
- PDF: `printableCardsRenderer.js:68`, `contentRenderer.js:309-354`.
- Editor: `DeckInterior.jsx:279-280` (edición) y `FlashcardCreator` (captura).

### `bgImageIndex` (contrato indexado)
- Export/import (ver §5): contrato ya indexado.
- Frontend no lo consume directamente: lo "resuelve" el serializador antes de salir.

## 8. Comportamiento de edición, reemplazo y eliminación

- **Reemplazar fondo**: `updateCard` con `bgImage` nuevo hace `getOrCreateBgIndex`; si la cadena ya existe en `cardBackgrounds`, reutiliza el índice (`flashcardController.js:79-81`). Si el usuario re-subiría el mismo archivo, la cadena coincide byte a byte y no crea duplicado documental.
- **Quitar fondo**: se envía `bgImage: ''` → `getOrCreateBgIndex` devuelve `-1` (`:8`) y el índice apunta a "sin fondo". La cadena antigua **permanece** en `cardBackgrounds`.
- **Eliminar tarjeta**: `deleteCard` (`flashcardController.js:92-102`) borra la tarjeta pero no toca `cardBackgrounds`: el fondo queda **huérfano** en el documento Deck si ninguna otra tarjeta lo referencia. No existe GC de fondos.
- **Eliminar mazo**: `deleteDeck` (`deckController.js:151-172`) elimina el documento Deck (y con él `coverImage` + `cardBackgrounds`) y las tarjetas. `contentImage` muere con la tarjeta.

## 9. Límites y efectos transversales

- **Express**: `express.json({limit:'50mb'})` (`backend/src/server.js:65-66`); coherente con importaciones, sin presupuesto por contrato.
- **MongoDB**: `Deck.coverImage` + `cardBackgrounds` crecen el documento del mazo (BSON sintético medido hasta 10.51 MB con 10 fondos grandes en la Fase 1A); distancia real al límite de documento no medida: **BLOCKED**.
- **localStorage**: la lista completa se copia; el punto probado de cuota local en 1A superó `QuotaExceededError` desde 13,162,291 caracteres (500 mazos con fondos).
- **Logout**: `handleLogout` (`App.jsx:475-478`) sólo limpia `user`; **no borra** `decks_<user>`/`materias_<user>` (datos globales y de jerarquía persisten entre sesiones; también los de mazos públicos visibles).
- **Privacidad/autorización**: las respuestas de tarjetas no distinguen permisos (los mazos `isDefault`/`isPublicReadOnly` se sirven a cualquiera que conozca el `deckId`); mover imágenes a recursos externos exigiría diseñar autorización por recurso.

## 10. Hallazgos estáticos de esta fase

| # | Hallazgo | Evidencia | Severidad |
|---|---|---|---|
| IDL-001 | `cardBackgrounds` en la lista de mazos: 0 consumidores en frontend | `Deck.js:46`; grep `frontend/src` sólo en harness | Alta (bytes/parse/storage sin uso) |
| IDL-002 | El contrato de export/import ya es indexado (muestra el objetivo sin cambios de modelo) | `deckController.js:186-191,213,229` | Informativa |
| IDL-003 | Borrado de fondo/tarjeta no limpia `cardBackgrounds` → huérfanos documentales | `flashcardController.js:92-102`; `getOrCreateBgIndex` | Media |
| IDL-004 | `contentImage` se pierde en importación JSON (bulk la fija a `''`) | `DeckInterior.jsx:158-166` → `flashcardController.js:142`; heredado de PERF-CONTRACT-001 | Media |
| IDL-005 | Endpoints de lectura sin protección efectiva (identidad por header/body) | `deckRoutes.js:8-17`; `authController.protect` | Media (afecta diseño futuro) |
| IDL-006 | Los perfiles públicos de materia no transportan imágenes | `academicController.js:93-130` | Informativa |
| IDL-007 | `isSafeImageUrl` ya acepta `data:image/*` y URLs http(s) | `frontend/src/lib/utils.js:78-94` | Informativa (facilita referencias futuras) |
