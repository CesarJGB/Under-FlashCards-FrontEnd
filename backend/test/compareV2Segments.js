#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { performance } = require('node:perf_hooks');

const backendDirectory = path.resolve(__dirname, '..');
const fixturesDirectory = '/home/ubuntu/test-fixtures';
const targetCount = 10;
const segmentLength = 15000;

require('dotenv').config({ path: path.join(backendDirectory, '.env') });

const { extractPdfText, findFirstPdf } = require('./benchmarkV2');
const { getMetrics } = require('./comparePedagogy');
const {
  callDeepSeekJson,
  generateAndAuditBatch,
  getMessageContent,
  parseJsonObject,
  validateCards,
} = require('../src/services/aiService');

function createTokenUsage() {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addTokenUsage(total, usage) {
  if (!usage) return;
  for (const key of ['promptTokens', 'completionTokens', 'totalTokens']) {
    if (Number.isFinite(usage[key])) total[key] += usage[key];
  }
}

function getSegments(sourceText) {
  const maximumStart = Math.max(0, sourceText.length - segmentLength);
  const starts = [
    { label: 'inicio', start: 0 },
    { label: 'mitad', start: Math.floor(maximumStart / 2) },
    { label: 'final', start: maximumStart },
  ];

  return starts.map(({ label, start }) => ({
    label,
    start,
    text: sourceText.slice(start, start + segmentLength).trim(),
  }));
}

function getMaxTokens() {
  const parsed = Number.parseInt(process.env.AI_DECK_GENERATION_MAX_TOKENS, 10);
  return Number.isInteger(parsed) ? Math.min(16384, Math.max(512, parsed)) : 4096;
}

function toSampleCard(card) {
  return {
    question: String(card.question).trim(),
    answer: String(card.answer).trim(),
  };
}

function buildLegacySystemPrompt(rawCount) {
  return [
    'Eres un creador de flashcards experto y un auditor académico implacable.',
    `Genera internamente ${rawCount} tarjetas de estudio basadas EXCLUSIVAMENTE en el texto proporcionado y luego audítalas internamente para devolver solo las ${targetCount} mejores.`,
    'REGLAS: una idea por tarjeta, pregunta recuperable y respuesta autocontenida.',
    'PROHIBIDO inventar información. PROHIBIDO usar Markdown.',
    'PROCESO: genera candidatas de más, elimina redundantes o ambiguas, corrige la redacción y devuelve EXACTAMENTE la cantidad solicitada.',
  ].join(' ');
}

async function runLegacy(segment, apiKey, runId) {
  const rawCount = Math.max(targetCount, Math.ceil(targetCount * 1.3));
  const tokenUsage = createTokenUsage();
  let retries = 0;
  const startedAt = performance.now();
  const cards = await callDeepSeekJson({
    apiKey,
    context: {
      runId,
      flow: 'compare-v2-legacy',
      stage: 'deck_generate_audit',
      rawCardCount: rawCount,
      targetCount,
      onRetry: () => {
        retries += 1;
      },
      onUsage: ({ usage }) => addTokenUsage(tokenUsage, usage),
    },
    requestBody: {
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      max_tokens: getMaxTokens(),
      temperature: 0.3,
      messages: [
        { role: 'system', content: buildLegacySystemPrompt(rawCount) },
        {
          role: 'user',
          content: `Texto fuente:\n"""\n${segment}\n"""\n\nDevuelve un JSON válido con esta estructura exacta: {"cards": [{"question": "string", "answer": "string"}]}. El array debe tener exactamente ${targetCount} elementos.`,
        },
      ],
    },
    parseResponse(data) {
      const parsed = parseJsonObject(getMessageContent(data));
      return validateCards(parsed.cards, targetCount, { requireExactCount: true });
    },
  });

  return {
    cards: cards.map(toSampleCard),
    durationMs: performance.now() - startedAt,
    tokenUsage,
    retries,
  };
}

async function runCurrent(segment, apiKey, runId) {
  const tokenUsage = createTokenUsage();
  let retries = 0;
  const startedAt = performance.now();
  const cards = await generateAndAuditBatch(segment, targetCount, apiKey, {
    runId,
    flow: 'compare-v2-current',
    onRetry: () => {
      retries += 1;
    },
    onUsage: ({ usage }) => addTokenUsage(tokenUsage, usage),
  });

  return {
    cards: cards.map(toSampleCard),
    durationMs: performance.now() - startedAt,
    tokenUsage,
    retries,
  };
}

function serializeRun(run) {
  return {
    cards: run.cards,
    metrics: getMetrics({ cards: run.cards }),
    durationSeconds: run.durationMs / 1000,
    tokenUsage: run.tokenUsage,
    retries: run.retries,
  };
}

function printSummary(results) {
  console.log('\n[compare-v2-segments] Resumen:');
  console.log('| Segmento | Versión | Tiempo (s) | Retries | Tokens | Palabras/respuesta | Preguntas con conjunción | "etc." |');
  console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const result of results) {
    const metrics = result.metrics;
    console.log(
      `| ${result.label} | ${result.version} | ${result.durationSeconds.toFixed(3)} | ${result.retries} | `
        + `${Math.round(result.tokenUsage.totalTokens).toLocaleString('es-MX')} | `
        + `${metrics.averageAnswerWords.toFixed(1)} | `
        + `${metrics.questionsWithIndependentConjunction} | ${metrics.answersWithEtc} |`
    );
  }
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error('Falta DEEPSEEK_API_KEY en el entorno o en backend/.env.');

  const pdfPath = findFirstPdf(fixturesDirectory);
  const sourceText = await extractPdfText(pdfPath);
  const segments = getSegments(sourceText);
  const output = {
    pdf: path.basename(pdfPath),
    segmentLength,
    targetCount,
    segments: [],
  };
  const summary = [];

  console.log(`[compare-v2-segments] PDF: ${pdfPath}`);
  console.log(`[compare-v2-segments] Texto total: ${sourceText.length.toLocaleString('es-MX')} caracteres`);
  console.log('[compare-v2-segments] Ejecutando V2 legacy y V2 mejorada en inicio, mitad y final...');

  for (const segment of segments) {
    console.log(`\n[compare-v2-segments] Segmento ${segment.label} (offset ${segment.start})`);
    const legacy = await runLegacy(segment.text, apiKey, `compare-legacy-${segment.label}`);
    const current = await runCurrent(segment.text, apiKey, `compare-current-${segment.label}`);
    const legacySerialized = serializeRun(legacy);
    const currentSerialized = serializeRun(current);

    output.segments.push({
      label: segment.label,
      start: segment.start,
      characters: segment.text.length,
      legacy: legacySerialized,
      current: currentSerialized,
    });
    summary.push(
      { label: segment.label, version: 'Legacy', ...legacySerialized },
      { label: segment.label, version: 'Mejorada', ...currentSerialized }
    );
    console.log(
      `[compare-v2-segments] Legacy ${legacySerialized.durationSeconds.toFixed(3)} s / `
        + `${Math.round(legacySerialized.tokenUsage.totalTokens).toLocaleString('es-MX')} tokens`
    );
    console.log(
      `[compare-v2-segments] Mejorada ${currentSerialized.durationSeconds.toFixed(3)} s / `
        + `${Math.round(currentSerialized.tokenUsage.totalTokens).toLocaleString('es-MX')} tokens`
    );
  }

  fs.writeFileSync(
    path.join(__dirname, 'comparison_v2_segments.json'),
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8'
  );
  printSummary(summary);
  console.log('\n[compare-v2-segments] Guardado: backend/test/comparison_v2_segments.json');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[compare-v2-segments] ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildLegacySystemPrompt,
  getSegments,
  main,
  runCurrent,
  runLegacy,
};
