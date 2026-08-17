// FILE: frontend/tests/performance/library-browser/library-browser-profile.test.js
// Pruebas deterministas del harness de la Fase 2B (utilidades puras y perfil
// de instrumentación). Sin red, sin navegador y sin dependencias externas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRequestGuard,
  buildAliases,
  buildPageTimings,
  classifyContractValue,
  classifyDuplicatePair,
  classifySurface,
  correlateCdpNetwork,
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
  summarizeCommits,
  summarizeLongTasks,
  summarizeNetworkSamples,
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

// ---------------------------------------------------------------------------
// Correlación CDP uno a uno (corrección Fase 2B)
// ---------------------------------------------------------------------------

const WINDOW = 'B1-cold-start';
const URL_A = 'https://api.example.com/api/decks/:id?contract=indexed';
const URL_B = 'https://api.example.com/api/flashcards/deck/:id?contract=indexed';

test('correlateCdpNetwork empareja dos solicitudes simultáneas de la MISMA URL con entradas CDP DISTINTAS y sin reutilización', () => {
  // Dos solicitudes simultáneas (misma ventana y URL normalizada), con TTFB,
  // bytes y tiempos de finalización distintos en sus entradas CDP.
  const req1 = { window: WINDOW, normalizedUrl: URL_A, seq: 0, start: 1000, end: 2200 };
  const req2 = { window: WINDOW, normalizedUrl: URL_A, seq: 1, start: 1050, end: 2600 };
  const entry1 = {
    window: WINDOW, normalizedUrl: URL_A, seq: 0,
    sendStartMs: 1010, receiveHeadersEndMs: 1170, receivedAtMs: 1180, finishedAtMs: 2100,
    encoded: 100, decoded: 300, transfer: 100,
  };
  const entry2 = {
    window: WINDOW, normalizedUrl: URL_A, seq: 1,
    sendStartMs: 1060, receiveHeadersEndMs: 1330, receivedAtMs: 1340, finishedAtMs: 2500,
    encoded: 200, decoded: 600, transfer: 200,
  };
  const { byRequest, summary } = correlateCdpNetwork([req1, req2], [entry1, entry2]);
  assert.equal(summary.matched, 2);
  assert.equal(summary.unmatched, 0);
  // Uno a uno: cada solicitud consume su propia entrada (nunca la del vecino).
  assert.equal(byRequest.get(req1), entry1);
  assert.equal(byRequest.get(req2), entry2);
  assert.notEqual(byRequest.get(req1), byRequest.get(req2));
  // Métricas distintas derivadas de entradas distintas.
  const ttfbOf = (entry) => Math.max(0, entry.receiveHeadersEndMs - entry.sendStartMs);
  assert.equal(ttfbOf(byRequest.get(req1)), 160);
  assert.equal(ttfbOf(byRequest.get(req2)), 270);
  assert.notEqual(ttfbOf(byRequest.get(req1)), ttfbOf(byRequest.get(req2)));
  // Ninguna entrada es reutilizada (asignación inyectiva).
  const assignments = [...byRequest.values()].filter(Boolean);
  assert.equal(new Set(assignments).size, assignments.length);
});

test('correlateCdpNetwork preserva el orden causal y es determinista', () => {
  const requests = [
    { window: WINDOW, normalizedUrl: URL_B, seq: 0, start: 100, end: 500 },
    { window: WINDOW, normalizedUrl: URL_B, seq: 1, start: 600, end: 900 },
  ];
  const entries = [
    { window: WINDOW, normalizedUrl: URL_B, seq: 0, sendStartMs: 150, receiveHeadersEndMs: 200, receivedAtMs: 210, finishedAtMs: 490, encoded: 10, decoded: 30, transfer: 10 },
    { window: WINDOW, normalizedUrl: URL_B, seq: 1, sendStartMs: 650, receiveHeadersEndMs: 700, receivedAtMs: 710, finishedAtMs: 880, encoded: 20, decoded: 60, transfer: 20 },
  ];
  const first = correlateCdpNetwork(requests, entries);
  const second = correlateCdpNetwork(requests, entries);
  assert.deepEqual([...first.byRequest.values()], [...second.byRequest.values()]);
  assert.equal(first.byRequest.get(requests[0]), entries[0]);
  assert.equal(first.byRequest.get(requests[1]), entries[1]);
  assert.equal(first.summary.matched, 2);
  assert.equal(first.summary.unmatched, 0);
});

test('correlateCdpNetwork deja una entrada CDP sin observación SIN asignar y una solicitud sin entrada como unmatched', () => {
  const req = { window: WINDOW, normalizedUrl: URL_A, seq: 0, start: 100, end: 400 };
  // Entrada CDP de OTRA URL (no hay observación equivalente en su grupo):
  // el grupo de la entrada sólo contiene entradas -> nunca se asigna.
  const orphanEntry = { window: WINDOW, normalizedUrl: URL_B, seq: 9, sendStartMs: 120, receiveHeadersEndMs: 200, receivedAtMs: 210, finishedAtMs: 300, encoded: 1, decoded: 1, transfer: 1 };
  const { byRequest, summary } = correlateCdpNetwork([req], [orphanEntry]);
  // La solicitud no tiene entrada CDP equivalente: queda explícitamente null.
  assert.equal(byRequest.get(req), null);
  assert.equal(summary.matched, 0);
  assert.equal(summary.unmatched, 1);
  assert.equal(summary.totalCdpEntries, 1);
  assert.ok(summary.groups.some((g) => g.normalizedUrl === URL_B && g.observedRequests === 0 && g.unassignedEntries === 1));
  // La entrada huérfana nunca se asigna: agregar una segunda solicitud sin
  // entrada deja ambas sin correlación (ninguna hereda la entrada huérfana).
  const req2 = { window: WINDOW, normalizedUrl: URL_A, seq: 1, start: 500, end: 800 };
  const second = correlateCdpNetwork([req, req2], [orphanEntry]);
  assert.equal(second.byRequest.get(req), null);
  assert.equal(second.byRequest.get(req2), null);
  assert.equal(second.summary.matched, 0);
  assert.equal(second.summary.unmatched, 2);
});

test('correlateCdpNetwork marca grupos con conteo desigual (mismatch) sin reutilizar entradas', () => {
  // 2 solicitudes simultáneas de la misma URL, 1 sola entrada CDP: la primera
  // en orden causal consume la entrada; la segunda queda unmatched; la
  // entrada NO se reutiliza y el grupo queda señalado con countMismatch.
  const req1 = { window: WINDOW, normalizedUrl: URL_A, seq: 0, start: 100, end: 400 };
  const req2 = { window: WINDOW, normalizedUrl: URL_A, seq: 1, start: 200, end: 500 };
  const entry = { window: WINDOW, normalizedUrl: URL_A, seq: 0, sendStartMs: 110, receiveHeadersEndMs: 300, receivedAtMs: 310, finishedAtMs: 390, encoded: 5, decoded: 15, transfer: 5 };
  const { byRequest, summary } = correlateCdpNetwork([req1, req2], [entry]);
  assert.equal(byRequest.get(req1), entry);
  assert.equal(byRequest.get(req2), null);
  assert.equal(summary.matched, 1);
  assert.equal(summary.unmatched, 1);
  assert.equal(summary.mismatchedGroups, 1);
  const group = summary.groups.find((g) => g.window === WINDOW && g.normalizedUrl === URL_A);
  assert.equal(group.countMismatch, true);
  assert.equal(group.unassignedEntries, 0);
});

test('correlateCdpNetwork asigna la entrada CDP a la solicitud que COMPLETÓ, no a la abortada', () => {
  // Duplicación real observada (PERF-NET-001): dos solicitudes equivalentes;
  // la primera (start anterior) se aborta y nunca recibe respuesta (end null);
  // la entrada CDP corresponde a la segunda, que es la que completó.
  const aborted = { window: WINDOW, normalizedUrl: URL_A, seq: 0, start: 100, end: null };
  const completed = { window: WINDOW, normalizedUrl: URL_A, seq: 1, start: 150, end: 400 };
  const entry = { window: WINDOW, normalizedUrl: URL_A, seq: 0, sendStartMs: 160, receiveHeadersEndMs: 300, receivedAtMs: 310, finishedAtMs: 390, encoded: 5, decoded: 15, transfer: 5 };
  const { byRequest, summary } = correlateCdpNetwork([aborted, completed], [entry]);
  assert.equal(byRequest.get(completed), entry);
  assert.equal(byRequest.get(aborted), null);
  assert.equal(summary.matched, 1);
  assert.equal(summary.unmatched, 1);
  // La solicitud abortada no hereda métricas ajenas.
  assert.equal(aborted.ttfbMs, undefined);
});

test('correlateCdpNetwork agrupa por ventana y URL normalizada (no cruza ventanas)', () => {
  const reqA = { window: 'w1', normalizedUrl: URL_A, seq: 0, start: 100, end: 300 };
  const reqB = { window: 'w2', normalizedUrl: URL_A, seq: 0, start: 100, end: 300 };
  const entryA = { window: 'w1', normalizedUrl: URL_A, seq: 0, sendStartMs: 110, receiveHeadersEndMs: 200, receivedAtMs: 210, finishedAtMs: 290, encoded: 1, decoded: 1, transfer: 1 };
  const { byRequest, summary } = correlateCdpNetwork([reqA, reqB], [entryA]);
  assert.equal(byRequest.get(reqA), entryA);
  assert.equal(byRequest.get(reqB), null);
  assert.equal(summary.unmatched, 1);
});

test('summarizeNetworkSamples agrega sin doble contabilización y separa unmatched', () => {
  const samples = [
    { correlation: 'matched', ttfbMs: 100, downloadMs: 10, transferSize: 500, encodedBodySize: 500, decodedBodySize: 1500 },
    { correlation: 'matched', ttfbMs: 200, downloadMs: 20, transferSize: 600, encodedBodySize: 600, decodedBodySize: 1800 },
    { correlation: 'unmatched', ttfbMs: null, downloadMs: null, transferSize: null, encodedBodySize: null, decodedBodySize: null },
  ];
  const agg = summarizeNetworkSamples(samples);
  assert.equal(agg.samples, 3);
  assert.equal(agg.matched, 2);
  assert.equal(agg.unmatched, 1);
  assert.equal(agg.ttfbMsAggregate.samples, 2);
  assert.equal(agg.ttfbMsAggregate.min, 100);
  assert.equal(agg.ttfbMsAggregate.max, 200);
  // Bytes: cada entrada CDP contribuye una única vez (sin doble conteo).
  assert.equal(agg.transferSizeAggregate.samples, 2);
  assert.equal(agg.transferSizeAggregate.min + agg.transferSizeAggregate.max, 1100);
  assert.equal(agg.decodedBodySizeAggregate.samples, 2);
});

test('summarizeNetworkSamples excluye unmatched con métricas finitas de todos los agregados', () => {
  const matched = {
    correlation: 'matched',
    durationMs: 100,
    ttfbMs: 50,
    downloadMs: 20,
    transferSize: 500,
    encodedBodySize: 500,
    decodedBodySize: 1500,
  };
  const unmatched = {
    correlation: 'unmatched',
    durationMs: 9999,
    ttfbMs: 8888,
    downloadMs: 7777,
    transferSize: 999999,
    encodedBodySize: 888888,
    decodedBodySize: 777777,
  };

  const agg = summarizeNetworkSamples([matched, unmatched]);

  assert.equal(agg.samples, 2);
  assert.equal(agg.matched, 1);
  assert.equal(agg.unmatched, 1);
  for (const metric of [
    'durationMs',
    'ttfbMs',
    'downloadMs',
    'transferSize',
    'encodedBodySize',
    'decodedBodySize',
  ]) {
    assert.deepEqual(agg[`${metric}Aggregate`], {
      samples: 1,
      min: matched[metric],
      median: matched[metric],
      max: matched[metric],
      p95: 'NOT MEASURED',
    });
    assert.notEqual(agg[`${metric}Aggregate`].max, unmatched[metric]);
  }
});

// ---------------------------------------------------------------------------
// Commits de React y tareas largas (persistencia por escenario/repetición)
// ---------------------------------------------------------------------------

test('summarizeCommits cuenta fases, totales y rango temporal', () => {
  const summary = summarizeCommits([
    { phase: 'mount', actualDuration: 10, baseDuration: 5, startTime: 100, commitTime: 120 },
    { phase: 'update', actualDuration: 4, baseDuration: 3, startTime: 130, commitTime: 140 },
    { phase: 'update', actualDuration: 2, baseDuration: 2, startTime: 150, commitTime: 160 },
  ]);
  assert.equal(summary.count, 3);
  assert.deepEqual(summary.phases, { mount: 1, update: 2 });
  assert.equal(summary.actualDurationTotalMs, 16);
  assert.equal(summary.baseDurationTotalMs, 10);
  assert.equal(summary.startTimeMinMs, 100);
  assert.equal(summary.commitTimeMaxMs, 160);
});

test('summarizeCommits tolera entradas vacías o sin fases conocidas', () => {
  assert.equal(summarizeCommits([]).count, 0);
  assert.equal(summarizeCommits([{ phase: 'unknown-phase' }]).phases['unknown-phase'], 1);
});

test('summarizeLongTasks persiste conteos, totales, máximos y offsets relativos', () => {
  const summary = summarizeLongTasks(
    [{ startTime: 100.4, duration: 51 }, { startTime: 300.2, duration: 67.5 }],
    { scope: 'B4-library-processing', observed: true },
  );
  assert.equal(summary.status, 'measured');
  assert.equal(summary.count, 2);
  assert.equal(summary.totalMs, 118.5);
  assert.equal(summary.maxMs, 67.5);
  assert.deepEqual(summary.relativeStartOffsetsMs, [100, 300]);
  assert.equal(summary.scope, 'B4-library-processing');
  assert.equal(summary.zeroValid, true);
});

test('summarizeLongTasks registra cero válido sólo si la observación estuvo activa', () => {
  const zero = summarizeLongTasks([], { scope: 'w', observed: true });
  assert.equal(zero.count, 0);
  assert.equal(zero.totalMs, 0);
  assert.equal(zero.maxMs, 0);
  assert.equal(zero.zeroValid, true);
});

test('summarizeLongTasks declara NOT MEASURED si el observador no estuvo activo', () => {
  const summary = summarizeLongTasks(null, { scope: 'w', observed: false });
  assert.equal(summary.status, 'NOT MEASURED');
  assert.match(summary.reason, /observador/);
});

// ---------------------------------------------------------------------------
// Tiempos de página (body/parse/transform) por superficie
// ---------------------------------------------------------------------------

test('buildPageTimings separa body, JSON.parse puro y transformación por superficie sin persistir URLs', () => {
  const records = [
    {
      isBackend: true, status: 200,
      url: 'https://api.example.com/api/decks/0123456789abcdef01234567?t=1&contract=indexed&cover=thumbnail',
      bodyReadMs: 5, parseMs: 3, transformMs: 1, parseFallback: false, equivalence: 'verified',
    },
    {
      isBackend: true, status: 200,
      url: 'https://api.example.com/api/decks/0123456789abcdef01234567?t=2&contract=indexed&cover=thumbnail',
      bodyReadMs: 7, parseMs: 4, transformMs: 1.5, parseFallback: false, equivalence: 'verified',
    },
    { isBackend: false, url: 'https://cdn.example.com/x.js', status: 200, bodyReadMs: 1, parseMs: 1, transformMs: 1 },
  ];
  const timings = buildPageTimings(records);
  const json = JSON.stringify(timings);
  // Nunca se persiste la URL real ni el ID real.
  assert.ok(!json.includes('api.example.com'));
  assert.ok(!json.includes('0123456789abcdef01234567'));
  assert.ok(!json.includes('cdn.example.com'));
  assert.ok(timings['deck-list']);
  assert.equal(timings['deck-list'].count, 2);
  assert.equal(timings['deck-list'].parseAggregate.median, 3.5);
  assert.equal(timings['deck-list'].bodyReadAggregate.min, 5);
  assert.equal(timings['deck-list'].transformAggregate.max, 1.5);
  assert.equal(timings['deck-list'].equivalence.verified, 2);
  // Superficies sin muestras válidas: NOT MEASURED explícito, nunca omisión.
  assert.equal(timings['deck-cards'].notMeasured, true);
  assert.equal(timings['deck-cards'].parseAggregate.samples, 0);
  assert.equal(timings['deck-cards'].parseAggregate.p95, 'NOT MEASURED');
});

test('buildPageTimings ignora respuestas no-200 y fetchRecords de no-backend', () => {
  const timings = buildPageTimings([
    { isBackend: true, status: 404, url: 'https://api.example.com/api/health', bodyReadMs: 5, parseMs: 2, transformMs: 0 },
    { isBackend: true, status: 200, url: 'https://api.example.com/api/academic/materias/abc', bodyReadMs: 1, parseMs: 1, transformMs: 0 },
  ]);
  assert.equal(timings.materias.count, 1);
  assert.equal(timings.materias.notMeasured, false);
  // La superficie 404 no produce muestras: NOT MEASURED explícito.
  assert.equal(timings.health.notMeasured, true);
  assert.equal(timings.health.count, 0);
});
