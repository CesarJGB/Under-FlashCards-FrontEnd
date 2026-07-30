// backend/src/services/semantic/qualityScorer-v1.js

/**
 * Módulo de cálculo de QualityScore para v3.2 (Fase A: Shadow Mode).
 * Fórmula multiplicativa: sourceCoverage * atomicity * answerQuality * auditStatus.
 * Devuelve score y breakdown con metadata para telemetría.
 */

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean);
}

/**
 * Crea el contexto léxico reutilizable de un segmento.
 * El Set se mantiene inmutable durante el cálculo de cada tarjeta.
 */
function createLexicalContext(segmentText) {
  return new Set(tokenize(segmentText));
}

function calculateLexicalCoverage(targetText, sourceText) {
  const targetTokens = tokenize(targetText);
  if (targetTokens.length === 0) {
    return { score: 0.0, sourceTokenCount: 0, targetTokenCount: 0 };
  }

  const sourceTokens = new Set(tokenize(sourceText));
  const backedTokens = targetTokens.filter(token => sourceTokens.has(token)).length;

  return {
    score: backedTokens / targetTokens.length,
    sourceTokenCount: sourceTokens.size,
    targetTokenCount: targetTokens.length
  };
}

function calculateCoverageFromTokenSets(answerTokens, sourceTokens) {
  if (answerTokens.length === 0) {
    return { score: 0.0, sourceTokenCount: 0, targetTokenCount: 0 };
  }

  const backedTokens = answerTokens.filter(token => sourceTokens.has(token)).length;
  return {
    score: backedTokens / answerTokens.length,
    sourceTokenCount: sourceTokens.size,
    targetTokenCount: answerTokens.length
  };
}

function calculateSourceCoverageData({
  answer,
  sourceEvidence,
  segmentText,
  lexicalContext
}) {
  const answerTokens = tokenize(answer);
  const answerTokenCount = answerTokens.length;
  const hasLexicalContext = lexicalContext instanceof Set;
  const hasContextTokens = hasLexicalContext && lexicalContext.size > 0;

  // Un Set vacío no representa una fuente verificable.
  if (!sourceEvidence && !segmentText && !hasContextTokens) {
    return {
      score: 0.8,
      isVerified: false,
      sourceTokenCount: 0,
      answerTokenCount
    };
  }

  // Sin contexto reutilizable, conserva la ruta original.
  // Si el contexto está vacío pero existe segmentText, se reconstruye para
  // evitar que un contexto inconsistente cambie la puntuación.
  if (!hasLexicalContext || (lexicalContext.size === 0 && segmentText)) {
    const source = String(segmentText || '') + ' ' + String(sourceEvidence || '');
    const coverage = calculateLexicalCoverage(answer, source);
    return {
      score: coverage.score,
      isVerified: true,
      sourceTokenCount: coverage.sourceTokenCount,
      answerTokenCount: coverage.targetTokenCount
    };
  }

  // Copia defensiva: sourceEvidence no contamina el Set compartido.
  const sourceTokens = new Set(lexicalContext);
  for (const token of tokenize(sourceEvidence)) {
    sourceTokens.add(token);
  }

  const coverage = calculateCoverageFromTokenSets(answerTokens, sourceTokens);
  return {
    score: coverage.score,
    isVerified: true,
    sourceTokenCount: coverage.sourceTokenCount,
    answerTokenCount: coverage.targetTokenCount
  };
}

function calculateAtomicityScore(question) {
  const normalized = String(question || '').toLowerCase();

  if (/(?:tratamiento|profilaxis|indicación).*(?:,|\s(?:y|e)\s)/.test(normalized)) {
    return 0.5;
  }
  if (/\bdiferencia entre\b/.test(normalized) ||
      /\b(?:y|e)\s+(?:cómo|qué|cuál|cuáles|por qué|para qué|tiene|indica|se evita|se calcula)\b/.test(normalized)) {
    return 0.75;
  }

  return 1.0;
}

function calculateAnswerQualityScore(answer) {
  const words = String(answer || '').trim().split(/\s+/).filter(Boolean);
  const len = words.length;

  if (len === 0) return 0.0;
  if (len <= 2) return 0.9;
  if (len <= 40) return 1.0;

  return Math.max(0.6, 1.0 - ((len - 40) * 0.01));
}

function calculateAuditMultiplier(status) {
  if (status === 'fusionada') return 0.8;
  return 1.0;
}

function calculateQualityScore({
  question,
  answer,
  sourceEvidence,
  status,
  segmentText,
  lexicalContext
}) {
  const coverageData = calculateSourceCoverageData({
    answer,
    sourceEvidence,
    segmentText,
    lexicalContext
  });
  const atomicityScore = calculateAtomicityScore(question);
  const answerQualityScore = calculateAnswerQualityScore(answer);
  const auditScore = calculateAuditMultiplier(status);

  const qualityScore = coverageData.score * atomicityScore * answerQualityScore * auditScore;

  return {
    qualityScore: Number(qualityScore.toFixed(4)),
    breakdown: {
      sourceCoverageScore: Number(coverageData.score.toFixed(4)),
      coverageVerified: coverageData.isVerified,
      sourceTokenCount: coverageData.sourceTokenCount,
      answerTokenCount: coverageData.answerTokenCount,
      atomicityScore,
      answerQualityScore: Number(answerQualityScore.toFixed(4)),
      auditScore
    }
  };
}

module.exports = {
  calculateQualityScore,
  createLexicalContext
};
