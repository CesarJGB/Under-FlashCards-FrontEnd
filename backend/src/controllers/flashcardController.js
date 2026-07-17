// backend/src/controllers/flashcardController.js
const Flashcard = require('../models/Flashcard');
const Deck = require('../models/Deck');
const User = require('../models/User');
const aiService = require('../services/aiService');
const { acceptsEventStream, sendEvent, startEventStream } = require('../utils/sse');
const {
  buildGenerationBatches,
  calculateTargetPadding,
  selectDocumentsAcrossChunks,
} = require('../utils/aiSourceChunks');
const { createConcurrencyLimiter, mapWithConcurrency } = require('../utils/concurrency');

function readBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

const MAX_AI_CARDS = readBoundedInteger(process.env.AI_MAX_CARDS, 100, 1, 1000);
const MAX_RAW_AI_CARDS = readBoundedInteger(
  process.env.AI_MAX_RAW_CARDS,
  Math.max(120, MAX_AI_CARDS + 20),
  MAX_AI_CARDS,
  1500
);
const MAX_AI_SOURCE_TEXT_LENGTH = 600000;
const AI_SOURCE_CHUNK_MAX_LENGTH = readBoundedInteger(
  process.env.AI_SOURCE_CHUNK_MAX_CHARS,
  60000,
  8000,
  60000
);
const AI_DECK_BATCH_SIZE = readBoundedInteger(process.env.AI_DECK_BATCH_SIZE, 12, 1, 20);
const AI_DECK_CONCURRENCY = readBoundedInteger(process.env.AI_DECK_CONCURRENCY, 8, 1, 8);
const AI_GLOBAL_DECK_CONCURRENCY = readBoundedInteger(process.env.AI_GLOBAL_DECK_CONCURRENCY, 8, 1, 8);
const AI_DECK_LOCK_TTL_MS = readBoundedInteger(process.env.AI_DECK_LOCK_TTL_MS, 600000, 60000, 3600000);
const AI_TARGET_PADDING_MAX = readBoundedInteger(process.env.AI_TARGET_PADDING_MAX, 20, 0, 500);
const AI_TARGET_PADDING_PER_BATCH = readBoundedInteger(process.env.AI_TARGET_PADDING_PER_BATCH, 0, 0, 10);
const AI_BATCH_RECOVERY_ATTEMPTS = readBoundedInteger(process.env.AI_BATCH_RECOVERY_ATTEMPTS, 1, 0, 2);
const globalAiBatchLimiter = createConcurrencyLimiter(AI_GLOBAL_DECK_CONCURRENCY);

function createRequestError(status, message, code = null) {
  const error = new Error(message);
  error.httpStatus = status;
  error.code = code;
  return error;
}

function getPaddingFactor() {
  const value = Number.parseFloat(process.env.AI_TARGET_PADDING_FACTOR);
  if (!Number.isFinite(value)) return 0.30;
  return Math.min(0.50, Math.max(0, value));
}

function normalizeCardKey(card) {
  return `${String(card.question).trim().replace(/\s+/g, ' ').toLocaleLowerCase()}\n${String(card.answer).trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`;
}

function createTokenUsage() {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addTokenUsage(total, usage) {
  if (!usage) return;
  for (const key of ['promptTokens', 'completionTokens', 'totalTokens']) {
    if (Number.isFinite(usage[key])) total[key] += usage[key];
  }
}

function isRecoverableAiError(error) {
  return error instanceof aiService.AiServiceError && error.retryable === true;
}

function getBatchFailure(error, stage) {
  const details = error?.details || {};
  return {
    stage,
    code: error?.code ?? 'unknown',
    providerStatus: error?.status ?? null,
    requestId: error?.requestId ?? null,
    attempts: error?.attempts ?? null,
    validationReason: details.validationReason ?? null,
    finishReason: details.finishReason ?? null,
    responseContentType: details.responseContentType ?? null,
    responseBytes: details.responseBytes ?? null,
    emptyResponse: details.emptyResponse ?? null,
  };
}

function summarizeBatches(batchStates, targetCount) {
  const metrics = {
    generated: 0,
    audited: 0,
    accepted: 0,
    eliminated: 0,
    merged: 0,
    corrected: 0,
    duplicates: 0,
  };
  const documentsByChunk = new Map();
  const seenCards = new Set();

  for (const state of batchStates) {
    metrics.generated += state.rawCards?.length || 0;
    metrics.audited += state.auditedCards?.length || 0;

    for (const card of state.auditedCards || []) {
      const status = card?.status;
      if (status === 'eliminada') {
        metrics.eliminated += 1;
        continue;
      }
      if (status === 'fusionada') {
        metrics.merged += 1;
        continue;
      }
      if (status === 'corregida') metrics.corrected += 1;
      if (!['sin_cambios', 'corregida'].includes(status) || !card.question?.trim() || !card.answer?.trim()) continue;

      const key = normalizeCardKey(card);
      if (seenCards.has(key)) {
        metrics.duplicates += 1;
        continue;
      }
      seenCards.add(key);
      const sourceChunkIndex = state.batch?.sourceChunkIndex || 1;
      const documents = documentsByChunk.get(sourceChunkIndex) || [];
      documents.push({
        question: String(card.question).trim(),
        answer: String(card.answer).trim(),
      });
      documentsByChunk.set(sourceChunkIndex, documents);
    }
  }

  const documents = selectDocumentsAcrossChunks(documentsByChunk, targetCount);
  metrics.accepted = documents.length;
  metrics.failedBatches = batchStates.filter((state) => state.status === 'failed').length;
  metrics.recoveredBatches = batchStates.filter((state) => state.recovered === true).length;
  return { documents, metrics };
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new aiService.AiServiceError('aborted', 'La generación fue cancelada.', { retryable: false });
  }
}

// Helper interno para resolver índices de fondo
async function getOrCreateBgIndex(deckId, bgImageString) {
  if (!bgImageString) return -1;
  const deck = await Deck.findById(deckId);
  if (!deck) return -1;

  let index = deck.cardBackgrounds.indexOf(bgImageString);
  if (index === -1) {
    deck.cardBackgrounds.push(bgImageString);
    await deck.save();
    index = deck.cardBackgrounds.length - 1;
  }
  return index;
}

exports.getCardsByDeck = async (req, res) => {
  try {
    const { deckId } = req.params;
    const deck = await Deck.findById(deckId);
    const backgrounds = deck ? deck.cardBackgrounds : [];

    const cards = await Flashcard.find({ deckId }).sort({ createdAt: -1 });
    return res.json(cards.map((c) => c.serialize(backgrounds)));
  } catch (err) {
    console.error('[flashcards:get-deck] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.createCard = async (req, res) => {
  try {
    const { userId, deckId, question, answer, bgImage, textAlign, fontSize, contentImage, imageSide } = req.body || {};
    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({ error: 'Question and answer are required.' });
    }

    const bgImageIndex = await getOrCreateBgIndex(deckId, bgImage);

    const card = await Flashcard.create({
      userId,
      deckId,
      question: question.trim(),
      answer: answer.trim(),
      bgImageIndex,
      contentImage: contentImage || '', 
      imageSide: imageSide || '',       
      ...(['left', 'center', 'right'].includes(textAlign) ? { textAlign } : {}),
      ...(typeof fontSize === 'string' ? { fontSize } : {}),
    });

    const deck = await Deck.findById(deckId);
    return res.status(201).json(card.serialize(deck ? deck.cardBackgrounds : []));
  } catch (err) {
    console.error('[flashcards:post] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.updateCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, bgImage, textAlign, fontSize, contentImage, imageSide } = req.body || {};
    const update = {};
    if (typeof question === 'string') update.question = question.trim();
    if (typeof answer === 'string') update.answer = answer.trim();
    if (['left', 'center', 'right'].includes(textAlign)) update.textAlign = textAlign;
    if (typeof fontSize === 'string') update.fontSize = fontSize;
    if (typeof contentImage === 'string') update.contentImage = contentImage;
    if (typeof imageSide === 'string') update.imageSide = imageSide;

    const currentCard = await Flashcard.findById(id);
    if (!currentCard) return res.status(404).json({ error: 'Flashcard not found.' });

    if (typeof bgImage === 'string') {
      update.bgImageIndex = await getOrCreateBgIndex(currentCard.deckId, bgImage);
    }

    const card = await Flashcard.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' });
    const deck = await Deck.findById(card.deckId);
    return res.json(card.serialize(deck ? deck.cardBackgrounds : []));
  } catch (err) {
    console.error('[flashcards:put] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.deleteCard = async (req, res) => {
  try {
    const { id } = req.params;
    const cardDeleted = await Flashcard.findByIdAndDelete(id);
    if (!cardDeleted) return res.status(404).json({ error: 'Flashcard not found.' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[flashcards:delete] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.createBulkCards = async (req, res) => {
  try {
    const { userId, deckId, batchStyles, cards } = req.body || {};
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron tarjetas.' });
    }

    const globalBg = batchStyles?.bgImage || '';
    const globalAlign = batchStyles?.textAlign || 'center';
    const globalSize = batchStyles?.fontSize || 'text-base';

    const currentDeck = await Deck.findById(deckId);
    if (!currentDeck) return res.status(404).json({ error: 'Mazo no encontrado.' });

    const docs = [];
    for (const c of cards) {
      if (!c || !c.question?.trim() || !c.answer?.trim()) continue;

      const currentBg = c.bgImage || globalBg;
      let bgImageIndex = -1;

      if (currentBg) {
        let idx = currentDeck.cardBackgrounds.indexOf(currentBg);
        if (idx === -1) {
          currentDeck.cardBackgrounds.push(currentBg);
          idx = currentDeck.cardBackgrounds.length - 1;
        }
        bgImageIndex = idx;
      }

      docs.push({
        userId,
        deckId,
        question: String(c.question).trim(),
        answer: String(c.answer).trim(),
        bgImageIndex,
        textAlign: ['left', 'center', 'right'].includes(c.textAlign || globalAlign) ? (c.textAlign || globalAlign) : 'center',
        fontSize: c.fontSize || globalSize,
        contentImage: '', 
        imageSide: ''
      });
    }

    if (docs.length === 0) {
      return res.status(400).json({ error: 'Ninguna tarjeta tiene formato válido.' });
    }

    await currentDeck.save();
    const inserted = await Flashcard.insertMany(docs);
    const backgrounds = currentDeck.cardBackgrounds || [];

    return res.status(201).json(inserted.map((c) => c.serialize(backgrounds)));
  } catch (err) {
    console.error('[flashcards:bulk] error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor al crear lote.' });
  }
};

async function generateAiCardsPipeline(req, res, { combinedBatch = false } = {}) {
  const pipelineFlow = combinedBatch ? 'deck-v2' : 'deck';
  const pipelineVersion = combinedBatch ? 'v2' : 'v1';
  const streamProgress = acceptsEventStream(req);
  let streamStarted = false;
  let stopEventStream = null;
  let runId = null;
  let failedBatch = null;
  let primaryFailure = null;
  let generatedCount = 0;
  let auditedCount = 0;
  let acceptedCount = 0;
  let targetCount = 1;
  let startedAt = null;
  let batchStates = [];
  let insertedFlashcards = null;
  let aiRunLock = null;
  let aiRunLockHeartbeat = null;
  let requestFinished = false;
  const runAbortController = new AbortController();
  const abortRun = () => {
    if (!requestFinished && !runAbortController.signal.aborted) {
      runAbortController.abort();
    }
  };

  req.once?.('aborted', abortRun);
  res.once?.('close', abortRun);

  try {
    const { deckId, text, count, batchStyles } = req.body || {};
    if (!text?.trim()) {
      throw createRequestError(400, 'Proporciona anotaciones o apuntes para procesar.');
    }
    const sourceText = text.trim();
    if (sourceText.length > MAX_AI_SOURCE_TEXT_LENGTH) {
      throw createRequestError(400, `Los apuntes superan el límite de ${MAX_AI_SOURCE_TEXT_LENGTH.toLocaleString('es-MX')} caracteres para la generación con IA.`);
    }

    const user = req.user;
    if (!user || !user.aiApiKey) {
      throw createRequestError(400, 'No has configurado tu API Key en la sección de Ajustes.');
    }

    const currentDeck = await Deck.findOne({ _id: deckId, userId: user._id });
    if (!currentDeck) throw createRequestError(404, 'Mazo no encontrado en la base de datos.');

    targetCount = Math.min(MAX_AI_CARDS, Math.max(1, parseInt(count, 10) || 5));
    const paddingPlan = calculateTargetPadding(targetCount, AI_DECK_BATCH_SIZE, {
      factor: getPaddingFactor(),
      maximum: AI_TARGET_PADDING_MAX,
      perBatch: AI_TARGET_PADDING_PER_BATCH,
    });
    const padding = paddingPlan.padding;
    const requestedPhase1Target = targetCount + padding;
    if (requestedPhase1Target > MAX_RAW_AI_CARDS) {
      throw createRequestError(
        400,
        `La configuración de padding requiere ${requestedPhase1Target} candidatas, pero AI_MAX_RAW_CARDS permite ${MAX_RAW_AI_CARDS}.`
      );
    }
    const sourcePlan = buildGenerationBatches(
      sourceText,
      requestedPhase1Target,
      AI_DECK_BATCH_SIZE,
      AI_SOURCE_CHUNK_MAX_LENGTH
    );
    if (sourcePlan.candidateTarget > MAX_RAW_AI_CARDS) {
      throw createRequestError(
        400,
        'El documento requiere demasiados segmentos para la configuración actual de IA. Reduce el documento o aumenta AI_SOURCE_CHUNK_MAX_CHARS.'
      );
    }

    const phase1Target = sourcePlan.candidateTarget;
    const totalBatches = sourcePlan.batches.length;
    startedAt = Date.now();
    runId = aiService.createRunId('deck');
    const lockedDeck = await Deck.findOneAndUpdate(
      { _id: deckId, userId: user._id },
      {
        $push: {
          aiGenerationLocks: {
            token: runId,
            expiresAt: new Date(Date.now() + AI_DECK_LOCK_TTL_MS),
          },
        },
      },
      { returnDocument: 'after' }
    );
    if (!lockedDeck) throw createRequestError(404, 'Mazo no encontrado en la base de datos.');
    aiRunLock = { deckId, userId: user._id, token: runId };
    const renewAiRunLock = async () => {
      try {
        const result = await Deck.updateOne(
          { _id: deckId, userId: user._id, 'aiGenerationLocks.token': runId },
          { $set: { 'aiGenerationLocks.$.expiresAt': new Date(Date.now() + AI_DECK_LOCK_TTL_MS) } }
        );
        if (!result.matchedCount) runAbortController.abort();
      } catch (error) {
        aiService.logAiEvent('run_lock_renewal_failed', {
          runId,
          flow: pipelineFlow,
          code: error.code ?? null,
        });
      }
    };
    aiRunLockHeartbeat = setInterval(() => {
      void renewAiRunLock();
    }, Math.max(1000, Math.floor(AI_DECK_LOCK_TTL_MS / 3)));
    aiRunLockHeartbeat.unref?.();
    const globalBg = batchStyles?.bgImage || '';
    const globalAlign = batchStyles?.textAlign || 'center';
    const globalSize = batchStyles?.fontSize || 'text-base';
    batchStates = sourcePlan.batches.map((batch) => ({
      batch,
      status: 'pending',
      rawCards: null,
      auditedCards: null,
      stage: null,
      failure: null,
      recoveryAttempts: 0,
      recovered: false,
      usage: createTokenUsage(),
    }));

    const reportProgress = (stage, message, batch = null) => {
      const summary = summarizeBatches(batchStates, targetCount);
      generatedCount = summary.metrics.generated;
      auditedCount = summary.metrics.audited;
      acceptedCount = summary.metrics.accepted;

      if (!streamProgress || res.writableEnded || res.destroyed) return summary;

      const completedBatches = batchStates.filter((state) => state.status === 'completed').length;
      const activeBatches = batchStates.filter((state) => (
        state.status === 'generating' || state.status === 'auditing' || state.status === 'recovering'
      )).length;
      const failedBatches = batchStates.filter((state) => state.status === 'failed').length;
      sendEvent(res, 'progress', {
        runId,
        stage,
        generated: generatedCount,
        audited: auditedCount,
        accepted: acceptedCount,
        target: targetCount,
        total: phase1Target,
        batch: batch?.number ?? null,
        totalBatches,
        completedBatches,
        activeBatches,
        failedBatches,
        concurrency: AI_DECK_CONCURRENCY,
        globalConcurrency: AI_GLOBAL_DECK_CONCURRENCY,
        sourceChunks: sourcePlan.sourceChunks.length,
        message,
      });
      return summary;
    };

    aiService.logAiEvent('run_started', {
      runId,
      flow: pipelineFlow,
      pipelineVersion,
      deckId: String(currentDeck._id),
      targetCount,
      phase1Target,
      padding,
      estimatedPaddedBatches: paddingPlan.batchCount,
      totalBatches,
      sourceCharacters: sourceText.length,
      sourceChunks: sourcePlan.sourceChunks.length,
      sourceChunkMaxCharacters: AI_SOURCE_CHUNK_MAX_LENGTH,
      concurrency: AI_DECK_CONCURRENCY,
      globalConcurrency: AI_GLOBAL_DECK_CONCURRENCY,
      lockTtlMs: AI_DECK_LOCK_TTL_MS,
      batchRecoveryAttempts: AI_BATCH_RECOVERY_ATTEMPTS,
    });

    if (streamProgress) {
      stopEventStream = startEventStream(res);
      streamStarted = true;
      reportProgress('preparing', 'Preparando la generación con IA...');
    }

    const processBatch = async (batch, index, recoveryAttempt = 0) => {
      const state = batchStates[index];
      state.status = recoveryAttempt > 0 ? 'recovering' : 'queued';
      state.stage = null;
      state.failure = null;
      state.rawCards = null;
      state.auditedCards = null;
      state.recoveryAttempts = recoveryAttempt;
      reportProgress(
        recoveryAttempt > 0 ? 'recovering' : 'queued',
        recoveryAttempt > 0
          ? `Recuperando el lote ${batch.number}/${totalBatches}...`
          : `Esperando capacidad de IA para el lote ${batch.number}/${totalBatches}...`,
        batch
      );
      let releaseGlobalSlot;

      try {
        releaseGlobalSlot = await globalAiBatchLimiter.acquire({ signal: runAbortController.signal });
        state.status = 'generating';
        state.stage = combinedBatch ? 'deck_generate_audit' : 'deck_generate';
        state.startedAt = Date.now();
        reportProgress(
          recoveryAttempt > 0 ? 'recovering' : 'generating',
          recoveryAttempt > 0
            ? `Regenerando tarjetas del lote ${batch.number}/${totalBatches}...`
            : combinedBatch
              ? `Generando y auditando el lote ${batch.number}/${totalBatches}...`
              : `Generando tarjetas del lote ${batch.number}/${totalBatches}...`,
          batch
        );

        const context = {
          runId,
          flow: pipelineFlow,
          deckId: String(currentDeck._id),
          batch: batch.number,
          totalBatches,
          sourceChunk: batch.sourceChunkIndex,
          sourceChunkCount: batch.sourceChunkCount,
          sourceCharacters: batch.sourceCharCount,
          signal: runAbortController.signal,
          onRetry: () => reportProgress(
            'retrying',
            `La IA devolvió una respuesta incompleta. Reintentando el lote ${batch.number}/${totalBatches}...`,
            batch
          ),
          onUsage: ({ usage }) => addTokenUsage(state.usage, usage),
        };

        const generateStartedAt = Date.now();
        if (combinedBatch) {
          state.rawCards = await aiService.generateAndAuditBatch(
            batch.sourceChunk,
            batch.targetCount,
            user.aiApiKey,
            context
          );
          // The combined service returns already audited cards. Add the
          // legacy status expected by summarizeBatches without another model call.
          state.auditedCards = state.rawCards.map((card) => ({
            ...card,
            status: 'sin_cambios',
          }));
          state.generateDurationMs = Date.now() - generateStartedAt;
          state.auditDurationMs = 0;
        } else {
          state.rawCards = await aiService.generateRawCards(
            batch.sourceChunk,
            batch.targetCount,
            user.aiApiKey,
            context
          );
          state.generateDurationMs = Date.now() - generateStartedAt;
          state.status = 'auditing';
          state.stage = 'deck_audit';
          reportProgress('auditing', `Auditando tarjetas del lote ${batch.number}/${totalBatches}...`, batch);

          const auditStartedAt = Date.now();
          state.auditedCards = await aiService.criticizeAndRefineCards(
            batch.sourceChunk,
            state.rawCards,
            user.aiApiKey,
            context
          );
          state.auditDurationMs = Date.now() - auditStartedAt;
        }
        state.durationMs = Date.now() - state.startedAt;
        state.status = 'completed';
        state.recovered = recoveryAttempt > 0;

        const summary = reportProgress(
          recoveryAttempt > 0 ? 'recovered_batch' : 'completed_batch',
          recoveryAttempt > 0
            ? `Lote ${batch.number}/${totalBatches} recuperado.`
            : combinedBatch
              ? `Lote ${batch.number}/${totalBatches} generado y auditado.`
              : `Lote ${batch.number}/${totalBatches} completado.`,
          batch
        );
        aiService.logAiEvent(recoveryAttempt > 0 ? 'batch_recovered' : 'batch_completed', {
          runId,
          flow: pipelineFlow,
          deckId: String(currentDeck._id),
          batch: batch.number,
          totalBatches,
          sourceChunk: batch.sourceChunkIndex,
          sourceChunkCount: batch.sourceChunkCount,
          sourceCharacters: batch.sourceCharCount,
          generated: state.rawCards.length,
          audited: state.auditedCards.length,
          accepted: summary.metrics.accepted,
          generateDurationMs: state.generateDurationMs,
          auditDurationMs: state.auditDurationMs,
          durationMs: state.durationMs,
          recoveryAttempt,
          usage: state.usage,
        });
        return state;
      } catch (error) {
        if (isRecoverableAiError(error) && !runAbortController.signal.aborted) {
          state.status = 'failed';
          state.failure = getBatchFailure(error, state.stage);
          state.rawCards = null;
          state.auditedCards = null;
          state.durationMs = state.startedAt ? Date.now() - state.startedAt : null;
          aiService.logAiEvent('batch_failed', {
            runId,
            flow: pipelineFlow,
            batch: batch.number,
            totalBatches,
            sourceChunk: batch.sourceChunkIndex,
            sourceCharacters: batch.sourceCharCount,
            recoverable: true,
            recoveryAttempt,
            ...state.failure,
          });
          reportProgress(
            'batch_failed',
            `El lote ${batch.number}/${totalBatches} falló temporalmente; se usará el margen disponible.`,
            batch
          );
          return state;
        }

        if (!runAbortController.signal.aborted) {
          failedBatch ??= batch.number;
          primaryFailure ??= { error, batch: batch.number, stage: state.stage };
          aiService.logAiEvent('batch_failed', {
            runId,
            flow: pipelineFlow,
            batch: batch.number,
            totalBatches,
            sourceChunk: batch.sourceChunkIndex,
            sourceCharacters: batch.sourceCharCount,
            code: error.code ?? null,
            providerStatus: error.status ?? null,
            stage: state.stage,
            recoverable: false,
          });
          runAbortController.abort();
        }
        throw primaryFailure?.error || error;
      } finally {
        releaseGlobalSlot?.();
      }
    };

    try {
      await mapWithConcurrency(
        sourcePlan.batches,
        AI_DECK_CONCURRENCY,
        (batch, index) => processBatch(batch, index),
        { signal: runAbortController.signal }
      );
    } catch (error) {
      throw primaryFailure?.error || error;
    }

    let summary = summarizeBatches(batchStates, targetCount);
    for (
      let recoveryAttempt = 1;
      summary.documents.length < targetCount && recoveryAttempt <= AI_BATCH_RECOVERY_ATTEMPTS;
      recoveryAttempt += 1
    ) {
      const failedStates = batchStates.filter((state) => state.status === 'failed');
      if (failedStates.length === 0) break;

      aiService.logAiEvent('recovery_started', {
        runId,
        flow: pipelineFlow,
        recoveryAttempt,
        failedBatches: failedStates.map((state) => state.batch.number),
        accepted: summary.metrics.accepted,
        target: targetCount,
      });
      reportProgress(
        'recovering',
        `Recuperando ${failedStates.length} lote(s) para completar ${targetCount} tarjetas...`
      );

      try {
        await mapWithConcurrency(
          failedStates,
          AI_DECK_CONCURRENCY,
          (state) => processBatch(state.batch, batchStates.indexOf(state), recoveryAttempt),
          { signal: runAbortController.signal }
        );
      } catch (error) {
        throw primaryFailure?.error || error;
      }
      summary = summarizeBatches(batchStates, targetCount);
    }

    generatedCount = summary.metrics.generated;
    auditedCount = summary.metrics.audited;
    acceptedCount = summary.metrics.accepted;
    const tokenUsage = batchStates.reduce((total, state) => {
      addTokenUsage(total, state.usage);
      return total;
    }, createTokenUsage());
    const metrics = {
      ...summary.metrics,
      sourceCharacters: sourceText.length,
      sourceChunks: sourcePlan.sourceChunks.length,
      concurrency: AI_DECK_CONCURRENCY,
      globalConcurrency: AI_GLOBAL_DECK_CONCURRENCY,
      batchRecoveryAttempts: AI_BATCH_RECOVERY_ATTEMPTS,
      tokenUsage,
    };
    const documentsToInsert = summary.documents.map((document) => ({
      userId: user._id,
      deckId,
      ...document,
      textAlign: ['left', 'center', 'right'].includes(globalAlign) ? globalAlign : 'center',
      fontSize: globalSize,
      contentImage: '',
      imageSide: '',
    }));

    if (documentsToInsert.length < targetCount) {
      throw createRequestError(
        422,
        `La IA aceptó ${documentsToInsert.length} de ${targetCount} tarjetas después de procesar los reintentos disponibles. Inténtalo de nuevo.`,
        'insufficient_valid_cards'
      );
    }

    throwIfAborted(runAbortController.signal);
    let persistedDeck;
    if (globalBg) {
      persistedDeck = await Deck.findOneAndUpdate(
        { _id: deckId, userId: user._id },
        { $addToSet: { cardBackgrounds: globalBg } },
        { returnDocument: 'after' }
      );
    } else {
      persistedDeck = await Deck.findOne({ _id: deckId, userId: user._id });
    }
    if (!persistedDeck) throw createRequestError(404, 'Mazo no encontrado en la base de datos.');
    throwIfAborted(runAbortController.signal);

    const bgImageIndex = globalBg ? persistedDeck.cardBackgrounds.indexOf(globalBg) : -1;
    const finalDocuments = documentsToInsert.slice(0, targetCount).map((document) => ({
      ...document,
      bgImageIndex,
    }));
    insertedFlashcards = await Flashcard.insertMany(finalDocuments);
    throwIfAborted(runAbortController.signal);
    const backgrounds = persistedDeck.cardBackgrounds || [];
    aiService.logAiEvent('run_completed', {
      runId,
      flow: pipelineFlow,
      pipelineVersion,
      deckId: String(currentDeck._id),
      createdCount: insertedFlashcards.length,
      durationMs: Date.now() - startedAt,
      metrics,
    });

    if (streamProgress) {
      sendEvent(res, 'complete', {
        runId,
        createdCount: insertedFlashcards.length,
        target: targetCount,
        metrics,
      });
      stopEventStream?.();
      requestFinished = true;
      return res.end();
    }
    requestFinished = true;
    return res.status(201).json(insertedFlashcards.map((c) => c.serialize(backgrounds)));

  } catch (err) {
    if (runAbortController.signal.aborted && insertedFlashcards?.length) {
      try {
        await Flashcard.deleteMany({ _id: { $in: insertedFlashcards.map((card) => card._id) } });
        insertedFlashcards = null;
      } catch (cleanupError) {
        aiService.logAiEvent('card_cleanup_failed', {
          runId,
          flow: pipelineFlow,
          code: cleanupError.code ?? null,
        });
      }
    }
    if (runId) {
      const failureSummary = summarizeBatches(batchStates, targetCount);
      generatedCount = failureSummary.metrics.generated;
      auditedCount = failureSummary.metrics.audited;
      acceptedCount = failureSummary.metrics.accepted;
      const tokenUsage = batchStates.reduce((total, state) => {
        addTokenUsage(total, state.usage);
        return total;
      }, createTokenUsage());
      const reportedError = primaryFailure?.error || err;
      const failedState = batchStates.find((state) => state.status === 'failed');
      aiService.logAiEvent('run_failed', {
        runId,
        flow: pipelineFlow,
        pipelineVersion,
        batch: primaryFailure?.batch ?? failedBatch ?? failedState?.batch.number ?? null,
        stage: primaryFailure?.stage ?? failedState?.failure?.stage ?? null,
        generated: generatedCount,
        audited: auditedCount,
        accepted: acceptedCount,
        failedBatches: batchStates
          .filter((state) => state.status === 'failed')
          .map((state) => state.batch.number),
        code: reportedError.code ?? null,
        providerStatus: reportedError.status ?? null,
        requestId: reportedError.requestId ?? null,
        attempts: reportedError.attempts ?? null,
        ...(reportedError.details ? { details: reportedError.details } : {}),
        ...(failedState?.failure ? { batchFailure: failedState.failure } : {}),
        ...(startedAt ? { durationMs: Date.now() - startedAt, tokenUsage } : {}),
      });
    }
    const message = err.httpStatus ? err.message : aiService.getSafeErrorMessage(err);
    if (res.writableEnded || res.destroyed) return;
    if (streamStarted) {
      sendEvent(res, 'error', { error: message, runId });
      stopEventStream?.();
      requestFinished = true;
      return res.end();
    }
    requestFinished = true;
    return res.status(err.httpStatus || 502).json({ message });
  } finally {
    clearInterval(aiRunLockHeartbeat);
    if (aiRunLock) {
      try {
        await Deck.updateOne(
          { _id: aiRunLock.deckId, userId: aiRunLock.userId },
          { $pull: { aiGenerationLocks: { token: aiRunLock.token } } }
        );
      } catch (releaseError) {
        aiService.logAiEvent('run_lock_release_failed', {
          runId,
          flow: pipelineFlow,
          code: releaseError.code ?? null,
        });
      }
    }
    requestFinished = true;
    req.off?.('aborted', abortRun);
    res.off?.('close', abortRun);
  }
}

exports.generateAiCards = (req, res) => generateAiCardsPipeline(req, res);

exports.generateAIV2 = (req, res) => generateAiCardsPipeline(req, res, { combinedBatch: true });
