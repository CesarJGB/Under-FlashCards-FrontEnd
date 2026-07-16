const assert = require('node:assert/strict');
const test = require('node:test');

process.env.AI_DEBUG_LOGS = 'false';
process.env.AI_RETRY_BASE_MS = '250';

const {
  callDeepSeekJson,
  generateAndAuditBatch,
  generateRawCards,
  getMessageContent,
  validateCards,
} = require('../src/services/aiService');

function providerResponse(content, finishReason = 'stop') {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: finishReason,
      message: { content },
    }],
  }), { headers: { 'content-type': 'application/json' } });
}

test('callDeepSeekJson retries an HTTP success response with an invalid body', async (t) => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('<html>temporary gateway page</html>', {
        headers: { 'content-type': 'text/html' },
      });
    }
    return providerResponse('{"ok":true}');
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const result = await callDeepSeekJson({
    apiKey: 'test-key',
    requestBody: { model: 'deepseek-chat' },
    parseResponse: (data) => JSON.parse(getMessageContent(data)),
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
});

test('generateRawCards sets a bounded explicit output limit', async (t) => {
  const originalFetch = global.fetch;
  let requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return providerResponse('{"cards":[{"question":"Pregunta","answer":"Respuesta"}]}');
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const cards = await generateRawCards('Texto de prueba.', 1, 'test-key');

  assert.deepEqual(cards, [{ question: 'Pregunta', answer: 'Respuesta' }]);
  assert.equal(requestBody.max_tokens, 4096);
});

test('generateAndAuditBatch uses one combined request and validates the exact target', async (t) => {
  const originalFetch = global.fetch;
  let requestBody = null;
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls += 1;
    requestBody = JSON.parse(options.body);
    return providerResponse(JSON.stringify({
      cards: [
        { question: 'Pregunta uno', answer: 'Respuesta uno' },
        { question: 'Pregunta dos', answer: 'Respuesta dos' },
      ],
    }), 'stop');
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const cards = await generateAndAuditBatch('Texto fuente verificable.', 2, 'test-key');

  assert.equal(calls, 1);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], { question: 'Pregunta uno', answer: 'Respuesta uno' });
  assert.equal(requestBody.model, 'deepseek-chat');
  assert.deepEqual(requestBody.response_format, { type: 'json_object' });
  assert.equal(requestBody.temperature, 0.3);
  assert.match(requestBody.messages[0].content, /3 tarjetas/);
  assert.match(requestBody.messages[0].content, /2 mejores/);
  assert.match(requestBody.messages[1].content, /exactamente 2 elementos/);
});

test('generateAndAuditBatch rejects an invalid target before calling the provider', async () => {
  await assert.rejects(
    () => generateAndAuditBatch('Texto fuente.', 0, 'test-key'),
    (error) => error.code === 'invalid_target_count' && error.retryable === false
  );
});

test('model output validation exposes safe reasons and rejects unexpected fields', () => {
  assert.throws(
    () => getMessageContent({ choices: [{ finish_reason: 'length', message: { content: '' } }] }),
    (error) => error.code === 'truncated_output' && error.details.finishReason === 'length'
  );
  assert.throws(
    () => validateCards([{ question: 'Pregunta', answer: 'Respuesta', extra: 'no permitido' }], 1),
    (error) => error.reason === 'invalid_card'
  );
});
