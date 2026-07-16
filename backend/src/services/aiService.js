const { randomUUID } = require('crypto');

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

function readBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

const REASONER_THRESHOLD = readBoundedInteger(process.env.AI_REASONER_THRESHOLD, 20, 1, 20);
const AI_DEBUG_LOGS = process.env.AI_DEBUG_LOGS !== 'false';
const AI_REQUEST_TIMEOUT_MS = readBoundedInteger(process.env.AI_REQUEST_TIMEOUT_MS, 90000, 10000, 180000);
const AI_MAX_RETRIES = readBoundedInteger(process.env.AI_MAX_RETRIES, 2, 0, 4);
const AI_RETRY_BASE_MS = readBoundedInteger(process.env.AI_RETRY_BASE_MS, 1000, 250, 10000);

class AiServiceError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'AiServiceError';
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = options.retryable === true;
    this.requestId = options.requestId ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

function createRunId(prefix = 'ai') {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function logAiEvent(event, details = {}) {
  if (!AI_DEBUG_LOGS && event !== 'error' && event !== 'run_failed') return;
  const payload = {
    event,
    at: new Date().toISOString(),
    ...details,
  };
  const logger = event === 'error' || event === 'run_failed' ? console.error : console.info;
  logger(`[ai] ${JSON.stringify(payload)}`);
}

function getResponseRequestId(response) {
  return response.headers.get('x-request-id')
    || response.headers.get('request-id')
    || response.headers.get('x-correlation-id')
    || null;
}

function getRetryAfterMs(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : Math.max(0, timestamp - Date.now());
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function wait(milliseconds, signal) {
  return new Promise((resolve) => {
    let timeout;
    const finish = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', finish);
      resolve();
    };

    if (signal?.aborted) {
      finish();
      return;
    }

    timeout = setTimeout(finish, milliseconds);
    signal?.addEventListener('abort', finish, { once: true });
  });
}

function normalizeError(error, { abortedByCaller = false } = {}) {
  if (error instanceof AiServiceError) return error;
  if (error?.name === 'AbortError') {
    if (abortedByCaller) {
      return new AiServiceError('aborted', 'La solicitud a la IA fue cancelada.', { retryable: false });
    }
    return new AiServiceError('timeout', 'La solicitud a la IA excedió el tiempo de espera.', { retryable: true });
  }
  return new AiServiceError('network', 'No se pudo conectar con el proveedor de IA.', { retryable: true });
}

function getMessageContent(data) {
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new AiServiceError('truncated_output', 'La IA agotó el límite de respuesta.', { retryable: true });
  }
  const content = choice?.message?.content?.trim();
  if (!content) {
    throw new AiServiceError('invalid_model_output', 'La IA devolvió una respuesta vacía.', { retryable: true });
  }
  return content;
}

function getTokenUsage(data) {
  const usage = data?.usage;
  if (!usage || typeof usage !== 'object') return null;

  const promptTokens = Number(usage.prompt_tokens);
  const completionTokens = Number(usage.completion_tokens);
  const totalTokens = Number(usage.total_tokens);
  if (![promptTokens, completionTokens, totalTokens].some(Number.isFinite)) return null;

  return {
    ...(Number.isFinite(promptTokens) ? { promptTokens } : {}),
    ...(Number.isFinite(completionTokens) ? { completionTokens } : {}),
    ...(Number.isFinite(totalTokens) ? { totalTokens } : {}),
  };
}

function getSafeErrorMessage(error) {
  if (error?.status === 401 || error?.status === 403) {
    return 'La clave de IA fue rechazada. Revísala en Ajustes.';
  }
  if (error?.status === 402) {
    return 'La cuenta de IA no tiene saldo disponible.';
  }
  if (error?.status === 429) {
    return 'La IA está temporalmente ocupada. Espera un momento e inténtalo de nuevo.';
  }
  if (error?.code === 'timeout') {
    return 'La IA tardó demasiado en responder. Inténtalo de nuevo.';
  }
  if (error?.code === 'truncated_output' || error?.code === 'invalid_model_output') {
    return 'La IA devolvió una respuesta incompleta. Inténtalo de nuevo.';
  }
  return 'No se pudo completar la generación de preguntas con IA.';
}

async function callDeepSeekJson({ apiKey, requestBody, context = {}, parseResponse, signal }) {
  const { onRetry, onUsage, ...logContext } = context;
  const model = requestBody.model || 'unknown';

  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    const abortFromCaller = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', abortFromCaller, { once: true });
    }

    const startedAt = Date.now();
    try {
      logAiEvent('request_started', { ...logContext, model, attempt: attempt + 1 });
      const response = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      const requestId = getResponseRequestId(response);

      if (!response.ok) {
        await response.text().catch(() => '');
        throw new AiServiceError('provider_http', `DeepSeek respondió con HTTP ${response.status}.`, {
          status: response.status,
          requestId,
          retryAfterMs: getRetryAfterMs(response.headers.get('retry-after')),
          retryable: isRetryableStatus(response.status),
        });
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new AiServiceError('invalid_provider_response', 'DeepSeek devolvió una respuesta no JSON.', {
          requestId,
          retryable: true,
        });
      }

      let parsed = data;
      if (parseResponse) {
        try {
          parsed = parseResponse(data);
        } catch (error) {
          if (error instanceof AiServiceError) throw error;
          throw new AiServiceError('invalid_model_output', 'La IA devolvió un formato no válido.', {
            requestId,
            retryable: true,
          });
        }
      }

      const usage = getTokenUsage(data);
      onUsage?.({
        ...logContext,
        model,
        attempt: attempt + 1,
        requestId,
        usage,
      });

      logAiEvent('request_succeeded', {
        ...logContext,
        model,
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        requestId,
        ...(usage ? { usage } : {}),
      });
      return parsed;
    } catch (error) {
      const aiError = normalizeError(error, { abortedByCaller: signal?.aborted });
      const canRetry = aiError.retryable && attempt < AI_MAX_RETRIES && !signal?.aborted;
      const delayMs = aiError.retryAfterMs
        ?? Math.min(30000, AI_RETRY_BASE_MS * (2 ** attempt) + Math.floor(Math.random() * 250));

      logAiEvent(canRetry ? 'request_retrying' : 'error', {
        ...logContext,
        model,
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        code: aiError.code,
        providerStatus: aiError.status,
        requestId: aiError.requestId,
        retryable: aiError.retryable,
        ...(canRetry ? { delayMs } : {}),
      });

      if (!canRetry) throw aiError;
      onRetry?.({ attempt: attempt + 1, delayMs, error: aiError });
      await wait(delayMs, signal);
      if (signal?.aborted) {
        throw new AiServiceError('aborted', 'La solicitud a la IA fue cancelada.', { retryable: false });
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  throw new AiServiceError('unknown', 'La IA no devolvió una respuesta.', { retryable: false });
}

function parseJsonObject(content) {
  const fencedJson = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const parsed = JSON.parse(fencedJson ? fencedJson[1] : content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('La respuesta no es un objeto JSON.');
  }
  return parsed;
}

function validateCards(cards, maximumCount, { requireStatus = false, requireExactCount = false } = {}) {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error('No se generaron tarjetas válidas.');
  }
  if (requireExactCount && cards.length !== maximumCount) {
    throw new Error('La IA devolvió una cantidad de tarjetas inválida.');
  }

  const limitedCards = cards.slice(0, maximumCount);
  const validStatuses = new Set(['sin_cambios', 'corregida', 'fusionada', 'eliminada']);
  const hasInvalidCard = limitedCards.some((card) => {
    if (!card || typeof card !== 'object') return true;
    if (typeof card.question !== 'string' || !card.question.trim()) return true;
    if (typeof card.answer !== 'string' || !card.answer.trim()) return true;
    return requireStatus && !validStatuses.has(card.status);
  });
  if (hasInvalidCard) {
    throw new Error('La IA devolvió una tarjeta con un formato inválido.');
  }

  return limitedCards;
}

async function generateRawCards(text, targetCount, apiKey, context = {}) {
  const { signal, ...aiContext } = context;
  return callDeepSeekJson({
    apiKey,
    context: { ...aiContext, stage: 'deck_generate' },
    signal,
    requestBody: {
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Eres un procesador educativo de alta precisión. El texto del usuario puede ser un segmento de un documento mayor. Genera exactamente ${targetCount} flashcards en español basadas exclusivamente en este segmento y cubre sus ideas concretas sin inventar información. Devuelve SOLO JSON válido con la forma {"cards":[...]}. Cada tarjeta debe tener únicamente "question" y "answer", ambos strings de texto plano. No incluyas markdown ni explicaciones.`,
        },
        { role: 'user', content: text },
      ],
    },
    parseResponse(data) {
      const parsed = parseJsonObject(getMessageContent(data));
      return validateCards(parsed.cards, targetCount, { requireExactCount: true });
    },
  });
}

async function criticizeAndRefineCards(originalText, rawCards, apiKey, context = {}) {
  const useReasoner = rawCards.length >= REASONER_THRESHOLD;
  const model = useReasoner ? 'deepseek-reasoner' : 'deepseek-chat';
  const requestBody = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Eres un auditor académico de flashcards en español. Revisa cada tarjeta preliminar exclusivamente contra el segmento fuente recibido. Devuelve SOLO JSON válido con la forma {"cards":[...]}. Devuelve exactamente una salida por cada tarjeta preliminar y conserva una pregunta y respuesta por objeto.

Cada salida debe incluir question, answer y status. status debe ser uno de: sin_cambios, corregida, fusionada o eliminada. Corrige redacción ambigua o datos incompatibles con la fuente. Marca como fusionada una tarjeta redundante y como eliminada una tarjeta inventada o falsa. No incluyas razonamientos globales, markdown ni claves adicionales.`,
      },
      {
        role: 'user',
        content: JSON.stringify({ textoFuenteSegmento: originalText, tarjetasPreliminares: rawCards }),
      },
    ],
  };
  if (!useReasoner) requestBody.temperature = 0.1;

  const { signal, ...aiContext } = context;
  return callDeepSeekJson({
    apiKey,
    context: {
      ...aiContext,
      stage: 'deck_audit',
      rawCardCount: rawCards.length,
      reasonerThreshold: REASONER_THRESHOLD,
      useReasoner,
    },
    signal,
    requestBody,
    parseResponse(data) {
      const parsed = parseJsonObject(getMessageContent(data));
      return validateCards(parsed.cards, rawCards.length, { requireStatus: true, requireExactCount: true });
    },
  });
}

module.exports = {
  AiServiceError,
  callDeepSeekJson,
  createRunId,
  criticizeAndRefineCards,
  generateRawCards,
  getMessageContent,
  getSafeErrorMessage,
  getTokenUsage,
  logAiEvent,
  parseJsonObject,
  validateCards,
};
