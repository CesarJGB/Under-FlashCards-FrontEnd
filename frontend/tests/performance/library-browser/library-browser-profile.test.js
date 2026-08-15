// FILE: frontend/tests/performance/library-browser/library-browser-profile.test.js
// Pruebas deterministas del harness de la Fase 2B (utilidades puras y perfil
// de instrumentación). Sin red, sin navegador y sin dependencias externas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRequestGuard,
  buildAliases,
  classifyContractValue,
  classifyDuplicatePair,
  classifySurface,
  countElements,
  groupEquivalentRequests,
  GuardViolation,
  isProtectedSurface,
  normalizeRequestUrl,
  pathnameToPattern,
  redactUrlIds,
  redactUrlOrigin,
  sanitizeResults,
  selectBaselineDecks,
  SanitizationError,
  summarizeValues,
} from './libraryBrowserProfileUtils.mjs';
import { createPerfLibraryProfile } from '../../../src/lib/perfLibraryProfile.js';

// ---------------------------------------------------------------------------
// Normalización de solicitudes
// ---------------------------------------------------------------------------

test('normalizeRequestUrl ignora únicamente el parámetro volátil t', () => {
  const url = 'https://api.example.com/api/decks/0123456789abcdef01234567?t=1712345678901&contract=indexed&cover=thumbnail';
  const { pathname, params, normalizedUrl, volatile } = normalizeRequestUrl(url);
  assert.equal(pathname, '/api/decks/0123456789abcdef01234567');
  assert.equal(params.contract, 'indexed');
  assert.equal(params.cover, 'thumbnail');
  assert.equal(volatile.t, '1712345678901');
  assert.ok(!normalizedUrl.includes('t=1712345678901'));
  assert.ok(normalizedUrl.includes('contract=indexed'));
});

test('normalizeRequestUrl conserva parámetros no volátiles', () => {
  const url = 'https://api.example.com/api/flashcards/deck/abc?contract=indexed&x=1&t=2';
  const { normalizedUrl } = normalizeRequestUrl(url);
  assert.ok(normalizedUrl.includes('x=1'));
  assert.ok(!normalizedUrl.includes('t=2'));
});

test('normalizeRequestUrl tolera URLs inválidas sin lanzar', () => {
  const result = normalizeRequestUrl('not-a-url');
  assert.equal(result.origin, null);
  assert.equal(result.pathname, 'not-a-url');
});

// ---------------------------------------------------------------------------
// Clasificación de superficies
// ---------------------------------------------------------------------------

test('classifySurface identifica superficies protegidas y no protegidas', () => {
  assert.equal(classifySurface('/api/decks/0123456789abcdef01234567'), 'deck-list');
  assert.equal(classifySurface('/api/flashcards/deck/0123456789abcdef01234567'), 'deck-cards');
  assert.equal(classifySurface('/api/decks/0123456789abcdef01234567/all-cards'), 'all-cards');
  assert.equal(classifySurface('/api/decks/0123456789abcdef01234567/export'), 'deck-export');
  assert.equal(classifySurface('/api/academic/materias/0123456789abcdef01234567'), 'materias');
  assert.equal(classifySurface('/api/academic/temas/abc'), 'temas');
  assert.equal(classifySurface('/api/academic/subtemas/abc'), 'subtemas');
  assert.equal(classifySurface('/api/users/abc/preferences'), 'preferences');
  assert.equal(classifySurface('/api/user/abc/balance'), 'balance');
  assert.equal(classifySurface('/api/health'), 'health');
  assert.equal(classifySurface('/api/otra-cosa'), 'other');
  assert.equal(classifySurface('/api/academic/materias/abc/domain-preview'), 'materia-domain-preview');
});

test('isProtectedSurface: deck-list, deck-cards y all-cards son protegidas', () => {
  assert.ok(isProtectedSurface('deck-list'));
  assert.ok(isProtectedSurface('deck-cards'));
  assert.ok(isProtectedSurface('all-cards'));
  assert.ok(!isProtectedSurface('materias'));
  assert.ok(!isProtectedSurface('preferences'));
});

test('classifyContractValue distingue indexed de legacy', () => {
  assert.equal(classifyContractValue('indexed'), 'indexed');
  assert.equal(classifyContractValue(undefined), 'legacy-missing');
  assert.equal(classifyContractValue(null), 'legacy-missing');
  assert.equal(classifyContractValue(''), 'legacy-missing');
  assert.equal(classifyContractValue('legacy'), 'legacy-other');
});

// ---------------------------------------------------------------------------
// Guardia indexed (Corte 5A)
// ---------------------------------------------------------------------------

test('guardia acepta deck-list con contract=indexed y cover=thumbnail', () => {
  const result = assertRequestGuard({
    method: 'GET',
    urlString: 'https://api.example.com/api/decks/0123456789abcdef01234567?contract=indexed&cover=thumbnail',
    surface: 'deck-list',
    params: { contract: 'indexed', cover: 'thumbnail' },
  });
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'protected');
  assert.equal(result.contract, 'indexed');
});

test('guardia falla en deck-list sin cover=thumbnail', () => {
  assert.throws(
    () => assertRequestGuard({
      method: 'GET',
      surface: 'deck-list',
      params: { contract: 'indexed' },
    }),
    (err) => err instanceof GuardViolation && err.code === 'cover-missing',
  );
});

test('guardia falla en deck-list legacy (contract ausente)', () => {
  assert.throws(
    () => assertRequestGuard({ method: 'GET', surface: 'deck-list', params: {} }),
    (err) => err instanceof GuardViolation && err.code === 'legacy',
  );
});

test('guardia falla en deck-cards legacy (contract distinto de indexed)', () => {
  assert.throws(
    () => assertRequestGuard({ method: 'GET', surface: 'deck-cards', params: { contract: 'all' } }),
    (err) => err instanceof GuardViolation && err.code === 'legacy',
  );
});

test('guardia acepta deck-cards y all-cards con contract=indexed', () => {
  for (const surface of ['deck-cards', 'all-cards']) {
    const result = assertRequestGuard({ method: 'GET', surface, params: { contract: 'indexed' } });
    assert.equal(result.kind, 'protected');
  }
});

test('guardia NO clasifica materias como legacy aunque no lleven contract', () => {
  const result = assertRequestGuard({ method: 'GET', surface: 'materias', params: {} });
  assert.equal(result.kind, 'other');
  assert.equal(result.ok, true);
});

test('guardia falla ante métodos distintos de GET', () => {
  assert.throws(
    () => assertRequestGuard({ method: 'POST', surface: 'materias', params: {} }),
    (err) => err instanceof GuardViolation && err.code === 'non-get',
  );
  assert.throws(
    () => assertRequestGuard({ method: 'PUT', surface: 'preferences', params: {} }),
    (err) => err instanceof GuardViolation && err.code === 'non-get',
  );
});

test('guardia permite preflights OPTIONS y las identifica aparte', () => {
  const result = assertRequestGuard({ method: 'OPTIONS', surface: 'deck-list', params: {} });
  assert.equal(result.kind, 'preflight');
});

// ---------------------------------------------------------------------------
// Solicitudes equivalentes o duplicadas
// ---------------------------------------------------------------------------

test('classifyDuplicatePair detecta simultaneidad y equivalencia', () => {
  const a = { normalizedUrl: 'u', method: 'GET', start: 100, end: 300 };
  const b = { normalizedUrl: 'u', method: 'GET', start: 200, end: 400 };
  const c = { normalizedUrl: 'u', method: 'GET', start: 500, end: 600 };
  const d = { normalizedUrl: 'v', method: 'GET', start: 100, end: 300 };
  assert.equal(classifyDuplicatePair(a, b).reason, 'simultaneous-equivalent');
  assert.equal(classifyDuplicatePair(a, b).duplicate, true);
  assert.equal(classifyDuplicatePair(a, c).reason, 'sequential-equivalent');
  assert.equal(classifyDuplicatePair(a, d).reason, 'different-url');
});

test('groupEquivalentRequests agrupa por URL normalizada y cuenta solapamientos', () => {
  const groups = groupEquivalentRequests([
    { normalizedUrl: 'https://x/a?contract=indexed', method: 'GET', surface: 'deck-list', contract: 'indexed', window: 'w1', start: 0, end: 100, status: 200, initiator: 'i1' },
    { normalizedUrl: 'https://x/a?contract=indexed', method: 'GET', surface: 'deck-list', contract: 'indexed', window: 'w1', start: 50, end: 150, status: 200, initiator: 'i1' },
    { normalizedUrl: 'https://x/b', method: 'GET', surface: 'materias', contract: null, window: 'w2', start: 0, end: 50, status: 200, initiator: 'i2' },
  ]);
  const groupA = groups.find((g) => g.normalizedUrl === 'https://x/a?contract=indexed');
  assert.equal(groupA.count, 2);
  assert.equal(groupA.overlappingPairs, 1);
  assert.deepEqual(groupA.statuses, [200, 200]);
  assert.deepEqual(groupA.initiators, ['i1']);
});

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------

test('summarizeValues con 5 muestras deja p95 NOT MEASURED', () => {
  const summary = summarizeValues([10, 20, 30, 40, 50]);
  assert.equal(summary.samples, 5);
  assert.equal(summary.min, 10);
  assert.equal(summary.median, 30);
  assert.equal(summary.max, 50);
  assert.equal(summary.p95, 'NOT MEASURED');
});

test('summarizeValues ignora valores no finitos', () => {
  const summary = summarizeValues([1, 2, null, undefined, NaN, 3]);
  assert.equal(summary.samples, 3);
  assert.equal(summary.median, 2);
});

// ---------------------------------------------------------------------------
// Selección determinista C20/C100/C500 (misma regla que la Fase 2A)
// ---------------------------------------------------------------------------

test('selectBaselineDecks selecciona mazos exactos con distancia 0', () => {
  const decks = [
    { id: 'a'.repeat(24), cardCount: 20 },
    { id: 'b'.repeat(24), cardCount: 100 },
    { id: 'c'.repeat(24), cardCount: 500 },
  ];
  const selected = selectBaselineDecks(decks);
  assert.equal(selected.length, 3);
  assert.deepEqual(selected.map((s) => s.alias), ['C20-real', 'C100-real', 'C500-real']);
  assert.ok(selected.every((s) => s.distance === 0));
});

test('selectBaselineDecks rechaza mazos fuera del radio relativo 25%', () => {
  const decks = [{ id: 'a'.repeat(24), cardCount: 30 }];
  const selected = selectBaselineDecks(decks);
  assert.equal(selected.length, 0); // 30 está a 10 del objetivo 20 (> 25% * 20 = 5)
});

test('selectBaselineDecks desempata por id lexicográfico', () => {
  const decks = [
    { id: 'b'.repeat(24), cardCount: 19 },
    { id: 'a'.repeat(24), cardCount: 21 },
  ];
  const selected = selectBaselineDecks(decks);
  assert.equal(selected[0].deckId, 'a'.repeat(24)); // 21 → distancia 1; 19 → distancia 1; gana 'a'
});

test('countElements interpreta lista y tarjetas indexadas', () => {
  assert.equal(countElements([1, 2, 3], 'deck-list'), 3);
  assert.equal(countElements({ cards: [1, 2] }, 'deck-cards'), 2);
  assert.equal(countElements({ cards: [1, 2] }, 'deck-list'), null);
});

// ---------------------------------------------------------------------------
// Redacción de URLs e IDs en paths
// ---------------------------------------------------------------------------

test('pathnameToPattern reemplaza IDs reales por :id', () => {
  assert.equal(pathnameToPattern('/api/decks/0123456789abcdef01234567'), '/api/decks/:id');
  assert.equal(pathnameToPattern('/api/decks/0123456789abcdef01234567/all-cards'), '/api/decks/:id/all-cards');
  assert.equal(pathnameToPattern('/api/academic/temas/abc123'), '/api/academic/temas/abc123');
});

test('redactUrlOrigin elimina el origen real del backend', () => {
  const origin = 'https://real-backend.example.com';
  const input = { url: `${origin}/api/decks/x`, nested: [{ u: `${origin}/y` }], n: 1 };
  const out = redactUrlOrigin(input, origin);
  assert.ok(!JSON.stringify(out).includes(origin));
  assert.ok(JSON.stringify(out).includes('<backend-url>'));
});

test('buildAliases mapea usuario y mazos seleccionados', () => {
  const aliases = buildAliases('0123456789abcdef01234567', [
    { deckId: 'aaaaaaaaaaaaaaaaaaaaaaaa', alias: 'C20-real' },
  ]);
  assert.equal(aliases['0123456789abcdef01234567'], 'real-user-A');
  assert.equal(aliases.aaaaaaaaaaaaaaaaaaaaaaaa, 'C20-real');
});

// ---------------------------------------------------------------------------
// Sanitización de resultados
// ---------------------------------------------------------------------------

test('sanitizeResults rechaza claves de contenido', () => {
  assert.throws(
    () => sanitizeResults({ question: 'x' }, {}),
    (err) => err instanceof SanitizationError,
  );
  assert.throws(() => sanitizeResults({ name: 'x' }, {}), SanitizationError);
  assert.throws(() => sanitizeResults({ title: 'x' }, {}), SanitizationError);
});

test('sanitizeResults rechaza tokens prohibidos (data:)', () => {
  assert.throws(() => sanitizeResults({ value: 'data:image/png;base64,xxx' }, {}), SanitizationError);
});

test('sanitizeResults rechaza IDs reales sin alias', () => {
  assert.throws(
    () => sanitizeResults({ id: '0123456789abcdef01234567' }, {}),
    (err) => err instanceof SanitizationError,
  );
});

test('sanitizeResults rechaza cadenas largas sin alias (posible contenido)', () => {
  assert.throws(() => sanitizeResults({ big: 'x'.repeat(300) }, {}), SanitizationError);
});

test('sanitizeResults aplica aliases y acepta agregados seguros', () => {
  const aliases = { '0123456789abcdef01234567': 'real-user-A' };
  const json = sanitizeResults({
    user: '0123456789abcdef01234567',
    durations: [1.5, 2.5, 3.5],
    status: 'PASS',
  }, aliases);
  assert.ok(json.includes('real-user-A'));
  assert.ok(!json.includes('0123456789abcdef01234567'));
  assert.ok(json.includes('"status": "PASS"'));
});

test('sanitizeResults tolera el alias de URL del backend redactada', () => {
  const json = sanitizeResults({ url: '<backend-url>/api/decks/:id', n: 1 }, {});
  assert.ok(json.includes('<backend-url>'));
});

test('sanitizeResults rechaza un ID real incrustado en una cadena más larga (URL)', () => {
  const realId = '0123456789abcdef01234567';
  assert.throws(
    () => sanitizeResults({ url: `https://backend.example/api/temas/${realId}` }, {}),
    (err) => err instanceof SanitizationError && /ID real sin alias/.test(err.message),
  );
});

test('sanitizeResults acepta tokens hex permitidos (p. ej. SHA público)', () => {
  const sha = 'ecb025914435fa4659200c9890a0e4ffea916175';
  const json = sanitizeResults({ appSha: sha, n: 1 }, {}, { allowedHexTokens: [sha] });
  assert.ok(json.includes(sha));
});

test('redactUrlIds convierte segmentos de 24 hex en :id y conserva el resto', () => {
  const out = redactUrlIds('https://api.example.com/api/academic/temas/0123456789abcdef01234567?x=1');
  assert.equal(out, 'https://api.example.com/api/academic/temas/:id?x=1');
  assert.equal(redactUrlIds('https://api.example.com/api/decks/notanid'), 'https://api.example.com/api/decks/notanid');
});

test('groupEquivalentRequests agrupa por URL real y serializa la URL redactada', () => {
  const realId = '0123456789abcdef01234567';
  const groups = groupEquivalentRequests([
    { normalizedUrl: `https://x/api/temas/${realId}`, method: 'GET', surface: 'temas', contract: null, window: 'w1', start: 0, end: 50, status: 200 },
    { normalizedUrl: `https://x/api/temas/${realId}`, method: 'GET', surface: 'temas', contract: null, window: 'w1', start: 10, end: 60, status: 200 },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].normalizedUrl, 'https://x/api/temas/:id');
  assert.ok(!groups[0].normalizedUrl.includes(realId));
});

// ---------------------------------------------------------------------------
// Instrumentación de perfil (perfLibraryProfile)
// ---------------------------------------------------------------------------

test('perfLibraryProfile desactivado es inerte', () => {
  const profile = createPerfLibraryProfile(false);
  profile.renderCount('LibrarySection');
  const inv = profile.beginLoader('loadDecks', {});
  inv.end('ok');
  const snapshot = profile.snapshot();
  assert.deepEqual(snapshot.renderCounts, {});
  assert.equal(snapshot.loaderInvocations.length, 0);
});

test('perfLibraryProfile activado cuenta renders e invocaciones', () => {
  const profile = createPerfLibraryProfile(true);
  profile.renderCount('HomeSection');
  profile.renderCount('HomeSection');
  profile.renderCount('LibrarySection');
  const inv = profile.beginLoader('loadDecks', { showSpinner: false, signal: { aborted: false } });
  inv.end('ok');
  const snapshot = profile.snapshot();
  assert.equal(snapshot.renderCounts.HomeSection, 2);
  assert.equal(snapshot.renderCounts.LibrarySection, 1);
  assert.equal(snapshot.loaderInvocations.length, 1);
  assert.equal(snapshot.loaderInvocations[0].loader, 'loadDecks');
  assert.equal(snapshot.loaderInvocations[0].result, 'ok');
  assert.equal(snapshot.loaderInvocations[0].aborted, false);
  assert.ok(snapshot.loaderInvocations[0].end >= snapshot.loaderInvocations[0].start);
});

test('perfLibraryProfile detecta solapamiento de invocaciones equivalentes', () => {
  const profile = createPerfLibraryProfile(true);
  const first = profile.beginLoader('loadDecks', {});
  const second = profile.beginLoader('loadDecks', {});
  assert.equal(profile.snapshot().loaderInvocations[1].overlapped, true);
  first.end('ok');
  second.end('error');
  const snapshot = profile.snapshot();
  assert.equal(snapshot.loaderInvocations[0].overlapped, false);
  assert.equal(snapshot.loaderInvocations[1].overlapped, true);
  assert.equal(snapshot.loaderInvocations[1].result, 'error');
});

test('perfLibraryProfile registra abortos cuando la señal aborta', () => {
  const profile = createPerfLibraryProfile(true);
  const signal = { aborted: true };
  const inv = profile.beginLoader('loadMaterias', { signal });
  inv.end('error');
  assert.equal(profile.snapshot().loaderInvocations[0].aborted, true);
  assert.equal(profile.snapshot().loaderInvocations[0].hasSignal, true);
});

test('perfLibraryProfile permite reiniciar el registro', () => {
  const profile = createPerfLibraryProfile(true);
  profile.renderCount('DeckInterior');
  profile.reset();
  assert.deepEqual(profile.snapshot().renderCounts, {});
  assert.equal(profile.snapshot().loaderInvocations.length, 0);
});
