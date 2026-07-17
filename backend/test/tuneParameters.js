#!/usr/bin/env node

const path = require('path');
const { performance } = require('node:perf_hooks');

const backendDirectory = path.resolve(__dirname, '..');
const fixturesDirectory = '/home/ubuntu/test-fixtures';
const targetCardCount = 100;
const testConfigurations = [
  { test: 1, concurrency: 6, batchSize: 10 },
  { test: 2, concurrency: 8, batchSize: 10 },
  { test: 3, concurrency: 6, batchSize: 15 },
  { test: 4, concurrency: 8, batchSize: 12 },
];
const defaultSleepSeconds = 60;

require('dotenv').config({ path: path.join(backendDirectory, '.env') });

const { extractPdfText, findFirstPdf } = require('./benchmarkV2');
const {
  generateAndAuditBatch,
} = require('../src/services/aiService');
const { buildGenerationBatches, calculateTargetPadding } = require('../src/utils/aiSourceChunks');
const { mapWithConcurrency } = require('../src/utils/concurrency');

function readBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
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

function getTotalTokens(usage) {
  if (usage.totalTokens > 0) return usage.totalTokens;
  const promptAndCompletion = usage.promptTokens + usage.completionTokens;
  return promptAndCompletion > 0 ? promptAndCompletion : null;
}

function normalizeCardKey(card) {
  return `${String(card.question).trim().replace(/\s+/g, ' ').toLocaleLowerCase()}\n${String(card.answer).trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`;
}

function readSleepSeconds() {
  const value = Number.parseInt(process.env.TUNE_SLEEP_SECONDS || defaultSleepSeconds, 10);
  return Number.isInteger(value) && value >= 0 ? value : defaultSleepSeconds;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function buildSourcePlan(sourceText, batchSize) {
  const configuredPaddingFactor = Number.parseFloat(process.env.AI_TARGET_PADDING_FACTOR);
  const paddingPlan = calculateTargetPadding(targetCardCount, batchSize, {
    factor: Number.isFinite(configuredPaddingFactor) ? configuredPaddingFactor : 0.30,
    maximum: readBoundedInteger(process.env.AI_TARGET_PADDING_MAX, 20, 0, 500),
    perBatch: readBoundedInteger(process.env.AI_TARGET_PADDING_PER_BATCH, 0, 0, 10),
  });
  const requestedPhase1Target = targetCardCount + paddingPlan.padding;
  const sourceChunkMaxLength = readBoundedInteger(
    process.env.AI_SOURCE_CHUNK_MAX_CHARS,
    60000,
    8000,
    60000
  );
  const sourcePlan = buildGenerationBatches(
    sourceText,
    requestedPhase1Target,
    batchSize,
    sourceChunkMaxLength
  );
  return { paddingPlan, requestedPhase1Target, sourcePlan };
}

function isRateLimitError(error) {
  return error?.status === 429 || error?.code === 'rate_limit';
}

function isTimeoutError(error) {
  return error?.code === 'timeout' || error?.name === 'TimeoutError' || error?.name === 'AbortError';
}

async function runConfiguration(sourceText, configuration) {
  // These are set for parity with the production configuration names. The
  // direct harness passes the values explicitly because the controller clamps
  // its current concurrency constant to four at module load time.
  process.env.AI_DECK_CONCURRENCY = String(configuration.concurrency);
  process.env.AI_DECK_BATCH_SIZE = String(configuration.batchSize);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  const { paddingPlan, requestedPhase1Target, sourcePlan } = buildSourcePlan(
    sourceText,
    configuration.batchSize
  );
  const startedAt = performance.now();
  const observedProviderEvents = { rateLimit: false, timeout: false };
  const batchResults = await mapWithConcurrency(
    sourcePlan.batches,
    configuration.concurrency,
    async (batch) => {
      const usage = createTokenUsage();
      try {
        const cards = await generateAndAuditBatch(
          batch.sourceChunk,
          batch.targetCount,
          apiKey,
          {
            runId: `tune-${configuration.test}`,
            flow: 'tune-v2',
            batch: batch.number,
            totalBatches: sourcePlan.batches.length,
            sourceChunk: batch.sourceChunkIndex,
            onRetry: ({ error }) => {
              observedProviderEvents.rateLimit ||= isRateLimitError(error);
              observedProviderEvents.timeout ||= isTimeoutError(error);
            },
            onUsage: ({ usage: requestUsage }) => addTokenUsage(usage, requestUsage),
          }
        );
        return { batch, cards, usage, error: null };
      } catch (error) {
        return { batch, cards: [], usage, error };
      }
    }
  );
  const durationMs = performance.now() - startedAt;
  const uniqueCards = [];
  const seenCards = new Set();
  const errors = [];
  const totalUsage = createTokenUsage();

  for (const result of batchResults) {
    addTokenUsage(totalUsage, result.usage);
    if (result.error) {
      errors.push(result.error);
      continue;
    }
    for (const card of result.cards) {
      const key = normalizeCardKey(card);
      if (seenCards.has(key)) continue;
      seenCards.add(key);
      uniqueCards.push(card);
    }
  }

  const rateLimit = observedProviderEvents.rateLimit || errors.some(isRateLimitError);
  const timeout = observedProviderEvents.timeout || errors.some(isTimeoutError);
  return {
    ...configuration,
    durationMs,
    durationSeconds: durationMs / 1000,
    tokens: getTotalTokens(totalUsage),
    rateLimit,
    timeout,
    reachedTarget: uniqueCards.length >= targetCardCount,
    acceptedCards: Math.min(uniqueCards.length, targetCardCount),
    uniqueCards: uniqueCards.length,
    errors: errors.length,
    completedBatches: batchResults.filter((result) => !result.error).length,
    totalBatches: sourcePlan.batches.length,
    candidateTarget: sourcePlan.candidateTarget,
    requestedPhase1Target,
    padding: paddingPlan.padding,
    errorDetails: errors.map((error) => ({
      code: error.code || error.name || 'unknown',
      status: error.status || null,
      message: error.message,
    })),
  };
}

function formatNumber(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('es-MX') : 'N/D';
}

function formatSeconds(value) {
  return Number.isFinite(value) ? value.toFixed(3) : 'N/D';
}

function formatBoolean(value) {
  return value ? 'Sí' : 'No';
}

function printResults(results) {
  console.log('\n[tune-parameters] Tabla comparativa:');
  console.log('| Test | Concurrencia | Lote | Tiempo (s) | Tokens | 429 | Timeout | 100 tarjetas | Aceptadas | Errores |');
  console.log('| ---: | ---: | ---: | ---: | ---: | :---: | :---: | :---: | ---: | ---: |');
  for (const result of results) {
    console.log(
      `| ${result.test} | ${result.concurrency} | ${result.batchSize} | `
        + `${formatSeconds(result.durationSeconds)} | ${formatNumber(result.tokens)} | `
        + `${formatBoolean(result.rateLimit)} | ${formatBoolean(result.timeout)} | `
        + `${formatBoolean(result.reachedTarget)} | ${result.acceptedCards} | ${result.errors} |`
    );
  }

  const eligible = results
    .filter((result) => result.reachedTarget && !result.rateLimit && !result.timeout && result.errors === 0)
    .sort((first, second) => first.durationMs - second.durationMs);
  if (eligible.length > 0) {
    const best = eligible[0];
    console.log(
      `\n[tune-parameters] Mejor configuración sin 429/timeouts: `
        + `AI_DECK_CONCURRENCY=${best.concurrency}, AI_DECK_BATCH_SIZE=${best.batchSize} `
        + `(${formatSeconds(best.durationSeconds)} s).`
    );
  } else {
    console.log('\n[tune-parameters] Ninguna configuración cumplió simultáneamente todos los criterios.');
  }
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Falta DEEPSEEK_API_KEY en el entorno o en backend/.env.');
  }

  const pdfPath = findFirstPdf(fixturesDirectory);
  const sourceText = await extractPdfText(pdfPath);
  const sleepSeconds = readSleepSeconds();
  console.log(`[tune-parameters] PDF: ${pdfPath}`);
  console.log(`[tune-parameters] Texto: ${sourceText.length.toLocaleString('es-MX')} caracteres`);
  console.log(`[tune-parameters] Objetivo: ${targetCardCount} tarjetas con V2`);
  console.log(`[tune-parameters] Pausa entre tests: ${sleepSeconds} segundos`);
  console.log('[tune-parameters] El harness usa DEEPSEEK_API_KEY directamente; no crea datos en MongoDB.');

  const results = [];
  for (let index = 0; index < testConfigurations.length; index += 1) {
    const configuration = testConfigurations[index];
    console.log(
      `\n[tune-parameters] Test ${configuration.test}/4: `
        + `concurrency=${configuration.concurrency}, batchSize=${configuration.batchSize}`
    );
    const result = await runConfiguration(sourceText, configuration);
    results.push(result);
    console.log(
      `[tune-parameters] ${formatSeconds(result.durationSeconds)} s | `
        + `${formatNumber(result.tokens)} tokens | `
        + `${result.completedBatches}/${result.totalBatches} lotes | `
        + `${result.uniqueCards} tarjetas únicas | `
        + `429=${formatBoolean(result.rateLimit)} | timeout=${formatBoolean(result.timeout)}`
    );
    if (index < testConfigurations.length - 1 && sleepSeconds > 0) {
      console.log(`[tune-parameters] Esperando ${sleepSeconds} segundos antes del siguiente test...`);
      await sleep(sleepSeconds * 1000);
    }
  }

  printResults(results);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[tune-parameters] ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildSourcePlan,
  isRateLimitError,
  isTimeoutError,
  main,
  runConfiguration,
};
