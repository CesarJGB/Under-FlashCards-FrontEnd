# Fase 1G — Reporte de cierre del Corte 5A (observabilidad del contrato legacy)

Documento de cierre de la Fase 1G. Implementa **exclusivamente** el Corte 5A del plan de [implementation-cuts.md](./implementation-cuts.md): telemetría temporal y segura para determinar, durante los **14 días posteriores al despliegue**, si todavía existen clientes que solicitan el contrato legacy de entrega de imágenes. Este corte **no elimina compatibilidad ni cambia respuestas**; sólo observa y registra una línea JSON por petición. No implementa el Corte 5B.

## Estado del repositorio

| Dato | Resultado |
|---|---|
| Rama | `main` |
| HEAD inicial efectivo | `f1e98ea927a69431964dce8ffd8c2d6a7bec17b4` |
| `origin/main` en el inicio | `f1e98ea927a69431964dce8ffd8c2d6a7bec17b4` |
| HEAD esperado indicado en el encargo | `f1e98ea927a69431964dce8ffd8c2d6a7bec17b4` |
| Drift | **Ninguno**: `HEAD == origin/main == HEAD esperado` |
| Estado inicial del árbol | `?? session-ses_ffe3.md` (sin seguimiento, ajeno; no entra al commit) |
| Corte 4 limitado | Aprobado (Fase 1F); **migración real NOT RUN** |
| Corte 5B | **BLOCKED** hasta reunir métricas reales de la ventana |

La entrada no rastreada preexistente no se modificó, no se leyó como evidencia y no entra al commit.

## Objetivo y alcance

**Objetivo**: durante 14 días posteriores al despliegue del backend, medir si aún existen clientes que solicitan el contrato legacy en las cinco lecturas negociadas. El criterio es estricto: **cualquier petición con `contract` distinto del valor exacto `indexed` produce NO-GO** (un cliente legacy sigue vivo) y reinicia la ventana de observación.

**Alcance implementado:**

1. **Utilidad de telemetría** (`backend/src/utils/imageContractTelemetry.js`): clasificadores puros y emisión de una línea JSON estable por petición.
2. **Instrumentación** de exactamente las cinco lecturas negociadas, registrando **una línea por petición al recibirla** (antes de cualquier retorno normal, 404 o fallo posterior).
3. **Pruebas deterministas** (`backend/test/imageContractTelemetry.test.js`): 21 pruebas Node sin MongoDB ni red.
4. **Documentación**: este reporte y actualizaciones localizadas.

**No implementado (fuera de alcance):**

- Eliminación del contrato legacy, de `Flashcard.serialize()`, de ramas legacy o del fallback del resolver frontend.
- Cambios en respuestas, payloads, status HTTP o ACK de escrituras.
- Cambios en el pipeline IA, en `Deck.cardBackgrounds`, `bgImageIndex`, `contentImage`, miniaturas o en el script del Corte 4.
- Cambios frontend, UI, caché, Service Worker o assets.
- Migraciones, conexiones a bases reales, dependencias nuevas, benchmarks o comandos con credenciales.

## Esquema del evento

Cada petición produce como máximo una línea JSON estable, emitida con `console.log` del backend (activa automáticamente al desplegar):

```json
{
  "event": "image_delivery_contract_usage",
  "schemaVersion": 1,
  "at": "fecha ISO UTC",
  "surface": "deck-list",
  "contract": "indexed",
  "cover": "thumbnail"
}
```

Clasificaciones (únicas permitidas):

| Campo | Valores | Significado |
|---|---|---|
| `contract` | `indexed` | valor exacto `indexed` |
| `contract` | `legacy-missing` | la propiedad no fue enviada (legacy por defecto) |
| `contract` | `legacy-other` | cualquier otro valor o tipo, incluyendo vacío o array (legacy) |
| `cover` | `thumbnail` | valor exacto `thumbnail` (sólo `deck-list`) |
| `cover` | `absent` | la propiedad no fue enviada (sólo `deck-list`) |
| `cover` | `other` | cualquier otro valor o tipo, incluyendo vacío o array (sólo `deck-list`) |
| `cover` | `not-applicable` | superficie que no negocia cover (todo excepto `deck-list`) |

## Superficies observadas

La instrumentación cubre exactamente las cinco lecturas negociadas, clasificadas por su consumo en el frontend productivo:

| Superficie | Tipo | Ruta | Handler |
|---|---|---|---|
| `deck-list` | **activa** | `GET /api/decks/:userId` | `deckController.getDecks` |
| `deck-cards` | **activa** | `GET /api/flashcards/deck/:deckId` | `flashcardController.getCardsByDeck` |
| `continuous-session` | dormida | `GET /api/decks/:deckId/continuous-session` | `reviewController.getContinuousSessionCards` |
| `normal-session` | dormida | `GET /api/decks/:deckId/normal-session` | `reviewController.getNormalSessionCards` |
| `all-cards` | **activa** | `GET /api/decks/:deckId/all-cards` | `reviewController.getAllSessionCards` |

Clasificación verificada por consumidores en el frontend productivo (HEAD del 5A):

- **Activas** — el frontend vigente las solicita directamente: `deck-list` desde `App.jsx` (Home/Library: `GET /api/decks/:userId?...&contract=indexed&cover=thumbnail`); `deck-cards` desde `DeckInterior.jsx` y `StudySection.jsx` (`GET /api/flashcards/deck/:deckId?contract=indexed`, abrir mazo y datos de exportación PDF); `all-cards` desde `SessionPlayer.jsx` (`GET /api/decks/:deckId/all-cards?userId=...&contract=indexed`), que sirve a **ambos** modos de repaso: normal y continuo.
- **Dormidas** — `continuous-session` y `normal-session` siguen existiendo en el backend como rutas de compatibilidad (`backend/src/routes/deckRoutes.js`) y conservan su instrumentación, pero **no tienen consumidores frontend productivos**: no hay ninguna referencia a esas rutas en `frontend/src` (sólo aparecen en el backend, en pruebas y en documentación). El uso normal del producto no las ejercita.

La línea se registra en la **primera línea de cada handler**, antes de cualquier retorno normal, 404 o fallo posterior. No se instrumentan escrituras ni rutas ajenas. Una superficie fuera del conjunto permitido no registra nada.

## Privacidad

La utilidad sólo observa `req.query.contract` y `req.query.cover` (clasificados, nunca crudos). Está prohibido y no ocurre registrar:

- `userId`, `deckId`, ids de tarjetas, IP, URL o query completa;
- valores crudos desconocidos (la línea sólo contiene clasificaciones);
- headers, cookies, tokens o User-Agent;
- preguntas, respuestas o contenido;
- imágenes o Data URLs.

Verificado por pruebas: la línea emitida contiene exactamente las seis claves del esquema y nunca transporta identificadores, tokens, query completa ni `data:` URLs, aunque la petición real los contenga.

## Garantías operativas

- **No hace fallar ninguna petición**: un logger que lance es atrapado y la ejecución continúa (probado).
- **No cambia payloads ni status HTTP**: observación pura; sin contadores en memoria como evidencia.
- **Sin base de datos, endpoint nuevo, dependencia ni servicio externo**: sólo `console.log`.
- **Activa automáticamente al desplegar** el backend (sin configuración ni flags).
- **Retirable íntegramente en el Corte 5B**: utilidad + llamadas en los controladores + pruebas.

## Consulta de logs (sin asumir un nombre fijo de contenedor)

Los eventos llegan a los logs estándar del proceso Node. En Coolify/Docker, localizar el contenedor del backend y filtrar por el evento sin asumir nombre fijo, por ejemplo:

```bash
# Enumerar contenedores (ajustar el filtro según el proyecto Coolify)
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i backend

# Volcar las líneas del evento del contenedor correspondiente (ej. backend-1)
docker logs --since 24h <contenedor-backend> 2>&1 | grep image_delivery_contract_usage

# Resumen por superficie/contrato del periodo (contar líneas JSON)
docker logs <contenedor-backend> 2>&1 | grep image_delivery_contract_usage \
  | jq -r '[.surface, .contract, .cover] | @tsv' | sort | uniq -c
```

Ningún comando de este corte asume un nombre concreto de contenedor: se enumera primero y se filtra después. Los logs deben conservarse al menos la duración de la ventana (política de retención del despliegue) para poder auditar los 14 días completos.

## Ventana de observación (14 días)

- La ventana de 14 días **sólo comienza después de desplegar el SHA** de este corte: `inicio = primer evento observado tras el despliegue` (o la marca de despliegue); `fin = inicio + 14 días`.
- **Cualquier petición legacy** (`legacy-missing` o `legacy-other`) en **cualquiera de las cinco superficies** durante la ventana produce **NO-GO** y **reinicia la ventana** desde ese evento.
- **La ausencia total de tráfico no demuestra readiness**: una ventana sin eventos es inconclusa; se requiere tráfico real representativo.
- **Evidencia exigida por tipo de superficie**:
  - **Activas** (`deck-list`, `deck-cards`, `all-cards`): tráfico indexado **positivo y representativo** durante la ventana; el uso normal del producto debe ejercerlas.
  - **Dormidas** (`continuous-session`, `normal-session`): **no se exige tráfico indexado**. El gate exige (a) una búsqueda estática al cierre confirmando que siguen sin consumidores productivos en `frontend/src` y (b) cero peticiones legacy. Una petición indexada eventual en una superficie dormida puede registrarse, pero no es una precondición para aprobar.
- Aprobación del Corte 5B sólo con una ventana completa de 14 días con cero peticiones legacy en las cinco superficies y tráfico indexado positivo en las tres superficies activas.

## Tabla de observación (se rellena tras el despliegue; vacía hoy)

| SHA desplegado | Inicio UTC | Fin UTC | deck-list | deck-cards | continuous-session | normal-session | all-cards | Peticiones legacy | Veredicto |
|---|---|---|---|---|---|---|---|---|---|
| _pendiente de despliegue_ | — | — | — | — | — | — | — | — | — |

Evidencia esperada por columna: para las superficies **activas** (`deck-list`, `deck-cards`, `all-cards`) se registra tráfico indexado positivo y representativo; para las **dormidas** (`continuous-session`, `normal-session`) **no se exige tráfico** — el gate exige la búsqueda estática de consumidores al cierre y cero peticiones legacy. La tabla se rellena únicamente con métricas reales de la ventana; no se registran conteos inventados.

## Estado inicial

- **OBSERVATION NOT STARTED**: la ventana no ha comenzado; el SHA de este corte aún no está desplegado.
- **Corte 5B: BLOCKED** hasta aprobar los 14 días con cero peticiones legacy.
- **Migración del Corte 4: NOT RUN** (sin cambios respecto a la Fase 1F).

## Flujos que deben usarse normalmente durante la ventana

Para que la observación sea representativa, la operación normal del producto debe ejercer (al menos una vez durante la ventana): Home/Library (lista de mazos), abrir un mazo (detalle), repaso normal, repaso continuo y exportación PDF. Eventos 5A que produce cada flujo:

- **Home/Library** → `deck-list`: `App.jsx` solicita `GET /api/decks/:userId?...&contract=indexed&cover=thumbnail`.
- **Abrir un mazo y exportar su PDF** → `deck-cards`: `DeckInterior.jsx`/`StudySection.jsx` solicitan `GET /api/flashcards/deck/:deckId?contract=indexed`; la exportación PDF reutiliza esas tarjetas ya cargadas (no añade una superficie 5A propia).
- **Repaso normal y repaso continuo** → `all-cards`: ambos modos montan `SessionPlayer.jsx`, que solicita `GET /api/decks/:deckId/all-cards?userId=...&contract=indexed` y arma los lotes en memoria. **Ninguno de los dos modos llama a `continuous-session` ni a `normal-session`.**

**Escrituras no instrumentadas**: crear, editar, borrar, importar y crear lotes son escrituras; la telemetría del 5A sólo observa las cinco lecturas y **no genera eventos 5A para ellas**. Durante la ventana deben probarse funcionalmente (el Corte 5B convertirá sus ACK al envelope indexado), pero no aportan líneas de observación.

## Pruebas ejecutadas y resultados reales

| Comando | Resultado |
|---|---|
| `node --test test/imageContractTelemetry.test.js` (backend) | **21 tests, 21 pass, 0 fail** |
| `node --test test/imageDeliveryContracts.test.js` (backend) | **51 tests, 51 pass, 0 fail** |
| `npm test` (backend, suite completa) | **158 tests, 153 pass, 5 fail** — los 5 fallos son exactamente los preexistentes documentados (`aiService.test.js` ×2 en líneas 70 y 101; `deckRecovery.test.js` ×3 en líneas 91, 116 y 135); no aumentó el número de fallos; ninguna prueba de imágenes, contratos, mazos, sesiones o telemetría falla |
| `npm run test:image-delivery` (frontend) | **74 tests, 74 pass, 0 fail** |
| `git diff --check` | limpio |

## Fallos preexistentes

- 5 tests backend (`aiService.test.js` ×2, `deckRecovery.test.js` ×3) siguen fallando por la configuración del modelo IA del entorno: idénticos a los documentados en las Fases 1C/1D/1E/1F y al HEAD base `f1e98ea`. No aumentó el número de fallos; ninguna prueba relacionada con este corte falla. No se corrigieron (fuera de alcance).

## Verificaciones no ejecutadas

- Playwright (`test:manual-editor`), benchmarks IA y migraciones: **no ejecutados** (prohibidos por el encargo; Playwright además puede carecer de binarios en este entorno).
- Build frontend: no requerido (cero cambios frontend).
- Despliegue y observación real: **no ocurren en este corte**; son el siguiente paso.

## Honestidad de las métricas

- **No se recopilaron ni inventaron métricas durante la implementación local.** La tabla de observación está vacía a propósito; los únicos números de este reporte son conteos de pruebas.
- No se ejecutó ninguna petición real contra ningún entorno; la utilidad sólo fue verificada con pruebas deterministas con loggers simulados.

## Futuro Corte 5B (documentado, NO implementado)

Después de aprobar los 14 días de observación (cero peticiones legacy con tráfico real), el Corte 5B deberá:

1. Hacer **indexadas por defecto** las cinco lecturas (dejar de negociar; el contrato indexado pasa a ser el único).
2. **Retirar la negociación y las ramas legacy** de `imageDelivery.js`, `Flashcard.serialize()` (expansión `bgImage`) y `Deck.serialize()`/`serializeSummary` en lo que corresponda a listas.
3. Convertir los **ACK de crear, actualizar y crear lote** (POST/PUT `/flashcards`, POST `/flashcards/bulk`) al **envelope indexado** y adaptar sus consumidores frontend (flujo optimista del editor).
4. Revisar el **pipeline IA V1** (legacy) y su serialización antes de retirarlo.
5. Eliminar `Flashcard.serialize()` **sólo cuando no queden usos** (verificar consumidores antes de borrar).
6. Retirar el **fallback de respuestas legacy del resolver frontend** (`extractAndResolveCards` y ramas array/sesión legacy de `frontend/src/lib/imageDelivery.js`).
7. Evitar `cardBackgrounds` en listas y respuestas CRUD (ya ausente en listas; completar en ACK).
8. **Conservar `bgImage` materializado dentro del frontend** y como entrada de escritura (el editor y el PDF lo necesitan tal cual).
9. **Conservar `Deck.cardBackgrounds` en MongoDB** (el almacenamiento no cambia; sólo el contrato HTTP).
10. **Conservar `cardBackgrounds` en exportación/importación** (el formato de archivo sigue siendo indexado).
11. **Conservar intacta la herramienta del Corte 4** (`migrate:image-backgrounds`), que sigue NOT RUN y disponible para normalizar datos cuando se autorice.
12. **No confundir contrato HTTP con almacenamiento**: retirar el shape legacy de las respuestas no borra ni migra datos.
13. **Retirar la telemetría temporal** de este corte (utilidad, llamadas en controladores y pruebas) cuando 5B termine.

Este corte **sólo documenta** el 5B; no lo implementa.

## Rollback

Sin cambios de contrato ni datos: revertir el commit elimina la telemetría y deja el backend exactamente como estaba. No existe migración inversa ni riesgo para clientes.

## Veredicto

**PASS**

- Telemetría temporal, segura y pura implementada: una línea JSON estable por petición en las cinco lecturas, clasificaciones exactas de `contract` y `cover`, superficies restringidas, privacidad garantizada por diseño y por prueba, logger que nunca rompe la petición.
- Contrato legacy intacto: ningún payload, status, serializador ni escritura fue modificado (contract tests 51/51 en verde, incluyendo los congelados).
- Pruebas nuevas 21/21 en verde; suite backend sin regresiones (sólo los 5 fallos preexistentes de IA); frontend `test:image-delivery` 74/74 sin cambios frontend.
- Documentación del corte, de la ventana de 14 días y del futuro Corte 5B registrada; tabla de observación vacía.
- OBSERVATION NOT STARTED; Corte 5B BLOCKED; migración del Corte 4 NOT RUN.
