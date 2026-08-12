import fs from 'node:fs';

const [payloadPath, gridPath, memoryPath, productionGridPath, outputPath = '/tmp/raw-results.json'] = process.argv.slice(2);
if (!payloadPath || !gridPath || !memoryPath || !productionGridPath) {
  throw new Error('Usage: node compose-results.mjs <payload.json> <grid.json> <memory.json> <production-grid.json> [output.json]');
}

const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const grid = JSON.parse(fs.readFileSync(gridPath, 'utf8'));
const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
const productionGrid = JSON.parse(fs.readFileSync(productionGridPath, 'utf8'));

function scalar(value, unit, evidence = 'MEASURED') {
  return { unit, evidence, values: [value], median: value, min: value, max: value };
}

function measured(summary, unit, evidence = 'MEASURED') {
  if (!summary) return null;
  return { unit, evidence, values: summary.values, median: summary.median, min: summary.min, max: summary.max };
}

const results = [];

for (const row of payload.profiles) {
  results.push({
    scenario: `profile-${row.profile}`, area: 'image-profile', status: row.status,
    evidence: row.evidence, repetitions: 1,
    configuration: { profile: row.profile, dimensions: row.representedDimensions },
    metrics: {
      binaryBytes: scalar(row.binaryBytes, 'bytes'),
      base64Characters: scalar(row.base64Characters, 'characters'),
      dataUrlUtf8Bytes: scalar(row.dataUrlUtf8Bytes, 'bytes'),
      jsonUtf8Bytes: scalar(row.jsonUtf8Bytes, 'bytes'),
      gzipJsonBytes: scalar(row.gzipJsonBytes, 'bytes'),
      base64ToBinaryRatio: scalar(row.base64ToBinaryRatio, 'ratio'),
      decodedRgbaBytes: scalar(row.estimatedDecodedRgbaBytes, 'bytes', 'ESTIMATED')
    },
    limitation: row.decodedMemoryFormula
  });
}

for (const row of payload.cardResponses) {
  results.push({
    scenario: row.scenarioId, area: 'flashcard-response', status: row.status,
    evidence: row.evidence, repetitions: 1,
    configuration: { cardCount: row.cardCount, imageScenario: row.imageScenario, endpoint: row.endpoint },
    metrics: {
      jsonUtf8Bytes: scalar(row.jsonUtf8Bytes, 'bytes', 'MODELED'),
      gzipBytes: scalar(row.gzipBytes, 'bytes', 'MODELED'),
      imageUtf8Bytes: scalar(row.imageUtf8Bytes, 'bytes', 'MODELED'),
      uniqueImageUtf8Bytes: scalar(row.uniqueImageUtf8Bytes, 'bytes', 'MODELED'),
      repeatedBackgroundBytes: scalar(row.repeatedBackgroundBytes, 'bytes', 'MODELED'),
      duplicatePercentOfJson: scalar(row.duplicatePercentOfJson, 'percent', 'MODELED'),
      logicalBackgroundCopies: scalar(row.logicalBackgroundCopies, 'count', 'MODELED'),
      approximateBytesPer100Cards: scalar(row.approximateBytesPer100Cards, 'bytes', 'MODELED')
    },
    limitation: row.limitation
  });
}

for (const row of payload.deckResponses) {
  results.push({
    scenario: row.scenarioId, area: 'deck-response-and-json', status: row.status,
    evidence: row.evidence, repetitions: row.repetitions,
    configuration: { deckCount: row.deckCount, imageScenario: row.imageScenario, endpoint: row.endpoint },
    metrics: {
      jsonUtf8Bytes: scalar(row.jsonUtf8Bytes, 'bytes'),
      jsonCharacters: scalar(row.jsonCharacters, 'characters'),
      gzipBytes: scalar(row.gzipBytes, 'bytes'),
      coverImageUtf8Bytes: scalar(row.coverImageUtf8Bytes, 'bytes'),
      cardBackgroundUtf8Bytes: scalar(row.cardBackgroundUtf8Bytes, 'bytes'),
      stringifyMs: measured(row.stringifyMs, 'ms'),
      parseMs: measured(row.parseMs, 'ms')
    },
    limitation: row.limitation
  });
}

for (const row of payload.bson) {
  results.push({
    scenario: row.scenarioId, area: 'bson', status: row.status, evidence: row.evidence,
    repetitions: 1, configuration: { profile: row.profile, backgroundCount: row.backgroundCount },
    metrics: {
      bsonBytes: scalar(row.bsonBytes, 'bytes'),
      logicalImageUtf8Bytes: scalar(row.logicalImageUtf8Bytes, 'bytes')
    },
    limitation: row.limitation
  });
}

for (const row of payload.indexOf) {
  results.push({
    scenario: row.scenarioId, area: 'background-indexof', status: row.status, evidence: row.evidence,
    repetitions: row.repetitions,
    configuration: { profile: row.profile, backgroundCount: row.backgroundCount, lookup: row.lookup, iterationsPerRepetition: row.iterationsPerRepetition },
    metrics: { durationPerLookupMs: measured(row.durationPerLookupMs, 'ms') },
    limitation: row.limitation
  });
}

const gridMetricUnits = {
  readyWallMs: 'ms', harnessMountMs: 'ms', reactActualDurationMs: 'ms', reactBaseDurationMs: 'ms',
  decodeTotalMs: 'ms', decodeCount: 'count', decodeErrors: 'count', hover20TransitionsMs: 'ms',
  scrollRoundTripMs: 'ms', menuOpenCloseMs: 'ms', previewOpenCloseMs: 'ms', domNodes: 'count',
  articleCount: 'count', imageElementCount: 'count', dataUrlStyleCount: 'count', blobStyleCount: 'count',
  longTaskCount: 'count', longTaskTotalMs: 'ms', usedJSHeapSize: 'bytes', usedJSHeapAfterClose: 'bytes', scrollHeight: 'css-px'
};

for (const row of [...grid.core, ...grid.isolatedControls]) {
  results.push({
    scenario: row.scenarioId, area: 'real-flashcard-grid', status: row.status, evidence: row.evidence,
    repetitions: row.repetitionsCompleted, configuration: { browser: row.browser, kind: row.kind, ...row.configuration },
    metrics: Object.fromEntries(Object.entries(row.aggregate).map(([key, value]) => [key, measured(value, gridMetricUnits[key] || 'unknown')])),
    limitation: row.limitation,
    error: row.error
  });
}

for (const row of grid.chromiumTraceAttribution) {
  const metrics = {};
  for (const [name, value] of Object.entries(row.aggregate)) {
    metrics[`${name}.count`] = measured(value.count, 'count');
    metrics[`${name}.durationMs`] = measured(value.durationMs, 'ms');
  }
  results.push({
    scenario: row.scenarioId, area: 'chromium-cdp-trace', status: row.status, evidence: row.evidence,
    repetitions: row.repetitions, configuration: { variant: row.variant, count: 500, scenario: 'shared_large' },
    metrics, limitation: row.limitation
  });
}

for (const row of [...productionGrid.core, ...productionGrid.isolatedControls]) {
  results.push({
    scenario: `production-${row.scenarioId}`, area: 'real-flashcard-grid-production', status: row.status, evidence: row.evidence,
    repetitions: row.repetitionsCompleted, configuration: { browser: row.browser, buildMode: 'production', kind: row.kind, ...row.configuration },
    metrics: Object.fromEntries(Object.entries(row.aggregate).map(([key, value]) => [key, measured(value, gridMetricUnits[key] || 'unknown')])),
    limitation: `${row.limitation} React Profiler no emite commits en el build de producción; readyWallMs incluye navegación local y espera del harness.`,
    error: row.error
  });
}

for (const row of productionGrid.chromiumTraceAttribution) {
  const metrics = {};
  for (const [name, value] of Object.entries(row.aggregate)) {
    metrics[`${name}.count`] = measured(value.count, 'count');
    metrics[`${name}.durationMs`] = measured(value.durationMs, 'ms');
  }
  results.push({
    scenario: `production-${row.scenarioId}`, area: 'chromium-cdp-trace-production', status: row.status, evidence: row.evidence,
    repetitions: row.repetitions, configuration: { buildMode: 'production', variant: row.variant, count: 500, scenario: 'shared_large' },
    metrics, limitation: row.limitation
  });
}

for (const row of grid.localStorage) {
  results.push({
    scenario: row.scenarioId, area: 'local-storage', status: row.status, evidence: row.evidence,
    repetitions: row.repetitionsCompleted,
    configuration: { browser: row.browser, characters: row.characters },
    metrics: row.setItemMs ? { setItemMs: measured(row.setItemMs, 'ms') } : {},
    limitation: row.limitation, error: row.error
  });
}

for (const row of memory.results) {
  results.push({
    scenario: row.scenarioId, area: 'chromium-memory-after-gc', status: row.status, evidence: row.evidence,
    repetitions: row.repetitionsCompleted, configuration: row.configuration,
    metrics: Object.fromEntries(Object.entries(row.aggregate).map(([key, value]) => [key, measured(value, key === 'domNodes' || key === 'articleCount' ? 'count' : 'bytes')])),
    limitation: row.limitation, error: row.error
  });
}

for (const row of grid.browserAvailability) {
  results.push({
    scenario: `browser-${row.browser}`, area: 'environment', status: row.status,
    evidence: row.status === 'PASS' ? 'MEASURED' : 'BLOCKED', repetitions: 1,
    configuration: { browser: row.browser, version: row.version || null }, metrics: {},
    limitation: row.error || null
  });
}

results.push(
  {
    scenario: 'representative-database', area: 'mongodb', status: 'BLOCKED', evidence: 'BLOCKED', repetitions: 0,
    configuration: {}, metrics: {}, limitation: 'BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE. No explain(), profiler or database latency was executed.'
  },
  {
    scenario: 'physical-iphone-safari', area: 'device', status: 'PENDING — DEVICE REQUIRED', evidence: 'PENDING — DEVICE REQUIRED', repetitions: 0,
    configuration: { target: 'iPhone 16 Pro Max / Safari físico' }, metrics: {}, limitation: grid.physicalDevice.limitation
  },
  {
    scenario: 'composite-layers', area: 'chromium-cdp-trace', status: 'BLOCKED', evidence: 'BLOCKED', repetitions: 5,
    configuration: { browser: 'chromium', trace: 'devtools.timeline,blink,cc' }, metrics: {},
    limitation: 'CompositeLayers no apareció en los eventos X de las trazas; no se inventa tiempo de composición.'
  },
  {
    scenario: 'fps-and-dropped-frames', area: 'grid', status: 'NOT RUN', evidence: 'BLOCKED', repetitions: 0,
    configuration: {}, metrics: {}, limitation: 'El harness no dispuso de una métrica directa fiable de FPS/frames perdidos; no se deriva desde rAF.'
  }
);

const statusCounts = results.reduce((counts, row) => {
  counts[row.status] = (counts[row.status] || 0) + 1;
  return counts;
}, {});

const output = {
  schemaVersion: '1.0.0',
  commit: payload.commit,
  generatedAt: new Date().toISOString(),
  evidenceClasses: ['MEASURED', 'STATICALLY CONFIRMED', 'MODELED', 'ESTIMATED', 'BLOCKED', 'PENDING — DEVICE REQUIRED'],
  environment: {
    payload: payload.environment,
    grid: grid.environment,
    productionGrid: productionGrid.environment,
    memory: memory.environment,
    browserAvailability: grid.browserAvailability
  },
  statusCounts,
  staticContracts: payload.createCardOperations,
  results
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, resultCount: results.length, statusCounts }));
