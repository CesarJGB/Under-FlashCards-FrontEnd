#!/usr/bin/env node
// Validador post-run de la Fase 2B (uso de verificación, no forma parte del
// runner): valida esquema, sanitización/privacidad y guardia del Corte 5A de
// los artefactos JSON finales antes del Commit B.
//
// Uso: node validate-final-results.mjs <raw-results-2b.json> [raw-results-2b-profiling.json]
// Salida: 0 si todo pasa; 1 con la lista de problemas.
import fs from 'node:fs';

const REAL_ID = /[0-9a-f]{24}/g;
const FORBIDDEN_TOKENS = ['data:', 'mongodb://', 'Bearer ', 'duckdns', '6a375060170bc0e94d90942c'];
const FORBIDDEN_KEYS = ['question', 'answer', 'bgImage', 'contentImage', 'coverImage', 'coverImageThumb', 'cardBackgrounds', 'title', 'name', 'email', 'token', 'cookie', 'authorization', 'credential', 'password'];

function walk(value, path, leaves) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, leaves));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, leaves);
    return;
  }
  leaves.push({ path, value });
}

function validateSchema(j, { profiling }) {
  const errors = [];
  const require = (cond, msg) => { if (!cond) errors.push(msg); };
  require(j.schemaVersion === '3.0.0', `schemaVersion debe ser 3.0.0 (${j.schemaVersion})`);
  require(j.kind === 'under-flashcards-library-browser-profile', 'kind incorrecto');
  require(j.applicationBaseSha === 'ecb025914435fa4659200c9890a0e4ffea916175', `applicationBaseSha incorrecto: ${j.applicationBaseSha}`);
  require(/^[0-9a-f]{40}$/.test(j.harnessSha || ''), `harnessSha inválido: ${j.harnessSha}`);
  require(j.harnessSha !== j.applicationBaseSha, 'harnessSha no debe ser igual a applicationBaseSha (flujo de dos commits)');
  require(typeof j.measuredAtUtc === 'string' && j.measuredAtUtc.length > 0, 'measuredAtUtc ausente');
  require(j.user === 'real-user-A', `user debe ser real-user-A (${j.user})`);
  require(j.samplesRequested === 5 && j.samplesValid === 5, `samples: ${j.samplesRequested}/${j.samplesValid}`);
  require(['production', 'profiling'].includes(j.buildMode), `buildMode inválido: ${j.buildMode}`);
  require(['PASS', 'PASS PARCIAL', 'BLOCKED', 'FAIL'].includes(j.status), `status inválido: ${j.status}`);
  require(Array.isArray(j.notMeasured), 'notMeasured ausente');
  for (const k of ['B1', 'B2', 'B5', 'B6', 'B7']) {
    require(j.scenarios[k] && Array.isArray(j.scenarios[k].samples) && j.scenarios[k].samples.length === 5, `${k}: 5 muestras requeridas`);
  }
  require(j.scenarios.B3 && j.scenarios.B3.cold.length === 5 && j.scenarios.B3.warm.length === 5, 'B3: 5 frías + 5 calientes');
  require(j.scenarios.B4 && Array.isArray(j.scenarios.B4.ops) && j.scenarios.B4.reps.length === 5, 'B4: ops + 5 reps');
  // Snapshots por repetición: long tasks y timings persistidos.
  for (const s of j.scenarios.B1.samples) {
    require(s.snapshot && s.snapshot.longTasks && s.snapshot.longTasks.status, 'B1: longTasks no persistidas por repetición');
    require(s.snapshot && s.snapshot.pageTimings, 'B1: pageTimings no persistidos por repetición');
    require(s.snapshot && s.snapshot.dom, 'B1: dom no persistido por repetición');
  }
  // Red por superficie y por colección (deck-cards separada C20/C100/C500).
  require(j.network && j.network.bySurface && j.network.bySurface['deck-cards'], 'network.bySurface.deck-cards ausente');
  require(j.network.byCollection && j.network.byCollection['C20-real'] && j.network.byCollection['C100-real'] && j.network.byCollection['C500-real'], 'network.byCollection incompleto (C20/C100/C500)');
  require(j.network.correlation && typeof j.network.correlation.matched === 'number', 'network.correlation ausente');
  // Long tasks y DOM a nivel de resultado.
  require(j.longTasks && j.longTasks.scenarios && j.longTasks.scenarios.B1, 'longTasks.scenarios.B1 ausente');
  require(j.dom && j.dom.summary, 'dom.summary ausente');
  if (profiling) {
    require(j.react && j.react.aliasVerified === true, 'react.aliasVerified debe ser true');
    require(j.react.scenarios && j.react.scenarios.B1 && j.react.scenarios.B1.reps.length === 5, 'react: 5 reps por escenario (B1)');
    require(j.react.scenarios.B5 && j.react.scenarios.B5.reps.length === 5, 'react: B5 reps');
    require(j.react.scenarios.B6 && j.react.scenarios.B6.reps.length === 5, 'react: B6 reps');
    require(j.react.scenarios.B7 && j.react.scenarios.B7.reps.length === 5, 'react: B7 reps');
  }
  return errors;
}

function validateSanitization(j) {
  const errors = [];
  const leaves = [];
  walk(j, '', leaves);
  for (const { path, value } of leaves) {
    const key = String(path).split('.').pop().replace(/\[\d+\]$/, '');
    if (FORBIDDEN_KEYS.includes(key)) errors.push(`clave prohibida: ${path}`);
    if (typeof value === 'string') {
      for (const token of FORBIDDEN_TOKENS) {
        if (value.includes(token)) errors.push(`token prohibido en ${path}: ${token}`);
      }
      if (value.length > 256) errors.push(`cadena larga sin alias en ${path} (${value.length})`);
    }
  }
  const raw = JSON.stringify(j);
  const ids = raw.match(REAL_ID) || [];
  // Los SHAs públicos (40 hex) contienen subcadenas de 24 hex: se permiten
  // exactamente igual que en sanitizeResults (includes sobre el token).
  const allowedShas = ['ecb025914435fa4659200c9890a0e4ffea916175', j.harnessSha];
  for (const id of ids) {
    const allowed = allowedShas.some((s) => typeof s === 'string' && s.includes(id));
    if (!allowed) errors.push(`ID real sin alias en artefacto: ${id}`);
  }
  if (raw.includes('under-flashcards.duckdns.org')) errors.push('dominio real presente en el artefacto');
  return errors;
}

function validateGuard(j) {
  const errors = [];
  const g = j.guard;
  if (!g) return ['guard ausente'];
  if (g.totalIndexedEvents < 1) errors.push('cero eventos indexados');
  if (g.legacyEvents !== 0) errors.push(`legacy: ${g.legacyEvents}`);
  if (g.allCards !== 0) errors.push(`all-cards: ${g.allCards}`);
  if (g.writes !== 0) errors.push(`escrituras: ${g.writes}`);
  if (!g.methods.every((m) => m === 'GET')) errors.push(`métodos: ${g.methods.join(',')}`);
  if (g.violations.length !== 0) errors.push(`violaciones: ${JSON.stringify(g.violations)}`);
  return errors;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Uso: node validate-final-results.mjs <json> [json-profiling]');
  process.exit(2);
}
let allOk = true;
for (const file of files) {
  const profiling = file.includes('profiling');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = [
    ...validateSchema(j, { profiling }),
    ...validateSanitization(j),
    ...validateGuard(j),
  ];
  if (problems.length) {
    allOk = false;
    console.log(`FAIL ${file}`);
    for (const p of problems) console.log(`  - ${p}`);
  } else {
    console.log(`PASS ${file} (${j.status}, ${j.samplesValid}/${j.samplesRequested}, guard ${j.guard.totalIndexedEvents} indexed / ${j.guard.legacyEvents} legacy / ${j.guard.allCards} all-cards)`);
  }
}
process.exit(allOk ? 0 : 1);
