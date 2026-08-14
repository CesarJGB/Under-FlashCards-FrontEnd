// FILE: backend/test/imageContractTelemetry.test.js
// Fase 1G — Corte 5A: pruebas deterministas de la observabilidad temporal del
// contrato legacy de entrega de imágenes
// (backend/src/utils/imageContractTelemetry.js).
// Sin MongoDB, sin red y sin credenciales.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SURFACES,
  classifyContract,
  classifyCover,
  buildUsageEvent,
  logImageDeliveryContractUsage,
} = require('../src/utils/imageContractTelemetry');

// Logger fake que acumula líneas para inspección.
function captureLogger() {
  const lines = [];
  return { lines, logger: { log: (line) => lines.push(line) } };
}

// Registra un evento con un req simulado y devuelve { lines, event }.
function emit(surface, query, loggerImpl) {
  const { lines, logger } = captureLogger();
  const req = { query: query || {} };
  const ok = logImageDeliveryContractUsage({ surface, req, logger: loggerImpl || logger });
  return { ok, lines, event: lines.length ? JSON.parse(lines[0]) : null };
}

// ---------------------------------------------------------------------------
// Clasificación de contract
// ---------------------------------------------------------------------------

test('telemetry: contract=indexed exact value classifies as indexed', () => {
  assert.equal(classifyContract('indexed'), 'indexed');
  assert.equal(classifyContract(undefined), 'legacy-missing', 'contraste');
});

test('telemetry: indexed request emits a single indexed event', () => {
  const { ok, lines, event } = emit('deck-list', { contract: 'indexed' });
  assert.equal(ok, true);
  assert.equal(lines.length, 1);
  assert.equal(event.contract, 'indexed');
});

test('telemetry: a missing contract property classifies as legacy-missing', () => {
  assert.equal(classifyContract(undefined), 'legacy-missing');
  assert.equal(emit('deck-cards', {}).event.contract, 'legacy-missing');
  assert.equal(emit('deck-cards', { t: '1' }).event.contract, 'legacy-missing', 'query sin contract => legacy-missing');
});

test('telemetry: a req without query object behaves as missing contract', () => {
  const { lines, logger } = captureLogger();
  const ok = logImageDeliveryContractUsage({ surface: 'deck-list', req: undefined, logger });
  assert.equal(ok, true);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).contract, 'legacy-missing');
  assert.equal(JSON.parse(lines[0]).cover, 'absent');
});

test('telemetry: any different contract value classifies as legacy-other', () => {
  for (const value of ['legacy', 'indexed ', 'INDEXED', 'Indexed', '1', 'contract=indexed']) {
    assert.equal(classifyContract(value), 'legacy-other', `'${value}' debe ser legacy-other`);
  }
  assert.equal(emit('deck-list', { contract: 'indexed ' }).event.contract, 'legacy-other');
  assert.equal(emit('deck-list', { contract: 'legacy' }).event.contract, 'legacy-other');
});

test('telemetry: an empty contract value classifies as legacy-other', () => {
  assert.equal(classifyContract(''), 'legacy-other');
  assert.equal(emit('deck-list', { contract: '' }).event.contract, 'legacy-other');
});

test('telemetry: arrays and unexpected types classify as legacy-other', () => {
  assert.equal(classifyContract(['indexed']), 'legacy-other', 'array => legacy-other');
  assert.equal(classifyContract(['indexed', 'indexed']), 'legacy-other');
  assert.equal(classifyContract(42), 'legacy-other', 'número => legacy-other');
  assert.equal(classifyContract(null), 'legacy-other', 'null => legacy-other');
  assert.equal(classifyContract(true), 'legacy-other', 'booleano => legacy-other');
  assert.equal(classifyContract({ contract: 'indexed' }), 'legacy-other', 'objeto => legacy-other');

  assert.equal(emit('deck-list', { contract: ['indexed'] }).event.contract, 'legacy-other');
  assert.equal(emit('deck-list', { contract: 0 }).event.contract, 'legacy-other');
});

// ---------------------------------------------------------------------------
// Clasificación de cover
// ---------------------------------------------------------------------------

test('telemetry: cover=thumbnail on deck-list classifies as thumbnail', () => {
  assert.equal(classifyCover('thumbnail', 'deck-list'), 'thumbnail');
  const { event } = emit('deck-list', { contract: 'indexed', cover: 'thumbnail' });
  assert.equal(event.contract, 'indexed');
  assert.equal(event.cover, 'thumbnail');
});

test('telemetry: absent cover on deck-list classifies as absent', () => {
  assert.equal(classifyCover(undefined, 'deck-list'), 'absent');
  assert.equal(emit('deck-list', {}).event.cover, 'absent');
  assert.equal(emit('deck-list', { contract: 'indexed' }).event.cover, 'absent');
});

test('telemetry: empty, unknown or unexpected cover values classify as other', () => {
  assert.equal(classifyCover('', 'deck-list'), 'other', 'vacío => other');
  assert.equal(classifyCover('full', 'deck-list'), 'other');
  assert.equal(classifyCover('THUMBNAIL', 'deck-list'), 'other');
  assert.equal(classifyCover(['thumbnail'], 'deck-list'), 'other', 'array => other');
  assert.equal(classifyCover(42, 'deck-list'), 'other');
  assert.equal(classifyCover(null, 'deck-list'), 'other');

  assert.equal(emit('deck-list', { cover: '' }).event.cover, 'other');
  assert.equal(emit('deck-list', { cover: 'full' }).event.cover, 'other');
  assert.equal(emit('deck-list', { cover: ['thumbnail'] }).event.cover, 'other');
});

test('telemetry: cover is not-applicable on every surface except deck-list', () => {
  for (const surface of ['deck-cards', 'continuous-session', 'normal-session', 'all-cards']) {
    assert.equal(classifyCover('thumbnail', surface), 'not-applicable');
    assert.equal(classifyCover(undefined, surface), 'not-applicable');
    assert.equal(classifyCover('', surface), 'not-applicable');
    assert.equal(classifyCover(42, surface), 'not-applicable');
    assert.equal(emit(surface, { cover: 'thumbnail' }).event.cover, 'not-applicable');
  }
});

// ---------------------------------------------------------------------------
// Superficies permitidas y superficie desconocida
// ---------------------------------------------------------------------------

test('telemetry: the five allowed surfaces are exactly deck-list, deck-cards, continuous-session, normal-session, all-cards', () => {
  assert.deepEqual([...SURFACES].sort(), [
    'all-cards',
    'continuous-session',
    'deck-cards',
    'deck-list',
    'normal-session',
  ]);
});

test('telemetry: each allowed surface emits exactly one event with its surface', () => {
  for (const surface of SURFACES) {
    const { ok, lines, event } = emit(surface, {});
    assert.equal(ok, true, `${surface} debe registrar`);
    assert.equal(lines.length, 1, `${surface} debe emitir exactamente una línea`);
    assert.equal(event.surface, surface);
    assert.equal(event.cover, surface === 'deck-list' ? 'absent' : 'not-applicable');
  }
});

test('telemetry: an unknown surface emits nothing and never throws', () => {
  const { lines, logger } = captureLogger();
  let threw = false;
  let ok;
  try {
    ok = logImageDeliveryContractUsage({ surface: 'deck', req: { query: {} }, logger });
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
  assert.equal(ok, false);
  assert.equal(lines.length, 0, 'superficie desconocida => sin líneas');
  assert.equal(classifyCover('thumbnail', 'deck'), 'not-applicable', 'cover no aplicable fuera de deck-list');
});

// ---------------------------------------------------------------------------
// Esquema del evento y fecha UTC
// ---------------------------------------------------------------------------

test('telemetry: the event has the exact stable schema', () => {
  const event = buildUsageEvent({
    surface: 'deck-list',
    contract: 'indexed',
    cover: 'thumbnail',
    at: '2026-08-14T12:00:00.000Z',
  });
  assert.deepEqual(event, {
    event: 'image_delivery_contract_usage',
    schemaVersion: 1,
    at: '2026-08-14T12:00:00.000Z',
    surface: 'deck-list',
    contract: 'indexed',
    cover: 'thumbnail',
  });
});

test('telemetry: the default timestamp is a valid ISO 8601 UTC date', () => {
  const event = buildUsageEvent({ surface: 'all-cards', contract: 'legacy-missing', cover: 'not-applicable' });
  assert.match(event.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'formato ISO con milisegundos y Z');
  assert.ok(!Number.isNaN(Date.parse(event.at)), 'fecha parseable');
  assert.equal(new Date(event.at).toISOString(), event.at, 'el valor es UTC exacto');

  const { event: emitted } = emit('deck-list', {});
  assert.match(emitted.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

// ---------------------------------------------------------------------------
// Privacidad: ausencia de PII y valores crudos
// ---------------------------------------------------------------------------

test('telemetry: the event never carries PII, raw query values or content', () => {
  const pii = {
    params: { userId: '000000000000000000000001', deckId: '000000000000000000000002', id: '000000000000000000000003' },
    query: {
      userId: '000000000000000000000001',
      deckId: '000000000000000000000002',
      contract: 'indexed ',
      cover: 'thumbnail',
      t: '999999',
      q: '¿pregunta sensible?',
    },
    headers: {
      'x-user-id': '000000000000000000000001',
      cookie: 'token=secreto',
      authorization: 'Bearer secreto',
      'user-agent': 'Mozilla/5.0 (iPhone)',
    },
  };

  const { lines } = captureLogger();
  const ok = logImageDeliveryContractUsage({
    surface: 'deck-list',
    req: { params: pii.params, query: pii.query, headers: pii.headers },
    logger: { log: (l) => lines.push(l) },
  });
  assert.equal(ok, true);
  const line = lines[0];
  const parsed = JSON.parse(line);

  // Sólo las seis claves del esquema, sin extras.
  assert.deepEqual(Object.keys(parsed).sort(), ['at', 'contract', 'cover', 'event', 'schemaVersion', 'surface']);

  // Valores clasificados, nunca crudos: 'indexed ' y 'thumbnail' crudos no viajan.
  assert.equal(parsed.contract, 'legacy-other');
  assert.equal(parsed.cover, 'thumbnail');

  // Ausencia total de PII, identificadores, tokens, query completa y contenido.
  for (const forbidden of [
    '000000000000000000000001',
    '000000000000000000000002',
    '000000000000000000000003',
    'token=secreto',
    'Bearer',
    'secreto',
    'Mozilla',
    'iPhone',
    'userId',
    'deckId',
    'x-user-id',
    '¿pregunta sensible?',
    '999999',
    'data:image',
    't=',
    'indexed ',
  ]) {
    assert.ok(!line.includes(forbidden), `la línea no debe contener ${forbidden}`);
  }
});

test('telemetry: no data URL or image content can appear in the event', () => {
  const { lines } = captureLogger();
  logImageDeliveryContractUsage({
    surface: 'deck-cards',
    req: { query: { contract: 'data:image/png;base64,AAAA' } },
    logger: { log: (l) => lines.push(l) },
  });
  const line = lines[0];
  assert.equal(JSON.parse(line).contract, 'legacy-other');
  assert.ok(!line.includes('data:image'), 'Data URLs nunca viajan');
});

// ---------------------------------------------------------------------------
// Comportamiento del logger
// ---------------------------------------------------------------------------

test('telemetry: exactly one logger call per request', () => {
  const { lines, logger } = captureLogger();
  logImageDeliveryContractUsage({ surface: 'deck-list', req: { query: {} }, logger });
  logImageDeliveryContractUsage({ surface: 'deck-list', req: { query: { contract: 'indexed' } }, logger });
  assert.equal(lines.length, 2, 'una línea por petición');
  assert.equal(JSON.parse(lines[0]).contract, 'legacy-missing');
  assert.equal(JSON.parse(lines[1]).contract, 'indexed');
});

test('telemetry: a throwing logger never breaks the request', () => {
  const throwing = { log() { throw new Error('logger roto'); } };
  let threw = false;
  let ok;
  try {
    ok = logImageDeliveryContractUsage({ surface: 'deck-list', req: { query: { contract: 'indexed' } }, logger: throwing });
  } catch {
    threw = true;
  }
  assert.equal(threw, false, 'la petición no debe fallar por el logger');
  assert.equal(ok, false, 'devuelve false cuando el logger falla');
});

test('telemetry: the emitted line is a single stable JSON object', () => {
  const { lines } = captureLogger();
  logImageDeliveryContractUsage({ surface: 'continuous-session', req: { query: {} }, logger: { log: (l) => lines.push(l) } });
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.event, 'image_delivery_contract_usage');
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.surface, 'continuous-session');
  assert.equal(parsed.contract, 'legacy-missing');
  assert.equal(parsed.cover, 'not-applicable');
});
