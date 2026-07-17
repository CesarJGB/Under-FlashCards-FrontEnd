#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { performance } = require('node:perf_hooks');

const backendDirectory = path.resolve(__dirname, '..');
const fixturesDirectory = '/home/ubuntu/test-fixtures';
const sampleCharacterLimit = 15000;
const sampleCardCount = 10;

require('dotenv').config({ path: path.join(backendDirectory, '.env') });

const { extractPdfText, findFirstPdf } = require('./benchmarkV2');
const {
  criticizeAndRefineCards,
  generateAndAuditBatch,
  generateRawCards,
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

function createUsageContext(runId, tokenUsage) {
  return {
    runId,
    onUsage: ({ usage }) => addTokenUsage(tokenUsage, usage),
  };
}

function toSampleCard(card) {
  return {
    question: String(card.question).trim(),
    answer: String(card.answer).trim(),
  };
}

function getAcceptedV1Cards(auditedCards) {
  return auditedCards
    .filter((card) => ['sin_cambios', 'corregida'].includes(card.status))
    .filter((card) => card.question?.trim() && card.answer?.trim())
    .map(toSampleCard);
}

function countStatuses(cards) {
  return cards.reduce((counts, card) => {
    counts[card.status] = (counts[card.status] || 0) + 1;
    return counts;
  }, {});
}

function writeSample(fileName, sample) {
  const filePath = path.join(__dirname, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
  return filePath;
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Falta DEEPSEEK_API_KEY en el entorno o en backend/.env.');
  }

  const pdfPath = findFirstPdf(fixturesDirectory);
  const sourceText = await extractPdfText(pdfPath);
  const sourceSegment = sourceText.slice(0, sampleCharacterLimit).trim();
  if (!sourceSegment) throw new Error('El segmento seleccionado del PDF está vacío.');

  console.log(`[extract-samples] PDF: ${pdfPath}`);
  console.log(`[extract-samples] Segmento: ${sourceSegment.length.toLocaleString('es-MX')} caracteres`);
  console.log(`[extract-samples] Solicitando ${sampleCardCount} tarjetas por pipeline...`);

  const v1TokenUsage = createTokenUsage();
  const v1StartedAt = performance.now();
  const v1Context = createUsageContext('sample-v1', v1TokenUsage);
  const rawCards = await generateRawCards(
    sourceSegment,
    sampleCardCount,
    apiKey,
    { ...v1Context, flow: 'sample-v1' }
  );
  const auditedCards = await criticizeAndRefineCards(
    sourceSegment,
    rawCards,
    apiKey,
    { ...v1Context, flow: 'sample-v1' }
  );
  const v1Cards = getAcceptedV1Cards(auditedCards);
  const v1DurationMs = performance.now() - v1StartedAt;
  const v1Sample = {
    pipeline: 'v1',
    requestedCount: sampleCardCount,
    cards: v1Cards,
    audit: {
      generatedCount: rawCards.length,
      auditedCount: auditedCards.length,
      acceptedCount: v1Cards.length,
      statuses: countStatuses(auditedCards),
    },
    source: {
      pdf: path.basename(pdfPath),
      segmentCharacters: sourceSegment.length,
    },
  };
  const v1Path = writeSample('sample_v1.json', v1Sample);
  console.log(
    `[extract-samples] V1: ${v1Cards.length} tarjetas aceptadas | `
      + `${(v1DurationMs / 1000).toFixed(3)} s | `
      + `${Math.round(v1TokenUsage.totalTokens).toLocaleString('es-MX')} tokens`
  );

  const v2TokenUsage = createTokenUsage();
  const v2StartedAt = performance.now();
  const v2Cards = await generateAndAuditBatch(
    sourceSegment,
    sampleCardCount,
    apiKey,
    { ...createUsageContext('sample-v2', v2TokenUsage), flow: 'sample-v2' }
  );
  const v2DurationMs = performance.now() - v2StartedAt;
  const v2Sample = {
    pipeline: 'v2',
    requestedCount: sampleCardCount,
    cards: v2Cards.map(toSampleCard),
    source: {
      pdf: path.basename(pdfPath),
      segmentCharacters: sourceSegment.length,
    },
  };
  const v2Path = writeSample('sample_v2.json', v2Sample);
  console.log(
    `[extract-samples] V2: ${v2Cards.length} tarjetas | `
      + `${(v2DurationMs / 1000).toFixed(3)} s | `
      + `${Math.round(v2TokenUsage.totalTokens).toLocaleString('es-MX')} tokens`
  );
  console.log(`[extract-samples] Guardado: ${v1Path}`);
  console.log(`[extract-samples] Guardado: ${v2Path}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[extract-samples] ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  addTokenUsage,
  createTokenUsage,
  getAcceptedV1Cards,
  main,
};
