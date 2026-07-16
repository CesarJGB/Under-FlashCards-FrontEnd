const { randomUUID } = require('crypto');

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const REASONER_THRESHOLD = parseInt(process.env.AI_REASONER_THRESHOLD, 10) || 20;
const AI_DEBUG_LOGS = process.env.AI_DEBUG_LOGS !== 'false';

function readBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

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

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeError(error) {
  if (error instanceof AiServiceError) return error;
  if (error?.name === 'AbortError') {
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
  const { onRetry, ...logContext } = context;
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

      logAiEvent('request_succeeded', {
        ...logContext,
        model,
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        requestId,
      });
      return parsed;
    } catch (error) {
      const aiError = normalizeError(error);
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
      await wait(delayMs);
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

async function generateRawCards(text, targetCount, apiKey, context = {}) {
  return callDeepSeekJson({
    apiKey,
    context: { ...context, stage: 'deck_generate' },
    requestBody: {
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Eres un procesador educativo de alta precisión. Genera exactamente ${targetCount} flashcards en español basadas exclusivamente en el texto del usuario. Devuelve SOLO JSON válido con la forma {"cards":[...]}. Cada tarjeta debe tener únicamente "question" y "answer", ambos strings de texto plano. No incluyas markdown ni explicaciones.`,
        },
        { role: 'user', content: text },
      ],
    },
    parseResponse(data) {
      const parsed = parseJsonObject(getMessageContent(data));
      if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
        throw new Error('No se generaron tarjetas válidas.');
      }
      return parsed.cards;
    },
  });
}

async function criticizeAndRefineCards(originalText, rawCards, apiKey, context = {}) {
  const useReasoner = rawCards.length > REASONER_THRESHOLD;
  const model = useReasoner ? 'deepseek-reasoner' : 'deepseek-chat';
  const requestBody = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Eres un auditor académico de flashcards en español. Revisa cada tarjeta preliminar exclusivamente contra el texto fuente. Devuelve SOLO JSON válido con la forma {"cards":[...]}. Devuelve exactamente una salida por cada tarjeta preliminar y conserva una pregunta y respuesta por objeto.

Cada salida debe incluir question, answer y status. status debe ser uno de: sin_cambios, corregida, fusionada o eliminada. Corrige redacción ambigua o datos incompatibles con la fuente. Marca como fusionada una tarjeta redundante y como eliminada una tarjeta inventada o falsa. No incluyas razonamientos globales, markdown ni claves adicionales.`,
      },
      {
        role: 'user',
        content: JSON.stringify({ textoFuenteOriginal: originalText, tarjetasPreliminares: rawCards }),
      },
    ],
  };
  if (!useReasoner) requestBody.temperature = 0.1;

  return callDeepSeekJson({
    apiKey,
    context: { ...context, stage: 'deck_audit' },
    requestBody,
    parseResponse(data) {
      const parsed = parseJsonObject(getMessageContent(data));
      if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
        throw new Error('La auditoría no devolvió tarjetas válidas.');
      }
      return parsed.cards;
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
  logAiEvent,
  parseJsonObject,
};
