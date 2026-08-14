// FILE: backend/scripts/migrateImageBackgrounds.js
// Fase 1F — Corte 4: migración operacional de Deck.cardBackgrounds.
//
// Herramienta segura, idempotente y gradual para eliminar entradas huérfanas
// o duplicadas de Deck.cardBackgrounds y remapear atómicamente los
// Flashcard.bgImageIndex afectados. NO ejecuta nada contra la base de forma
// implícita: sin --apply siempre es dry-run y no escribe.
//
// Uso (desde backend/):
//   npm run migrate:image-backgrounds -- --deck-id=<id>          # dry-run
//   npm run migrate:image-backgrounds -- --user-id=<id>          # dry-run
//   npm run migrate:image-backgrounds -- --all --confirm-all     # dry-run
//   npm run migrate:image-backgrounds -- --deck-id=<id> \
//       --apply --backup-confirmed --maintenance-confirmed      # escribe
//
// Contrato del script:
// - Modo sin --apply: SIEMPRE dry-run.
// - Exactamente un alcance: --deck-id=<id> | --user-id=<id> | --all.
// - --all exige además --confirm-all.
// - La escritura exige simultáneamente --apply, --backup-confirmed y
//   --maintenance-confirmed (la validación vive en
//   src/utils/imageBackgroundMigrationArgs.js).
// - --apply verifica soporte de transacciones ANTES de la primera escritura;
//   si MongoDB no lo soporta termina como BLOCKED sin modificar nada. No hay
//   fallback de escritura no atómico.
// - Cada deck se procesa atómicamente en una transacción: leer deck y
//   tarjetas dentro de la sesión, calcular el plan, actualizar únicamente las
//   tarjetas cuyo índice cambie, reemplazar cardBackgrounds y confirmar.
// - Reanudable e idempotente: los decks ya procesados producen cero cambios
//   en una segunda pasada; si un deck falla, se informa con precisión qué
//   decks anteriores llegaron a confirmarse y la ejecución se detiene.
// - La salida es JSON estructurado sin Data URLs, preguntas, respuestas,
//   contentImage ni contenido sensible (sólo ids, conteos y mensajes).

require('dotenv').config();

const mongoose = require('mongoose');
const Deck = require('../src/models/Deck');
const Flashcard = require('../src/models/Flashcard');
const { planCardBackgroundCompaction } = require('../src/utils/imageBackgroundCompaction');
const {
  parseImageBackgroundMigrationArgs,
  MigrationUsageError,
} = require('../src/utils/imageBackgroundMigrationArgs');

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_BLOCKED = 2;

const USAGE_TEXT =
  'node scripts/migrateImageBackgrounds.js (--deck-id=<id> | --user-id=<id> | --all [--confirm-all]) [--apply --backup-confirmed --maintenance-confirmed]';

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function scopePayload(parsed) {
  if (parsed.scope === 'all') return { type: 'all' };
  if (parsed.scope === 'deck') return { type: 'deck', deckId: parsed.deckId };
  return { type: 'user', userId: parsed.userId };
}

// Verifica el soporte real de transacciones con una transacción de sólo
// lectura (no modifica nada). En un standalone MongoDB falla con el error de
// "replica set o mongos" antes de la primera escritura.
async function assertTransactionSupport() {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Deck.findOne({}).session(session);
    });
  } catch (error) {
    throw new Error(
      `MongoDB no soporta transacciones (se requiere réplica set o mongos): ${error.message}`
    );
  } finally {
    await session.endSession();
  }
}

// Procesa un deck. En dry-run sólo lee; en modo apply procesa el deck en una
// transacción atómica. Devuelve el resumen por deck (sin contenido sensible).
async function processDeck(deckId, parsed) {
  if (parsed.dryRun) {
    const deck = await Deck.findById(deckId, { cardBackgrounds: 1 }).lean();
    if (!deck) throw new Error('El deck no existe.');
    const cards = await Flashcard.find({ deckId }, { bgImageIndex: 1 }).lean();
    const plan = planCardBackgroundCompaction(deck.cardBackgrounds || [], cards);
    return { deckId: String(deckId), changed: plan.changed, stats: plan.stats };
  }

  let summary = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Leer deck y tarjetas dentro de la sesión.
      const deck = await Deck.findById(deckId, { cardBackgrounds: 1 }).session(session).lean();
      if (!deck) throw new Error('El deck no existe dentro de la sesión.');
      const cards = await Flashcard.find({ deckId }, { bgImageIndex: 1 }).session(session).lean();
      // 2. Calcular el plan (puro y determinista).
      const plan = planCardBackgroundCompaction(deck.cardBackgrounds || [], cards);
      summary = { deckId: String(deckId), changed: plan.changed, stats: plan.stats };
      if (!plan.changed) return; // transacción vacía: confirmar sin escribir
      // 3. Actualizar únicamente las tarjetas cuyo índice cambie.
      const writes = plan.cardUpdates.map((update) => ({
        updateOne: {
          filter: { _id: update.cardId, deckId },
          update: { $set: { bgImageIndex: update.bgImageIndex } },
        },
      }));
      if (writes.length > 0) {
        await Flashcard.bulkWrite(writes, { session });
      }
      // 4. Reemplazar cardBackgrounds.
      await Deck.updateOne(
        { _id: deckId },
        { $set: { cardBackgrounds: plan.cardBackgrounds } },
        { session }
      );
      // 5. Confirmar la transacción (withTransaction).
    });
  } finally {
    await session.endSession();
  }
  return summary;
}

async function main() {
  let parsed;
  try {
    parsed = parseImageBackgroundMigrationArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof MigrationUsageError) {
      emit({ status: 'USAGE', reason: error.message, usage: USAGE_TEXT });
      process.exitCode = EXIT_ERROR;
      return;
    }
    throw error;
  }

  const mongoUri = process.env.MONGO_URL || process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || 'flashcards';
  if (!mongoUri) {
    emit({
      status: 'BLOCKED',
      reason: 'MONGO_URL o MONGO_URI es obligatorio.',
      usage: USAGE_TEXT,
    });
    process.exitCode = EXIT_BLOCKED;
    return;
  }

  await mongoose.connect(mongoUri, { dbName });

  if (parsed.apply) {
    try {
      await assertTransactionSupport();
    } catch (error) {
      emit({
        status: 'BLOCKED',
        reason: error.message,
        dryRun: false,
        scope: scopePayload(parsed),
        committedDecks: [],
        decksExamined: 0,
        decksChanged: 0,
        cardsChanged: 0,
      });
      process.exitCode = EXIT_BLOCKED;
      return;
    }
  }

  const baseQuery =
    parsed.scope === 'all'
      ? {}
      : parsed.scope === 'deck'
        ? { _id: new mongoose.Types.ObjectId(parsed.deckId) }
        : { userId: new mongoose.Types.ObjectId(parsed.userId) };

  const totalDecks = await Deck.countDocuments(baseQuery);

  const result = {
    status: 'OK',
    dryRun: parsed.dryRun,
    apply: parsed.apply,
    scope: scopePayload(parsed),
    decksExamined: 0,
    decksChanged: 0,
    decksOmitted: 0,
    cardsChanged: 0,
    backgroundsBefore: 0,
    backgroundsAfter: 0,
    orphansRemoved: 0,
    duplicatesRemoved: 0,
    invalidReferencesNormalized: 0,
    estimatedBytesRemoved: 0,
    committedDecks: [],
    decks: [],
    errors: [],
  };

  const cursor = Deck.find(baseQuery, { cardBackgrounds: 1 }).lean().cursor();
  for await (const deck of cursor) {
    result.decksExamined += 1;
    try {
      const summary = await processDeck(deck._id, parsed);
      result.decks.push(summary);
      if (summary.changed) {
        result.decksChanged += 1;
        if (!parsed.dryRun) result.committedDecks.push(String(deck._id));
      }
      result.cardsChanged += summary.stats.cardsUpdated;
      result.backgroundsBefore += summary.stats.backgroundsBefore;
      result.backgroundsAfter += summary.stats.backgroundsAfter;
      result.orphansRemoved += summary.stats.orphansRemoved;
      result.duplicatesRemoved += summary.stats.duplicatesRemoved;
      result.invalidReferencesNormalized += summary.stats.invalidReferencesNormalized;
      result.estimatedBytesRemoved += summary.stats.estimatedBytesRemoved;
    } catch (error) {
      // Informa con precisión qué decks anteriores llegaron a confirmarse y
      // detiene la ejecución.
      result.errors.push({ deckId: String(deck._id), message: error.message });
      break;
    }
  }
  result.decksOmitted = Math.max(0, totalDecks - result.decksExamined);

  if (result.errors.length > 0) {
    result.status = 'FAILED';
    process.exitCode = EXIT_ERROR;
  }

  emit(result);
}

main()
  .catch((error) => {
    emit({ status: 'FAILED', reason: error.message });
    process.exitCode = EXIT_ERROR;
  })
  .finally(() => mongoose.disconnect());
