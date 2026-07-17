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
const AI_MAX_RETRIES = readBoundedInteger(process.env.AI_MAX_RETRIES, 3, 0, 4);
const AI_RETRY_BASE_MS = readBoundedInteger(process.env.AI_RETRY_BASE_MS, 1000, 250, 10000);
const AI_DECK_GENERATION_MAX_TOKENS = readBoundedInteger(
  process.env.AI_DECK_GENERATION_MAX_TOKENS,
  4096,
  512,
  16384
);
const AI_DECK_AUDIT_MAX_TOKENS = readBoundedInteger(
  process.env.AI_DECK_AUDIT_MAX_TOKENS,
  4096,
  512,
  16384
);
const AI_COMBINED_OVERGENERATION_FACTOR = 1.5;

class AiServiceError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'AiServiceError';
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = options.retryable === true;
    this.requestId = options.requestId ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.details = options.details ?? null;
    this.attempts = options.attempts ?? null;
  }
}

class ModelOutputValidationError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'ModelOutputValidationError';
    this.reason = reason;
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
  if (!choice) {
    throw new AiServiceError('invalid_model_output', 'La IA no devolvió una opción.', {
      retryable: true,
      details: { validationReason: 'missing_choice' },
    });
  }
  if (choice?.finish_reason === 'length') {
    throw new AiServiceError('truncated_output', 'La IA agotó el límite de respuesta.', {
      retryable: true,
      details: { finishReason: 'length' },
    });
  }
  if (choice.finish_reason && choice.finish_reason !== 'stop') {
    throw new AiServiceError('invalid_model_output', 'La IA terminó sin completar la respuesta.', {
      retryable: true,
      details: {
        validationReason: 'unexpected_finish_reason',
        finishReason: choice.finish_reason,
      },
    });
  }
  const content = choice?.message?.content?.trim();
  if (!content) {
    throw new AiServiceError('invalid_model_output', 'La IA devolvió una respuesta vacía.', {
      retryable: true,
      details: { validationReason: 'empty_content' },
    });
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
      let body = '';
      try {
        body = await response.text();
        data = JSON.parse(body.replace(/^\uFEFF/, ''));
      } catch {
        throw new AiServiceError('invalid_provider_response', 'DeepSeek devolvió una respuesta no JSON.', {
          requestId,
          retryable: true,
          details: {
            responseContentType: response.headers.get('content-type') || null,
            responseBytes: Buffer.byteLength(body),
            emptyResponse: body.trim().length === 0,
          },
        });
      }

      let parsed = data;
      if (parseResponse) {
        try {
          parsed = parseResponse(data);
        } catch (error) {
          if (error instanceof AiServiceError) {
            error.requestId ??= requestId;
            throw error;
          }
          throw new AiServiceError('invalid_model_output', 'La IA devolvió un formato no válido.', {
            requestId,
            retryable: true,
            details: {
              validationReason: error instanceof ModelOutputValidationError
                ? error.reason
                : 'invalid_payload',
            },
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
      aiError.attempts = attempt + 1;
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
        ...(aiError.details ? { details: aiError.details } : {}),
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
  let parsed;
  try {
    parsed = JSON.parse(fencedJson ? fencedJson[1] : content);
  } catch {
    throw new ModelOutputValidationError('invalid_json', 'La respuesta no contiene JSON válido.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ModelOutputValidationError('invalid_json_object', 'La respuesta no es un objeto JSON.');
  }
  return parsed;
}

function validateCards(
  cards,
  maximumCount,
  { requireStatus = false, requireExactCount = false, requireSourceEvidence = false } = {}
) {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new ModelOutputValidationError('missing_cards', 'No se generaron tarjetas válidas.');
  }
  if (requireExactCount && cards.length !== maximumCount) {
    throw new ModelOutputValidationError('wrong_card_count', 'La IA devolvió una cantidad de tarjetas inválida.');
  }

  const limitedCards = cards.slice(0, maximumCount);
  const validStatuses = new Set(['sin_cambios', 'corregida', 'fusionada', 'eliminada']);
  const expectedFields = requireStatus
    ? new Set(['question', 'answer', 'status'])
    : new Set(['question', 'answer']);
  if (requireSourceEvidence) expectedFields.add('sourceEvidence');
  const hasInvalidCard = limitedCards.some((card) => {
    if (!card || typeof card !== 'object' || Array.isArray(card)) return true;
    if (Object.keys(card).some((field) => !expectedFields.has(field))) return true;
    if (typeof card.question !== 'string' || !card.question.trim()) return true;
    if (typeof card.answer !== 'string' || !card.answer.trim()) return true;
    if (requireSourceEvidence && (typeof card.sourceEvidence !== 'string' || !card.sourceEvidence.trim())) return true;
    return requireStatus && !validStatuses.has(card.status);
  });
  if (hasInvalidCard) {
    throw new ModelOutputValidationError('invalid_card', 'La IA devolvió una tarjeta con un formato inválido.');
  }

  return limitedCards;
}

function normalizeEvidenceText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function validateSourceEvidence(cards, sourceText, { strict = false } = {}) {
  const normalizedSource = normalizeEvidenceText(sourceText);
  const sourceTokens = new Set(normalizedSource.split(/\s+/).filter(Boolean));
  const invalidIndexes = cards.reduce((indexes, card, index) => {
    const evidence = normalizeEvidenceText(card.sourceEvidence);
    const evidenceTokens = evidence ? evidence.split(/\s+/).filter(Boolean) : [];
    const matchingTokens = evidenceTokens.filter((token) => sourceTokens.has(token)).length;
    const sourceCoverage = evidenceTokens.length > 0
      ? matchingTokens / evidenceTokens.length
      : 0;
    if (evidenceTokens.length < 3 || sourceCoverage < 0.75) indexes.push(index + 1);
    return indexes;
  }, []);

  if (invalidIndexes.length > 0) {
    if (strict) {
      throw new ModelOutputValidationError(
        'unsupported_evidence',
        `La IA devolvió evidencia insuficientemente respaldada por el segmento para las tarjetas: ${invalidIndexes.join(', ')}.`
      );
    }
    logAiEvent('source_evidence_warning', { invalidCards: invalidIndexes });
  }
  return cards;
}

function hasNonAtomicQuestion(question) {
  const normalized = question.toLocaleLowerCase();
  if (/\bdiferencia entre\b/.test(normalized)) return true;
  if (/\b(?:y|e)\s+(?:cómo|qué|cuál|cuáles|por qué|para qué|tiene|indica|se evita|se calcula)\b/.test(normalized)) {
    return true;
  }
  return false;
}

function hasNonAtomicClinicalQuestion(question) {
  const normalized = question.toLocaleLowerCase();
  return /(?:tratamiento|profilaxis|indicación).*(?:,|\s(?:y|e)\s)/.test(normalized);
}

function validatePedagogicalCards(cards, { strict = false } = {}) {
  const hardInvalidIndexes = [];
  const clinicalListIndexes = [];
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const answer = card.answer.trim();
    if (hasNonAtomicQuestion(card.question)
      || /\betc\.?\b/i.test(answer)
      || answer.split(/\s+/).filter(Boolean).length > 60) hardInvalidIndexes.push(index + 1);
    else if (hasNonAtomicClinicalQuestion(card.question)) clinicalListIndexes.push(index + 1);
  }

  const clinicalListThreshold = Math.ceil(cards.length / 2);
  if (hardInvalidIndexes.length > 0 || clinicalListIndexes.length >= clinicalListThreshold) {
    const invalidIndexes = [...hardInvalidIndexes, ...clinicalListIndexes];
    if (strict) {
      throw new ModelOutputValidationError(
        'non_atomic_card',
        `La IA devolvió tarjetas pedagógicamente no atómicas: ${invalidIndexes.join(', ')}.`
      );
    }
    logAiEvent('pedagogy_warning', { invalidCards: invalidIndexes });
  }
  return cards;
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
      max_tokens: AI_DECK_GENERATION_MAX_TOKENS,
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

/**
 * Generates and audits a batch in one provider request.
 *
 * The model is asked to over-generate internally, but the only data returned
 * to the pipeline is the exact number of validated cards requested by the
 * caller. This keeps the controller contract compatible with the two-step
 * pipeline while removing the second network round trip and source resend.
 */
async function generateAndAuditBatch(segment, targetCount, apiKey, context = {}) {
  const normalizedTarget = Number.parseInt(targetCount, 10);
  if (!Number.isInteger(normalizedTarget) || normalizedTarget < 1) {
    throw new AiServiceError(
      'invalid_target_count',
      'La cantidad de tarjetas solicitada no es válida.',
      { retryable: false }
    );
  }
  if (typeof segment !== 'string' || !segment.trim()) {
    throw new AiServiceError(
      'invalid_source_segment',
      'El segmento fuente no es válido.',
      { retryable: false }
    );
  }
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new AiServiceError(
      'missing_api_key',
      'No se configuró una clave de IA.',
      { retryable: false }
    );
  }

  const rawCount = Math.max(
    normalizedTarget,
    Math.ceil(normalizedTarget * AI_COMBINED_OVERGENERATION_FACTOR)
  );
  const { signal, ...aiContext } = context;

  try {
    return await callDeepSeekJson({
      apiKey,
      context: {
        ...aiContext,
        stage: 'deck_generate_audit',
        rawCardCount: rawCount,
        targetCount: normalizedTarget,
      },
      signal,
      requestBody: {
        model: 'deepseek-chat',
        response_format: { type: 'json_object' },
        max_tokens: Math.max(AI_DECK_GENERATION_MAX_TOKENS, AI_DECK_AUDIT_MAX_TOKENS),
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: [
              'Eres un creador de flashcards experto y un auditor académico implacable.',
              `Genera internamente ${rawCount} tarjetas de estudio basadas EXCLUSIVAMENTE en el texto proporcionado y luego audítalas internamente para devolver solo las ${normalizedTarget} mejores.`,
              'REGLA CENTRAL DE ATOMICIDAD: cada tarjeta debe evaluar una sola relación o afirmación recuperable.',
              'Divide una candidata si combina dos definiciones, pide qué es algo y además cómo se calcula o evita, compara tres o más entidades, o contiene mecanismos independientes.',
              'No agrupes conceptos independientes mediante conjunciones. No agrupes distintas enfermedades, fármacos, indicaciones clínicas o escenarios en una misma pregunta: crea una tarjeta por indicación.',
              'Una lista solo es válida cuando la enumeración es el concepto explícito solicitado, como las reacciones de una fase; no es válida para ocultar varias indicaciones o definiciones.',
              'Cuando dos definiciones puedan estudiarse por separado, crea tarjetas separadas en vez de una pregunta de diferencia.',
              'La pregunta debe ser una sola pregunta, recuperar una respuesta breve y poder entenderse sin consultar el texto fuente.',
              'La respuesta debe ser autocontenida, preferiblemente de una o dos frases y aproximadamente de 40 palabras o menos. No uses "etc." para ocultar información relevante.',
              'DIFICULTAD ÚTIL: en lotes de cinco o más tarjetas, evita llenar el lote con respuestas que sean solo nombres. Cuando el segmento lo permita, prioriza mecanismos, efectos adversos, seguridad, indicaciones o relaciones causales, sin inventar detalles.',
              'FIDELIDAD: cada tarjeta debe incluir una cita textual breve de 3 a 12 palabras tomada del segmento en sourceEvidence. Verifica especialmente que cada par indicación-tratamiento aparezca asociado en el texto; no transfieras un fármaco desde una indicación cercana.',
              'PROHIBIDO inventar información. PROHIBIDO usar Markdown.',
              'EJEMPLOS: cambia "¿Qué ocurre en fase 1 y fase 2?" por "¿Qué reacciones caracterizan la fase 1?" y "¿Qué objetivo tiene la fase 2?".',
              'EJEMPLOS: cambia "¿Qué son los inductores e inhibidores del CYP450?" por una tarjeta para inductores y otra para inhibidores.',
              'EJEMPLOS: cambia "¿Cuál es la diferencia entre agonista completo, parcial e inverso?" por una tarjeta independiente para cada tipo.',
              'EJEMPLO: cambia "¿Cuál es el tratamiento para helmintos, quistes hidatídicos y neurocisticercosis?" por tarjetas separadas para cada indicación clínica.',
              'CHECKLIST FINAL PARA CADA TARJETA: una sola idea, pregunta recuperable, respuesta autocontenida, respaldo explícito en el segmento, dificultad útil y ausencia de redundancia o ambigüedad.',
              'PROCESO: genera candidatas de más, aplica el checklist a cada una, divide o elimina las que fallen, corrige la redacción y devuelve EXACTAMENTE la cantidad solicitada.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Texto fuente:\n"""\n${segment}\n"""\n\nDevuelve un JSON válido con esta estructura exacta: {"cards": [{"question": "string", "answer": "string", "sourceEvidence": "cita textual de 3 a 12 palabras"}]}. El array debe tener exactamente ${normalizedTarget} elementos. sourceEvidence debe copiar palabras consecutivas del texto fuente, sin inventarlas.`,
          },
        ],
      },
      parseResponse(data) {
        const parsed = parseJsonObject(getMessageContent(data));
        const cardsWithEvidence = validateCards(parsed.cards, normalizedTarget, {
          requireExactCount: true,
          requireSourceEvidence: true,
        });
        validateSourceEvidence(cardsWithEvidence, segment, {
          strict: process.env.AI_STRICT_SOURCE_EVIDENCE === 'true',
        });
        const cards = cardsWithEvidence.map(({ question, answer }) => ({ question, answer }));
        return validatePedagogicalCards(cards, {
          strict: process.env.AI_STRICT_PEDAGOGY === 'true',
        });
      },
    });
  } catch (error) {
    // callDeepSeekJson already classifies provider, timeout and parse errors.
    // Preserve that metadata; normalize unexpected failures for the controller.
    if (error instanceof AiServiceError) throw error;
    throw new AiServiceError(
      'combined_batch_failed',
      'No se pudo generar y auditar el lote de tarjetas.',
      {
        retryable: true,
        details: { validationReason: 'unexpected_combined_batch_error' },
      }
    );
  }
}

async function criticizeAndRefineCards(originalText, rawCards, apiKey, context = {}) {
  const useReasoner = rawCards.length >= REASONER_THRESHOLD;
  const model = useReasoner ? 'deepseek-reasoner' : 'deepseek-chat';
  const requestBody = {
    model,
    response_format: { type: 'json_object' },
    max_tokens: AI_DECK_AUDIT_MAX_TOKENS,
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
  generateAndAuditBatch,
  generateRawCards,
  getMessageContent,
  getSafeErrorMessage,
  getTokenUsage,
  logAiEvent,
  parseJsonObject,
  validateSourceEvidence,
  validatePedagogicalCards,
  validateCards,
};
