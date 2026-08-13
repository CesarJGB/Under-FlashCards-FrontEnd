# Fase 1E — Reporte de cierre del Corte 2 (contratos ligeros de Library/materias con miniaturas)

Documento de cierre de la Fase 1E. Implementa **exclusivamente** el Corte 2 del plan de [implementation-cuts.md](./implementation-cuts.md): miniaturas opcionales de portada (`coverImageThumb`) generadas en el frontend, almacenadas como campo opcional de `Deck`, y entregadas por un contrato ligero de lista de mazos (`?contract=indexed&cover=thumbnail`) con fallback a la portada completa. No implementa los Cortes 3–5.

## Estado del repositorio

| Dato | Resultado |
|---|---|
| Fecha UTC | `2026-08-13T01:32:43Z` |
| Rama | `main` |
| HEAD inicial efectivo | `0921717940635995fb39dd1a5dcb5849314935d5` |
| `origin/main` tras `git fetch origin` | `0921717940635995fb39dd1a5dcb5849314935d5` |
| HEAD observado indicado en el encargo | `0921717940635995fb39dd1a5dcb5849314935d5` |
| Drift | **Ninguno**: `HEAD == origin/main == HEAD observado` |
| Estado inicial del árbol | `?? .agents/` y `?? package-lock.json` (preexistentes, ajenos; no entran al commit) |

Las entradas no rastreadas preexistentes no se modificaron y no entran al commit.

## Decisiones implementadas (autorizadas para este corte)

1. Miniaturas generadas en el frontend al seleccionar una portada nueva (APIs nativas: `FileReader`, `Image`, `canvas`, `toDataURL`). Sin `sharp` ni dependencias nuevas.
2. `coverImageThumb` como campo opcional de `Deck` (MongoDB), sin migración ni backfill de mazos antiguos.
3. `coverImage` completa continúa almacenada y servida sin modificaciones; un mazo antiguo sin miniatura usa fallback a `coverImage`.
4. Contrato ligero negociado como `?contract=indexed&cover=thumbnail`; el contrato legacy y el del Corte 1 (`?contract=indexed`) permanecen congelados.
5. Protección del flujo de edición: la miniatura nunca sustituye a la portada completa en escrituras; editar sólo metadatos omite los campos de imagen.
6. No se tocaron TTL, invalidación, `?t=`, claves de `safeLocalStorage`, service workers, caché HTTP, almacenamiento externo, S3, GridFS ni endpoints de assets.
7. IMG-CACHE e IMG-RENDER permanecen PARTIAL; IMG-RENDER sigue PENDING — DEVICE REQUIRED.

## Archivos modificados o creados

| Archivo | Acción | Contenido |
|---|---|---|
| `backend/src/utils/imageDelivery.js` | ampliado | negociación única de lista (`resolveDeckListContract`), validación/normalización de miniatura (`isValidCoverThumb`, `sanitizeCoverThumb`), campos de escritura de imagen (`buildDeckImageFields`) |
| `backend/src/models/Deck.js` | ampliado | campo `coverImageThumb: { type: String, default: '' }`; método nuevo `serializeLightSummary`; `serialize()` y `serializeSummary()` intactos |
| `backend/src/controllers/deckController.js` | ampliado | `getDecks` resuelve contrato vía utilidad; `createDeck`/`updateDeck`/`importDeck` aceptan y normalizan la miniatura sin afectar clientes antiguos |
| `backend/test/imageDeliveryContracts.test.js` | ampliado | 17 pruebas nuevas del Corte 2 (negociación, serializer, validación, escrituras, presupuestos) |
| `frontend/src/lib/coverThumbnail.js` | creado | generación de miniaturas (canvas/WebP) + funciones puras testeables: `targetThumbDimensions`, `planThumbnailAttempts`, `isReasonableImageDataUrl`, `THUMB_BUDGET_CHARS` |
| `frontend/src/lib/imageDelivery.js` | ampliado | `resolveDeckCover` (thumb → full → '') y `buildDeckCoverPayload` (protección de edición) |
| `frontend/src/App.jsx` | modificado | lista de mazos con `contract=indexed&cover=thumbnail` conservando `?t=` |
| `frontend/src/components/DeckCard.jsx` | modificado | portada resuelta como `coverImageThumb || coverImage || color` |
| `frontend/src/components/DeckModal.jsx` | modificado | estado explícito `coverChanged`; previsualización `coverImageThumb || coverImage`; payload de imagen según caso; generación de miniatura sin bloquear la vista previa |
| `frontend/tests/image-delivery/image-delivery-contracts.test.js` | ampliado | 13 pruebas nuevas del Corte 2 |
| `frontend/tests/image-delivery/cover-thumbnail.test.js` | creado | 8 pruebas puras de la utilidad de miniaturas |
| `frontend/package.json` | modificado | `test:image-delivery` incluye `cover-thumbnail.test.js` |
| `docs/performance-audit/research/image-delivery/phase-1e-cut-2-report.md` | creado | este reporte |
| `docs/performance-audit/research/image-delivery/README.md` | modificado | estado del Corte 2 |
| `docs/performance-audit/research/image-delivery/implementation-readiness.md` | modificado | estado del Corte 2 |

## Contratos finales (coexistencia exacta)

| Petición | Contrato |
|---|---|
| Legacy (sin `contract=indexed` o con otro valor) | idéntico al congelado: `coverImage` completa + `cardBackgrounds`; sin `coverImageThumb`; `Deck.serialize()` intacto |
| `?contract=indexed` | idéntico al del Corte 1: sin `cardBackgrounds`, `coverImage` completa; sin `coverImageThumb`; no depende de que el frontend entienda miniaturas |
| `?contract=indexed&cover=thumbnail` | nuevo: sin `cardBackgrounds`; con miniatura válida → `coverImageThumb` y omite `coverImage`; sin miniatura → `coverImage` completa como fallback (no inventa miniatura) |
| `cover` con valor desconocido (p. ej. `cover=full`) | comportamiento del Corte 1 (`indexed`) |

La negociación vive en una única utilidad productiva (`backend/src/utils/imageDelivery.js:resolveDeckListContract`) usada por `getDecks`; el modelo delega la validación en `isValidCoverThumb` (misma fuente), sin condiciones duplicadas.

## Generación de la miniatura

- Utilidad independiente y testeable: `frontend/src/lib/coverThumbnail.js`.
- APIs nativas (`FileReader`, `Image`, `canvas`, `toDataURL`); relación de aspecto conservada; sin ampliar imágenes pequeñas; lado mayor inicial 320 px; formato preferido WebP; calidad inicial 0.78; presupuesto objetivo ~24 KiB de Data URL (`THUMB_BUDGET_CHARS`).
- Si supera el presupuesto: reduce calidad y después dimensiones (`THUMBNAIL_ATTEMPT_PLAN`), con piso legible (128 px, 0.35); el último intento se devuelve aunque exceda el presupuesto (nunca ilegible).
- Si el navegador no puede producir una miniatura válida: devuelve `''` sin lanzar; se conserva la portada completa y el guardado no se bloquea. El resultado se valida con `isReasonableImageDataUrl` antes de enviarse.
- El límite actual de 1.5 MiB para la imagen completa no cambió. La generación ocurre tras mostrar la portada completa en el modal (sin cambios visibles ni bloqueo de la interacción).

## Protección del flujo de edición

- Previsualización en edición: `coverImageThumb || coverImage` (`DeckModal.previewCover`).
- Estado explícito `coverChanged`: editar sólo título/color/materia/etc. omite ambos campos de imagen (payload `{}` en imágenes; `buildDeckCoverPayload`), por lo que el backend conserva la portada completa y la miniatura almacenadas.
- Portada nueva: envía `coverImage` completa + `coverImageThumb`.
- Eliminación explícita: envía ambos campos `''` (el backend limpia ambos).
- Creación: envía ambos valores disponibles.
- La miniatura nunca se usa como sustituto del archivo completo en escrituras, exportación o edición.
- Backend: `updateDeck` sólo escribe los campos de imagen presentes en el body (`buildDeckImageFields`); una actualización de metadatos no modifica ninguna imagen; la miniatura inválida o excesiva se normaliza a `''` sin afectar clientes que no envían el campo.

## Corrección puntual post-cierre — Cancelación segura de miniaturas pendientes

**Problema confirmado**: en el commit `ae29297`, `handleRemoveCover()` vaciaba `coverImage` y `coverThumb` pero no invalidaba el token ni neutralizaba la promesa pendiente de `generateCoverThumbnail`. Una miniatura que terminara después de pulsar "Quitar imagen" podía restaurar `coverThumb` y el guardado podía enviar `{ coverImage: '', coverImageThumb: <miniatura anterior> }`, violando el contrato del Corte 2 (eliminar debe limpiar ambos campos).

**Corrección implementada**:

- Nueva utilidad pura `frontend/src/lib/coverThumbnailTracker.js` (sin React ni APIs del navegador): `beginThumbnailGeneration`, `trackThumbnailPromise`, `isCurrentThumbnailToken`, `cancelThumbnailGeneration`, `getPendingThumbnail`.
- `DeckModal.jsx` usa el rastreador en un ref:
  - Seleccionar archivo: `beginThumbnailGeneration` invalida cualquier generación anterior; la promesa se registra sólo si su token sigue vigente; el `.then` escribe `coverThumb` sólo con token vigente; el error de una generación obsoleta tampoco toca el estado.
  - Eliminar portada (`handleRemoveCover`): `cancelThumbnailGeneration` invalida el token y neutraliza la promesa; vacía `coverImage` y `coverThumb`; conserva `coverChanged = true` (payload con ambos campos vacíos).
  - Guardar (`handleSubmit`): espera únicamente la promesa pendiente vigente (`getPendingThumbnail`); si la portada cambió durante la espera (token distinto), descarta la miniatura obsoleta. Tras una eliminación no hay promesa que esperar y el payload es exactamente `{ coverImage: '', coverImageThumb: '' }`.
- Intercalación A/B verificada: seleccionar B antes de terminar A invalida A (token + promesa); A no puede actualizar el estado ni registrarse ni guardarse; sólo B lo hace.

**Pruebas nuevas (deterministas, `node --test`, sin jsdom/Jest/Vitest)**: 5 pruebas en `frontend/tests/image-delivery/cover-thumbnail.test.js` (sección tracker) — seleccionar→eliminar→la finalización tardía no restaura la miniatura y el guardado envía ambos vacíos; A→B con A terminando después se ignora y sólo B puede actualizarse/guardarse; eliminar→guardar con payload exacto de ambos campos vacíos; editar sólo metadatos sigue omitiendo ambos campos; tracker fresco sin actividad. `npm run test:image-delivery` pasa de 57 a **62 tests, 62 pass, 0 fail**.

**Sin cambios** en UI, textos, backend, contratos, tamaños, calidad, almacenamiento ni comportamiento ajeno. El commit es `fix: cancel stale deck cover thumbnails`.

## Compatibilidad frontend/backend en ambas direcciones

- **Frontend nuevo + backend anterior**: el backend ignora `cover=thumbnail` (sirve el contrato legacy o el del Corte 1); `resolveDeckCover` usa `coverImage`; `sanitizeDeckSummaries` acepta ambos shapes. Sin cambios en caché/almacenamiento.
- **Backend nuevo + frontend del Corte 1**: ese frontend no envía `cover=thumbnail` → recibe exactamente el contrato del Corte 1 (`serializeSummary`), intacto.
- **Frontend nuevo + backend nuevo**: usa `coverImageThumb || coverImage`.
- Exportación/importación: la exportación usa `Deck.serialize()` (portada completa almacenada, sin miniatura); la importación conserva la portada completa y sólo guarda miniatura si el payload ya trae una válida.

## Pruebas ejecutadas y resultados reales

| Comando | Resultado |
|---|---|
| `node --test test/imageDeliveryContracts.test.js` (backend) | **51 tests, 51 pass, 0 fail** (34 del Corte 0/1 + 17 del Corte 2) |
| `npm test` (backend, suite completa) | **92 tests, 87 pass, 5 fail** — los 5 fallos son exactamente los preexistentes documentados (`aiService.test.js` ×2, `deckRecovery.test.js` ×3); no aumentó el número de fallos; ninguna prueba relacionada con imágenes, mazos, contratos, Home, Library o persistencia falla |
| `npm run test:image-delivery` (frontend) | **57 tests, 57 pass, 0 fail** (36 del Corte 0/1 + 13 del Corte 2 en contratos + 8 de la utilidad de miniaturas) |
| `npm run test:manual-editor:unit` (frontend) | **58 tests, 58 pass, 0 fail** |
| `npm run test:schedule` (frontend) | **44 tests, 44 pass, 0 fail** |
| `npm run test:pdf-extraction` (frontend) | **8 tests, 8 pass, 0 fail** |
| `npm run build` (frontend) | **OK** (13.94 s; aviso preexistente de tamaño de chunk, sin errores) |
| `git diff --check` | limpio |

Sin dependencias nuevas. No se ejecutó Playwright, Safari ni pruebas físicas en iPhone. No se añadió Jest/Vitest/jsdom: las funciones puras de miniaturas y payloads se prueban con `node --test` y el JSX se valida con el build.

## Métricas observadas (implementación productiva, datos sintéticos)

Perfil principal — 500 mazos **con miniatura** (`?contract=indexed&cover=thumbnail`):

| Métrica | Exigido | Observado | Clasificación |
|---|---|---|---|
| JSON total | ≤ 15 MiB | 12,489,819 B (11.91 MiB) | **PASS** |
| `cardBackgrounds` | ausente | 0/500 | **PASS** |
| `coverImage` completa en mazos con miniatura | ausente | 0/500 | **PASS** |
| `coverImageThumb` | presente y válido | 500/500 | **PASS** |
| Metadatos, conteos, estrella, jerarquía | intactos | intactos (`metadataIntact: true`) | **PASS** |
| Mediana `JSON.stringify` Node/V8 | objetivo ≤ 60 ms | **43.81 ms** (15 repeticiones: 41.3–57.8 ms) | **PASS** |

Perfiles medidos adicionalmente (sin aserción de 15 MiB; el beneficio de red completo sólo existe para mazos con miniatura):

| Perfil | JSON | gzip | stringify (mediana, 15 rep.) | Con miniatura | Con portada completa |
|---|---|---|---|---|---|
| 500 mazos antiguos **sin miniatura** (fallback a portada completa) | 22,045,819 B (21.03 MiB) | 16,602,364 B | 85.71 ms | 0/500 | 500/500 |
| Mezcla 250 nuevos + 250 antiguos | 17,267,569 B (16.47 MiB) | 12,941,125 B | 69.69 ms | 250/500 | 250/500 |

Metodología: `serializeLightSummary` productivo sobre documentos `Deck` sintéticos (miniatura Data URL ≈ 24 KiB, portada completa ≈ 43 KiB, 3 fondos de 32 KiB en almacenamiento), 15 repeticiones de `JSON.stringify`, mediana registrada. Comando: `node /tmp/opencode/cut2-metrics.js`; resultado en `/tmp/opencode/cut2-metrics.json`. **`raw-results.json` no fue regenerado ni sobrescrito.** No se convirtió el tiempo en aserción unitaria frágil: el presupuesto de bytes es la única aserción; los tiempos se registran y se clasifican honestamente.

Honestidad del beneficio: los datos actuales heredados (sin miniatura) siguen viajando con portada completa (~21.03 MiB, igual que el Corte 1) hasta que el usuario reemplace su portada o se autorice una migración futura (Corte 4). No se declara que todos los datos cumplan 15 MiB.

## Limitaciones

- Sin migración ni backfill de mazos antiguos (por decisión): usan fallback a `coverImage` hasta reemplazar portada o autorizar el Corte 4.
- La generación de miniaturas depende de APIs del navegador; el contrato de fallo (`''` sin excepción) está cubierto por diseño y por `buildDeckCoverPayload`, pero el pipeline de canvas no se ejecutó en un dispositivo físico.
- IMG-RENDER permanece PARTIAL — PENDING — DEVICE REQUIRED; no se validó Safari/iPhone.
- IMG-CACHE e IMG-STORAGE permanecen PARTIAL; no se tocaron TTL, invalidación, `?t=`, claves de caché ni almacenamiento externo.
- Los perfiles de imagen son bytes sintéticos deterministas (no fotografías reales); no se midió tráfico real ni MongoDB representativo.
- La respuesta de escritura de mazos (POST/PUT) sigue siendo el contrato legacy (congelado desde el Corte 1); el estado local tras guardar conserva la portada completa hasta la próxima recarga de la lista.

## Fallos preexistentes

- 5 tests backend (`aiService.test.js` ×2, `deckRecovery.test.js` ×3) siguen fallando por la configuración del modelo IA del entorno: idénticos a los del HEAD base `0921717` y de las Fases 1C/1D, sin aumento de fallos, documentados como preexistentes y fuera del alcance de este corte. No se corrigieron.

## Rollback

No destructivo y sin migración inversa:

1. El frontend deja de solicitar `cover=thumbnail` (revertir el cambio de URL en `App.jsx`); el backend sirve el contrato del Corte 1.
2. `DeckCard` sigue funcionando con `coverImage` (el resolver acepta ambos campos; no hay dependencia rígida de la miniatura).
3. El backend ignora el campo opcional (ningún endpoint exige `coverImageThumb`).
4. La portada completa nunca fue eliminada; los datos existentes siguen siendo válidos.
5. Las miniaturas almacenadas **no** se borran durante el rollback y no se requiere limpieza.

## Estado de gates

| Gate | Estado |
|---|---|
| IMG-DATA | GO (heredado, sin cambios) |
| IMG-RENDER | **PARTIAL — PENDING — DEVICE REQUIRED** (sin cambios; no se cierra en la Fase 1E) |
| IMG-CACHE | **PARTIAL** (sin cambios; política TTL/invalidación pendiente; `?t=` intacto) |
| IMG-STORAGE | **PARTIAL** (sin cambios; almacenamiento MongoDB intacto, sin S3/GridFS/GC) |
| IMG-MIGRATION | GO — sin migración ni backfill en este corte (mazos antiguos con fallback) |
| IMG-CONSUMERS | GO — consumidores de portada actualizados (`DeckCard`, `DeckModal`, `App`, `safeLocalStorage` vía resumen ligero) |
| IMG-IMPLEMENTATION | Corte 0, 1 y 2 TERMINADOS; Cortes 3–5 **no implementados** |

## Veredicto

**PASS** (reafirmado tras la corrección puntual de cancelación de miniaturas pendientes)

- Tres variantes de contrato coexistiendo exactamente como se exigió, negociadas por una única utilidad productiva; legacy y Corte 1 congelados (verificados por tests).
- Miniaturas generadas en el frontend con presupuesto de ~24 KiB, sin dependencias nuevas y sin bloquear el guardado ante fallos de canvas/decodificación.
- Protección del flujo de edición implementada y probada: editar metadatos no toca imágenes; la miniatura nunca sustituye a la portada completa; la carrera asíncrona de eliminación con miniatura pendiente quedó corregida y cubierta por pruebas deterministas (token invalidation + neutralización de la promesa).
- Presupuesto de 500 mazos con miniatura cumplido con la implementación productiva (11.91 MiB ≤ 15 MiB; mediana stringify 43.81 ms ≤ 60 ms); perfiles legacy y mixto medidos y documentados honestamente.
- Suites completas tras la corrección: backend 51/51 de contratos; 87/92 total con los mismos 5 fallos preexistentes; frontend 62/62, 58/58, 44/44, 8/8; build OK; `git diff --check` limpio.
- Sin cambios de almacenamiento, caché, TTL, navegación, búsqueda/orden, jerarquía académica, editor de tarjetas, repaso, sesiones, PDF ni dependencias. Cortes 3–5 sin implementar.
