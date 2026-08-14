# Fase 1F — Reporte de cierre del Corte 4 (normalización segura de cardBackgrounds)

Documento de cierre de la Fase 1F. Implementa **exclusivamente** el Corte 4 **limitado** del plan de [implementation-cuts.md](./implementation-cuts.md): una herramienta segura, idempotente y gradual para eliminar entradas huérfanas o duplicadas de `Deck.cardBackgrounds` y remapear atómicamente los `Flashcard.bgImageIndex` afectados. Este corte **prepara la migración, sus pruebas y su documentación; no ejecuta la migración contra ninguna base real**.

## Estado del repositorio

| Dato | Resultado |
|---|---|
| Rama | `main` |
| HEAD inicial efectivo | `d1d67ebff6010f7ec676e6ca75c17b72ea6dbeb1` |
| HEAD esperado indicado en el encargo | `d1d67ebff6010f7ec676e6ca75c17b72ea6dbeb1` |
| Drift | **Ninguno**: `HEAD == HEAD esperado`; árbol de trabajo limpio (`git status --short` sin salida) |
| Corte 2 | Aprobado y terminado (Fase 1E) |
| Corte 3 | **Omitido deliberadamente** (ver abajo) |
| Corte 5 | **No implementado** (fuera de alcance; exige métricas sostenidas de tráfico legacy ≈ 0) |

## Corte 3 omitido deliberadamente

El plan original reservaba el Corte 3 a "almacenamiento y entrega futura de assets" (Mongo/GridFS/objetos, miniaturas servidas, GC de assets), que requiere decisión humana de proveedor, presupuesto y una fase de medición con distribución real. **En esta Fase 1F se omitió deliberadamente el Corte 3**: no se implementó ningún almacenamiento externo, endpoint de assets, extracción de Data URLs ni GC de assets. El Corte 4 limitado de esta fase no depende de él (depende de C1/C2, ya terminados) y queda como herramienta de normalización de datos legados, no como infraestructura de almacenamiento.

## Alcance real del Corte 4 (limitado)

**Implementado:**

1. **Planificador puro** (`backend/src/utils/imageBackgroundCompaction.js`): recibe el array almacenado de fondos y las tarjetas de un deck; devuelve un plan determinista con nuevo `cardBackgrounds`, actualizaciones de `bgImageIndex` identificadas por tarjeta, estadísticas antes/después, huérfanos, duplicados, referencias inválidas normalizadas y estimación conservadora de tamaño eliminado (sin imprimir Data URLs).
2. **Parseo de argumentos puro** (`backend/src/utils/imageBackgroundMigrationArgs.js`): validación del modo dry-run/apply, alcance único y protecciones del modo de escritura; separado de los efectos de base de datos para poder probarse sin credenciales.
3. **Script operacional** (`backend/scripts/migrateImageBackgrounds.js` + comando `npm run migrate:image-backgrounds -- ...`): procesamiento por deck, atómico vía transacción en modo apply, reanudable e idempotente, salida JSON sin contenido sensible.
4. **Pruebas deterministas** (`backend/test/imageBackgroundCompaction.test.js`, `backend/test/imageBackgroundMigrationArgs.test.js`): 45 pruebas Node sin conexión a MongoDB.
5. **Documentación**: este reporte y correcciones localizadas de recuentos obsoletos.

**No implementado (fuera de alcance de este corte):**

- Backfill o generación de `coverImageThumb`; migración de Data URLs a almacenamiento externo; eliminación del contrato legacy.
- Cambios en API, frontend, UI, cachés o Service Worker.
- Limpieza automática dentro de las rutas de crear, actualizar o borrar tarjetas (el plan del Corte 4 original mencionaba esa limpieza; este corte limitado no la toca).
- Modificaciones a `contentImage`.
- Nuevas dependencias de imágenes (Sharp, Canvas o equivalentes).
- Acceso a credenciales ni ejecución contra producción, staging o una base local configurada.
- Git: no hubo `git add`, commit, push ni apertura de PR.

## Diferencia entre "herramienta implementada" y "migración aplicada"

- **Herramienta implementada**: el planificador, el parseo de argumentos, el script y sus pruebas existen en el repositorio y están verificados con pruebas deterministas. La herramienta es la que se usará cuando se autorice la migración.
- **Migración aplicada**: ejecutar el script con `--apply` (más `--backup-confirmed` y `--maintenance-confirmed`) contra una base real, modificando documentos. **Esto NO ocurrió en este corte y queda expresamente NOT RUN.**

Tener la herramienta no implica que los datos hayan cambiado: mientras no se ejecute `--apply`, los mazos conservan exactamente su `cardBackgrounds` y sus `bgImageIndex` actuales.

## Migración de producción: NOT RUN

- No se ejecutó el script contra ninguna base, ni en dry-run ni en apply.
- No se ejecutó ningún comando de base de datos, despliegue, credenciales, commit o push durante este corte.
- El único contacto con el script en este corte fue: pruebas de los módulos puros (planificador y argumentos) y arranque del script sin `MONGO_URL` para verificar la salida `BLOCKED`/`USAGE` (no llega a conectar).

## Precondiciones para una futura aplicación (cuando se autorice)

1. **Backup verificado**: snapshot/restore probado de la base completa antes de la ventana (rollback del Corte 4 = restaurar backup; el dry-run previo reduce el riesgo).
2. **Ventana de mantenimiento**: la operación puede ser larga en bases grandes; cada deck se procesa en una transacción corta, pero el conjunto no es una única transacción global.
3. **MongoDB con soporte de transacciones**: réplica set o mongos. El script verifica el soporte con una transacción de sólo lectura **antes de la primera escritura** y termina como `BLOCKED` sin modificar nada si no está disponible. **No existe fallback de escritura no atómico.**
4. Revisión humana del dry-run: decks que cambiarían, tarjetas que cambiarían, fondos antes/después, huérfanos, duplicados, referencias inválidas y tamaño estimado eliminado.

## Procedimiento (futuro, requiere autorización)

### 1. Dry-run

```bash
cd backend
npm run migrate:image-backgrounds -- --all --confirm-all
# o acotado:
npm run migrate:image-backgrounds -- --user-id=<id>
npm run migrate:image-backgrounds -- --deck-id=<id>
```

El modo sin `--apply` es **siempre dry-run**: sólo lee y no escribe. La salida JSON incluye: decks examinados, decks que cambiarían, decks omitidos (si se detuvo por error), tarjetas que cambiarían, fondos antes/después, huérfanos, duplicados, referencias inválidas, tamaño estimado eliminado (bytes UTF-8 conservadores, sin imprimir Data URLs) y errores por deck.

### 2. Aplicación

```bash
npm run migrate:image-backgrounds -- --all --confirm-all \
  --apply --backup-confirmed --maintenance-confirmed
```

La escritura exige simultáneamente `--apply`, `--backup-confirmed` y `--maintenance-confirmed`. Por cada deck, dentro de una transacción: se leen deck y tarjetas en la sesión, se calcula el plan, se actualizan únicamente las tarjetas cuyo índice cambia, se reemplaza `cardBackgrounds` y se confirma. Si un deck falla, el script informa con precisión qué decks anteriores llegaron a confirmarse y detiene la ejecución. Es reanudable e idempotente: los decks ya procesados producen cero cambios en una segunda pasada.

### 3. Verificación

- Reejecutar el dry-run: debe reportar cero cambios pendientes (idempotencia).
- Comprobar en la base (o en el reporte del script) que `0` índices finales quedan rotos: cada `bgImageIndex` resultante es `-1` o apunta a una entrada válida cuyo fondo resuelto es exactamente el mismo string que antes.
- Contract tests de entrega de imágenes (backend y frontend) en verde.

### 4. Rollback

- Restaurar el backup verificado de la precondición 1.
- La migración es no destructiva si se conserva el backup; nunca se ejecuta automáticamente.

## Contrato exacto implementado

### Planificador (`planCardBackgroundCompaction(storedBackgrounds, cards)`)

- Conserva únicamente entradas referenciadas válidamente (índice entero, no negativo, en rango, valor string no vacío).
- Orden final estable basado en el orden original de `cardBackgrounds`; entre strings iguales gana la primera aparición.
- Deduplicación exclusivamente por igualdad exacta de string; varios índices con el mismo string se remapean al mismo índice final.
- Índice no entero, negativo, fuera de rango o que apunte a valor vacío/no-string → `-1`.
- `contentImage` y cualquier otro campo de la tarjeta intactos; el plan sólo transporta `{ cardId, bgImageIndex }`.
- Para toda referencia válida, el fondo visual resuelto antes y después es exactamente el mismo string.
- Idempotencia: aplicar el plan y volver a calcularlo produce cero cambios.
- No muta argumentos; fail-fast si una tarjeta no tiene identificador (`id`/`_id`).
- Salida: `{ changed, cardBackgrounds, cardUpdates, stats }` con `stats = { backgroundsBefore, backgroundsAfter, cardsExamined, cardsUpdated, orphansRemoved, duplicatesRemoved, invalidReferencesNormalized, estimatedBytesRemoved }`. La estimación de bytes es conservadora: suma UTF-8 sólo de los strings que dejan de persistirse (huérfanos + duplicados colapsados; entradas no-string aportan 0).

### Argumentos (`parseImageBackgroundMigrationArgs(argv)`)

- Sin `--apply` → siempre dry-run.
- Exactamente un alcance: `--deck-id=<id>` | `--user-id=<id>` | `--all`.
- `--all` exige además `--confirm-all`; `--confirm-all` sin `--all` es error.
- Escritura exige simultáneamente `--apply`, `--backup-confirmed` y `--maintenance-confirmed`.
- Flag desconocido, valor vacío, ObjectId mal formado o más de un alcance → `MigrationUsageError` (salida `USAGE`, exit 1).

### Script (`npm run migrate:image-backgrounds`)

- `--apply` verifica soporte de transacciones antes de la primera escritura; sin soporte → `BLOCKED`, exit 2, sin modificar nada.
- Cada deck atómicamente en una transacción (apply): leer deck y tarjetas en la sesión → calcular plan → actualizar sólo tarjetas con cambio → reemplazar `cardBackgrounds` → confirmar.
- Sin fallback de escritura no atómico.
- Falla de un deck → error preciso con decks confirmados anteriores y detención de la ejecución.
- Reanudable e idempotente; patrón `MONGO_URL || MONGO_URI`, `DB_NAME || 'flashcards'`, conexión/desconexión de mongoose idéntico a los scripts existentes.
- Salida JSON estructurada sin Data URLs, preguntas, respuestas, `contentImage` ni contenido sensible (sólo ids, conteos y mensajes). Estados: `OK` (exit 0), `FAILED` (exit 1), `USAGE` (exit 1), `BLOCKED` (exit 2).

## Archivos modificados o creados

| Archivo | Acción | Contenido |
|---|---|---|
| `backend/src/utils/imageBackgroundCompaction.js` | creado | planificador puro del Corte 4 |
| `backend/src/utils/imageBackgroundMigrationArgs.js` | creado | parseo y validación puros de argumentos |
| `backend/scripts/migrateImageBackgrounds.js` | creado | script operacional (dry-run/apply, transacciones, salida JSON) |
| `backend/package.json` | modificado | comando `migrate:image-backgrounds` |
| `backend/test/imageBackgroundCompaction.test.js` | creado | 23 pruebas deterministas del planificador |
| `backend/test/imageBackgroundMigrationArgs.test.js` | creado | 22 pruebas deterministas del parseo |
| `docs/performance-audit/research/image-delivery/phase-1f-cut-4-report.md` | creado | este reporte |
| `docs/performance-audit/research/image-delivery/README.md` | modificado | índice del reporte y estado de cortes |
| `docs/performance-audit/research/image-delivery/implementation-readiness.md` | modificado | estado del Corte 3/4 y recuentos vigentes |
| `docs/performance-audit/research/image-delivery/phase-1e-cut-2-report.md` | modificado | corrección localizada: total vigente de `test:image-delivery` (74/74, no 57/57) |

## Pruebas ejecutadas y resultados reales

| Comando | Resultado |
|---|---|
| `node --test test/imageBackgroundCompaction.test.js test/imageBackgroundMigrationArgs.test.js` (backend) | **45 tests, 45 pass, 0 fail** |
| `node --test test/imageDeliveryContracts.test.js` (backend) | **51 tests, 51 pass, 0 fail** |
| `npm test` (backend, suite completa) | ver sección "Fallos preexistentes" |
| `npm run test:image-delivery` (frontend) | **74 tests, 74 pass, 0 fail** |
| `git diff --check` | limpio |
| `git status --short` | sólo los archivos del corte |
| `git diff --stat` | ver al final del reporte de entrega |

## Fallos preexistentes

- 5 tests backend (`aiService.test.js` ×2, `deckRecovery.test.js` ×3) siguen fallando por la configuración del modelo IA del entorno: idénticos a los documentados en las Fases 1C/1D/1E y al HEAD base `d1d67eb`. No aumentó el número de fallos; ninguna prueba relacionada con imágenes, mazos o contratos falla. No se corrigieron (fuera de alcance).

## Riesgos residuales

- **Nuevos huérfanos post-migración**: el flujo runtime (crear, actualizar, borrar tarjetas) no se modifica en este corte; mientras no exista una política posterior que elimine o reutilice fondos en las rutas de escritura, pueden aparecer nuevos huérfanos. La herramienta es reejecutable para limpiarlos.
- **Ganancia esperada no cuantificada**: menor tamaño persistido del deck y de exportaciones legacy tras la migración; la ganancia real no puede cuantificarse sin un inventario de datos (no se ejecutó nada contra una base).
- **Transacciones**: el modo apply exige réplica set o mongos; la verificación de soporte ocurre antes de la primera escritura, pero el procesamiento global no es una única transacción (por diseño, para ser reanudable).
- **Entorno de pruebas**: el script (efectos de base de datos) no se ejecutó contra ninguna base; sólo los módulos puros y el arranque `BLOCKED`/`USAGE` sin credenciales fueron verificados.
- **Portadas legacy**: las portadas antiguas sin `coverImageThumb` conservan el fallback actual a `coverImage` (Corte 2). No se generó ni se declara ningún backfill de miniaturas.

## Gates

| Gate | Estado |
|---|---|
| IMG-MIGRATION | **Herramienta GO — migración NOT RUN** (preparada: planificador, script, pruebas y documentación; no ejecutada contra ninguna base) |
| IMG-STORAGE | PARTIAL (sin cambios; sin assets, sin backfill) |
| IMG-CACHE / IMG-RENDER | Sin cambios (política de caché y validación en dispositivo siguen pendientes) |
| IMG-CONSUMERS | Sin cambios |
| IMG-IMPLEMENTATION | Cortes 0, 1 y 2 terminados; Corte 3 omitido deliberadamente; Corte 4 (limitado) herramienta terminada; Corte 5 no implementado |

## Veredicto

**PASS**

- Herramienta de migración completa según el contrato del encargo: planificador puro (estable, deduplicado por igualdad exacta, normalización a `-1`, idempotente, inmutable), parseo de argumentos con todas las protecciones del modo apply, script operacional con transacciones, detención con informe de confirmados, salida JSON sin contenido sensible, y 45 pruebas deterministas nuevas en verde.
- Migración real **NOT RUN** contra cualquier base; sin acceso a credenciales ni ejecución en entornos reales.
- Suites existentes sin regresiones: contract tests backend 51/51; frontend `test:image-delivery` 74/74; `npm test` mantiene únicamente los 5 fallos históricos preexistentes de `aiService`/`deckRecovery`.
- Documentación actualizada con el Corte 3 omitido, el alcance real del Corte 4, la diferencia herramienta/migración, el procedimiento y los riesgos; corregidos los recuentos obsoletos (74/74 en lugar de 57/57).
- `git diff --check` limpio; sin stage, commit ni push.
