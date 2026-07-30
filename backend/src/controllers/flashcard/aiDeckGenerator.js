const Flashcard = require('../../models/Flashcard');
const Deck = require('../../models/Deck');
const aiService = require('../../services/aiService');
const { performance } = require('node:perf_hooks');
const { acceptsEventStream, sendEvent, startEventStream } = require('../../utils/sse');
const { buildGenerationBatches, calculateTargetPadding } = require('../../utils/aiSourceChunks');
const { createConcurrencyLimiter, mapWithConcurrency } = require('../../utils/concurrency');
const { processSemanticBatch } = require('../../services/semantic/orchestrator');
const { createSemanticEmbedder } = require('../../services/semantic/embedderFactory');
const {
  calculateQualityScore,
  createLexicalContext,
} = require('../../services/semantic/qualityScorer');
const {
  MAX_AI_CARDS,
  MAX_RAW_AI_CARDS,
  MAX_AI_SOURCE_TEXT_LENGTH,
  AI_SOURCE_CHUNK_MAX_LENGTH,
  AI_DECK_BATCH_SIZE,
  AI_DECK_CONCURRENCY,
  AI_GLOBAL_DECK_CONCURRENCY,
  AI_DECK_LOCK_TTL_MS,
  AI_TARGET_PADDING_MAX,
  AI_TARGET_PADDING_PER_BATCH,
  AI_BATCH_RECOVERY_ATTEMPTS,
  AI_SEMANTIC_MIN_ACCEPTANCE_RATIO,
  deriveQualityScore,
  resolveDeduplicationThreshold,
  createRequestError,
  getPaddingFactor,
  createTokenUsage,
  addTokenUsage,
  isRecoverableAiError,
  getBatchFailure,
  summarizeBatches,
  throwIfAborted,
} = require('./aiBatchUtils');

const globalAiBatchLimiter = createConcurrencyLimiter(AI_GLOBAL_DECK_CONCURRENCY);

function resolveUserAiApiKey(user) {
  if (!user) return '';
  if (typeof user.getAiApiKey === 'function') return user.getAiApiKey();
  return typeof user['aiApiKey'] === 'string' ? user['aiApiKey'].trim() : '';
}

function resolveUserAiApiProvider(user) {
  if (!resolveUserAiApiKey(user)) return null;

  if (typeof user?.getAiApiProvider === 'function') {
    const provider = String(user.getAiApiProvider() || '').trim().toLowerCase();
    if (provider) return provider;
  }

  const storedProvider = String(user?.aiApiProvider || '').trim().toLowerCase();
  return storedProvider || 'deepseek';
}

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
    const aiApiKey = resolveUserAiApiKey(user);
    const aiApiProvider = resolveUserAiApiProvider(user);
    if (!user || !aiApiKey) {
      throw createRequestError(400, 'No has configurado tu API Key en la sección de Ajustes.');
    }
    if (aiApiProvider !== 'openrouter') {
      throw createRequestError(
        400,
        'La clave guardada es de DeepSeek. Elimina esa clave y registra una clave de OpenRouter en Ajustes.'
      );
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
      provider: 'openrouter',
      model: aiService.OPENROUTER_MODEL,
      reasoningEnabled: false,
      combinedMaxTokens: aiService.AI_DECK_COMBINED_MAX_TOKENS ?? null,
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
            aiApiKey,
            context
          );
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
            aiApiKey,
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
            aiApiKey,
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

    // --- INICIO INTEGRACIÓN V3 SEMÁNTICA ---
    const parsedLambda = Number.parseFloat(process.env.AI_SEMANTIC_MMR_LAMBDA);
    const mmrLambda = Number.isFinite(parsedLambda) ? parsedLambda : 0.7;

    const validCards = [];
    let lexicalContextDurationMs = 0;
    for (const state of batchStates) {
      const segmentText = state.batch?.sourceChunk || '';
      const lexicalContextStart = performance.now();
      const lexicalContext = createLexicalContext(segmentText);
      lexicalContextDurationMs += performance.now() - lexicalContextStart;
      for (const card of state.auditedCards || []) {
        const status = card?.status;
        if (['eliminada', 'fusionada'].includes(status)) continue;
        if (!['sin_cambios', 'corregida'].includes(status)) continue;
        if (!card.question?.trim() || !card.answer?.trim()) continue;
        
        const { qualityScore, breakdown } = calculateQualityScore({
          question: card.question,
          answer: card.answer,
          sourceEvidence: card.sourceEvidence,
          status: card.status,
          segmentText,
          lexicalContext
        });
        
        aiService.logAiEvent('semantic_v3_quality_score', {
          qualityScore,
          breakdown,
          status: card.status,
          // Reutilizamos los cálculos del scorer para evitar duplicar lógica
          answerLength: breakdown.answerTokenCount,
          hasSourceEvidence: Boolean(card.sourceEvidence),
          hasSourceContext: Boolean(card.sourceEvidence || segmentText),
          sourceTokenCount: breakdown.sourceTokenCount,
          answerTokenCount: breakdown.answerTokenCount
        });
        
        validCards.push({
          question: String(card.question).trim(),
          answer: String(card.answer).trim(),
          qualityScore: null // Shadow Mode: mantenemos null para no alterar el MMR/Dedup aún
        });
      }
    }

    const deduplicationThreshold = resolveDeduplicationThreshold(validCards.length);

    let documentsToInsert = [];
    let semanticFallbackUsed = false;
    let semanticSkipped = false;
    let semanticStats = null;

    if (validCards.length === 0) {
      semanticSkipped = true;
      aiService.logAiEvent('semantic_v3_skipped', {
        runId,
        flow: pipelineFlow,
        reason: 'NO_VALID_CARDS_FOR_V3',
        inputCount: 0,
        targetCount,
        timestamp: Date.now()
      });
    } else {
      let v3Result = null;
      let v3Error = null;
      
      try {
        const embedder = createSemanticEmbedder();
        v3Result = await processSemanticBatch({
          cards: validCards,
          embedder,
          targetCount,
          signal: runAbortController.signal,
          config: {
            deduplicationThreshold,
            mmrLambda
          }
        });
      } catch (error) {
        v3Error = error;
      }

      if (v3Error) {
        semanticFallbackUsed = true;
        aiService.logAiEvent('semantic_v3_fallback', {
          runId,
          flow: pipelineFlow,
          reason: v3Error.message || 'UNKNOWN_V3_ERROR',
          inputCount: validCards.length,
          targetCount,
          timestamp: Date.now()
        });
        
        documentsToInsert = summary.documents.map(document => ({
          userId: user._id,
          deckId,
          ...document,
          textAlign: ['left', 'center', 'right'].includes(globalAlign) ? globalAlign : 'center',
          fontSize: globalSize,
          contentImage: '',
          imageSide: '',
        }));
      } else {
        if (!v3Result || !Array.isArray(v3Result.selectedCards)) {
          throw new Error('INVALID_SEMANTIC_RESULT');
        }

        documentsToInsert = v3Result.selectedCards.map(doc => ({
          userId: user._id,
          deckId,
          ...doc,
          textAlign: ['left', 'center', 'right'].includes(globalAlign) ? globalAlign : 'center',
          fontSize: globalSize,
          contentImage: '',
          imageSide: '',
        }));
        
        semanticStats = v3Result.stats;
        aiService.logAiEvent('semantic_v3_success', {
          runId,
          flow: pipelineFlow,
          ...semanticStats,
          lexicalContextDurationMs: Number(lexicalContextDurationMs.toFixed(2))
        });
      }
    }
    // --- FIN INTEGRACIÓN V3 SEMÁNTICA ---

    // Lógica de Quorum Semántico Flexible (Soft Target)
    const countAfterSemantics = documentsToInsert.length;
    const semanticMinimumAcceptance = Math.max(1, Math.floor(targetCount * AI_SEMANTIC_MIN_ACCEPTANCE_RATIO));
    const semanticPartialSuccess = countAfterSemantics < targetCount && countAfterSemantics >= semanticMinimumAcceptance;
    const semanticRetentionRate = validCards.length > 0
      ? Number((countAfterSemantics / validCards.length).toFixed(4))
      : 0;

    if (countAfterSemantics < semanticMinimumAcceptance) {
      throw createRequestError(
        422,
        `El documento no contiene suficiente información única para generar ${targetCount} tarjetas. Solo se encontraron ${countAfterSemantics} conceptos suficientemente diferentes.`,
        'insufficient_semantic_content'
      );
    }

    const warningPayload = semanticPartialSuccess
      ? {
          type: 'INSUFFICIENT_SOURCE_CONTENT',
          message: `Se generaron ${countAfterSemantics} tarjetas únicas de ${targetCount} solicitadas. El documento no tenía suficiente información distinta para crear ${targetCount} sin repetir conceptos.`,
          requestedCards: targetCount,
          generatedCards: countAfterSemantics,
        }
      : null;

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

    // Telemetría de run_completed
    aiService.logAiEvent('run_completed', {
      runId,
      flow: pipelineFlow,
      pipelineVersion,
      deckId: String(currentDeck._id),
      createdCount: insertedFlashcards.length,
      durationMs: Date.now() - startedAt,
      metrics: {
        ...summary.metrics,
        sourceCharacters: sourceText.length,
        sourceChunks: sourcePlan.sourceChunks.length,
        concurrency: AI_DECK_CONCURRENCY,
        globalConcurrency: AI_GLOBAL_DECK_CONCURRENCY,
        batchRecoveryAttempts: AI_BATCH_RECOVERY_ATTEMPTS,
        tokenUsage,
        semanticFallbackUsed,
        semanticSkipped,
        semanticPartialSuccess,
        semanticRetentionRate,
        requestedCards: targetCount,
        generatedCards: insertedFlashcards.length,
        ...(semanticStats ? { semantic: semanticStats } : {}),
      },
    });

    if (streamProgress) {
      sendEvent(res, 'complete', {
        runId,
        createdCount: insertedFlashcards.length,
        target: targetCount,
        warning: warningPayload,
        metrics: {
          ...summary.metrics,
          sourceCharacters: sourceText.length,
          sourceChunks: sourcePlan.sourceChunks.length,
          concurrency: AI_DECK_CONCURRENCY,
          globalConcurrency: AI_GLOBAL_DECK_CONCURRENCY,
          batchRecoveryAttempts: AI_BATCH_RECOVERY_ATTEMPTS,
          tokenUsage,
          semanticFallbackUsed,
          semanticSkipped,
          semanticPartialSuccess,
          semanticRetentionRate,
          requestedCards: targetCount,
          generatedCards: insertedFlashcards.length,
          ...(semanticStats ? { semantic: semanticStats } : {}),
        },
      });
      stopEventStream?.();
      requestFinished = true;
      return res.end();
    }

    requestFinished = true;
    return res.status(201).json({
      cards: insertedFlashcards.map((c) => c.serialize(backgrounds)),
      warning: warningPayload,
    });

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

module.exports = { generateAiCardsPipeline };
