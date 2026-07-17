#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readSample(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe ${filePath}.`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function wordCount(value) {
  return String(value).trim().split(/\s+/).filter(Boolean).length;
}

function getMetrics(sample) {
  const cards = Array.isArray(sample.cards) ? sample.cards : [];
  const answers = cards.map((card) => card.answer || '');
  const questions = cards.map((card) => card.question || '');
  const answerWordCounts = answers.map(wordCount);

  return {
    cards: cards.length,
    averageAnswerWords: answerWordCounts.length > 0
      ? answerWordCounts.reduce((total, count) => total + count, 0) / answerWordCounts.length
      : 0,
    answersOver40Words: answerWordCounts.filter((count) => count > 40).length,
    questionsWithIndependentConjunction: questions.filter((question) => /\s(?:y|e)\s/i.test(question)).length,
    questionsWithMultipleItems: questions.filter((question) => /,|\s(?:y|e)\s/i.test(question)).length,
    answersWithEtc: answers.filter((answer) => /\betc\.?/i.test(answer)).length,
    answersWithMultipleClauses: answers.filter((answer) => /[;:]|\s(?:y|e)\s/i.test(answer)).length,
  };
}

function formatMetric(value, digits = 0) {
  return Number(value).toFixed(digits);
}

function printComparison(before, after) {
  const rows = [
    ['Tarjetas', before.cards, after.cards, after.cards - before.cards],
    ['Palabras promedio por respuesta', before.averageAnswerWords, after.averageAnswerWords, after.averageAnswerWords - before.averageAnswerWords],
    ['Respuestas de más de 40 palabras', before.answersOver40Words, after.answersOver40Words, after.answersOver40Words - before.answersOver40Words],
    ['Preguntas con conjunción independiente', before.questionsWithIndependentConjunction, after.questionsWithIndependentConjunction, after.questionsWithIndependentConjunction - before.questionsWithIndependentConjunction],
    ['Preguntas con varios elementos', before.questionsWithMultipleItems, after.questionsWithMultipleItems, after.questionsWithMultipleItems - before.questionsWithMultipleItems],
    ['Respuestas con "etc."', before.answersWithEtc, after.answersWithEtc, after.answersWithEtc - before.answersWithEtc],
    ['Respuestas con varias cláusulas', before.answersWithMultipleClauses, after.answersWithMultipleClauses, after.answersWithMultipleClauses - before.answersWithMultipleClauses],
  ];

  console.log('| Métrica | Antes | Después | Cambio |');
  console.log('| --- | ---: | ---: | ---: |');
  for (const [label, beforeValue, afterValue, change] of rows) {
    const digits = label === 'Palabras promedio por respuesta' ? 1 : 0;
    console.log(`| ${label} | ${formatMetric(beforeValue, digits)} | ${formatMetric(afterValue, digits)} | ${change > 0 ? '+' : ''}${formatMetric(change, digits)} |`);
  }
}

function main() {
  const before = getMetrics(readSample('sample_v2_before.json'));
  const after = getMetrics(readSample('sample_v2.json'));
  console.log('[compare-pedagogy] V2 antes vs. V2 después:');
  printComparison(before, after);
  console.log('');
  if (after.averageAnswerWords < before.averageAnswerWords
    && after.questionsWithIndependentConjunction < before.questionsWithIndependentConjunction) {
    console.log('[compare-pedagogy] Señal positiva: menor densidad y mayor atomicidad heurística.');
  } else {
    console.log('[compare-pedagogy] La comparación heurística no confirma una mejora en ambos indicadores.');
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[compare-pedagogy] ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { getMetrics, main };
