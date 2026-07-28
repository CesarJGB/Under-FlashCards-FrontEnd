const aiService = require('../../services/aiService');
const { selectDocumentsAcrossChunks } = require('../../utils/aiSourceChunks');

function readBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function readBoundedFloat(value, fallback, minimum, maximum) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
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
const AI_SEMANTIC_MIN_ACCEPTANCE_RATIO = readBoundedFloat(
  process.env.AI_SEMANTIC_MIN_ACCEPTANCE_RATIO,
  0.85,
  0.50,
  1.0
);

const AI_SEMANTIC_DEDUP_THRESHOLD_LOW = readBoundedFloat(
  process.env.AI_SEMANTIC_DEDUP_THRESHOLD_LOW,
  0.92,
  0.50,
  0.99
);
const AI_SEMANTIC_DEDUP_THRESHOLD_HIGH = readBoundedFloat(
  process.env.AI_SEMANTIC_DEDUP_THRESHOLD_HIGH,
  0.94,
  0.50,
  0.99
);
const AI_SEMANTIC_DEDUP_ADAPTIVE_BREAKPOINT = readBoundedInteger(
  process.env.AI_SEMANTIC_DEDUP_ADAPTIVE_BREAKPOINT,
  200,
  10,
  1500
);

const AUDIT_STATUS_QUALITY_SCORE = {
  sin_cambios: 1.0,
  corregida: 0.75,
};

/**
 * Deriva qualityScore desde el status de auditoría del LLM.
 * Solo se llama cuando card.qualityScore no viene seteado upstream.
 * Fallback defensivo a 0.6 para cualquier status inesperado.
 */
function deriveQualityScore(status) {
  if (typeof status !== 'string') return 0.6;
  return AUDIT_STATUS_QUALITY_SCORE[status] ?? 0.6;
}

/**
 * Resuelve el threshold de deduplicación de forma adaptativa.
 * Si AI_SEMANTIC_DEDUP_THRESHOLD está seteada explícitamente, usa esa.
 * Si no, usa threshold alto para >ADAPTIVE_BREAKPOINT candidatas,
 * threshold bajo (comportamiento histórico) en caso contrario.
 */
function resolveDeduplicationThreshold(candidateCount) {
  const envValue = process.env.AI_SEMANTIC_DEDUP_THRESHOLD;
  if (envValue !== undefined && envValue !== '') {
    return readBoundedFloat(envValue, AI_SEMANTIC_DEDUP_THRESHOLD_LOW, 0.50, 0.99);
  }
  return candidateCount > AI_SEMANTIC_DEDUP_ADAPTIVE_BREAKPOINT
    ? AI_SEMANTIC_DEDUP_THRESHOLD_HIGH
    : AI_SEMANTIC_DEDUP_THRESHOLD_LOW;
}

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

module.exports = {
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
  AI_SEMANTIC_DEDUP_THRESHOLD_LOW,
  AI_SEMANTIC_DEDUP_THRESHOLD_HIGH,
  AI_SEMANTIC_DEDUP_ADAPTIVE_BREAKPOINT,
  deriveQualityScore,
  resolveDeduplicationThreshold,
  createRequestError,
  getPaddingFactor,
  normalizeCardKey,
  createTokenUsage,
  addTokenUsage,
  isRecoverableAiError,
  getBatchFailure,
  summarizeBatches,
  throwIfAborted,
};
