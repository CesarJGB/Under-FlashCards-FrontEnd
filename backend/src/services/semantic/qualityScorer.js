// backend/src/services/semantic/qualityScorer.js

/**
 * Módulo de cálculo de QualityScore para v3.2 (Fase A: Shadow Mode).
 * Fórmula multiplicativa: sourceCoverage * atomicity * answerQuality * auditStatus.
 * Devuelve score y breakdown con metadata para telemetría.
 */

/**
 * Normaliza texto eliminando diacríticos y caracteres no alfanuméricos.
 * 
 * Nota: v3.2 usa normalización alfanumérica simple. Fórmulas con subíndices 
 * o símbolos químicos (ej. CO₂, Na+, Ca2+) pueden perder precisión.
 * Podría requerir un parser químico en futuras versiones si el dominio lo exige.
 */
function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Calcula la cobertura léxica de un texto objetivo respecto a una fuente.
 * Abstracción preparada para convivir con calculateSemanticCoverage (embeddings) en v3.3.
 */
function calculateLexicalCoverage(targetText, sourceText) {
  const targetTokens = normalizeText(targetText).split(/\s+/).filter(Boolean);
  if (targetTokens.length === 0) return { score: 0.0, sourceTokenCount: 0, targetTokenCount: 0 };

  const sourceTokens = new Set(normalizeText(sourceText).split(/\s+/).filter(Boolean));
  const backedTokens = targetTokens.filter(token => sourceTokens.has(token)).length;
  
  return {
    score: backedTokens / targetTokens.length,
    sourceTokenCount: sourceTokens.size,
    targetTokenCount: targetTokens.length
  };
}

function calculateSourceCoverageData({ answer, sourceEvidence, segmentText }) {
  const answerTokens = normalizeText(answer).split(/\s+/).filter(Boolean);
  const answerTokenCount = answerTokens.length;

  // Caso no verificable: no existe evidencia ni texto fuente
  if (!sourceEvidence && !segmentText) {
    return {
      score: 0.8,
      isVerified: false,
      sourceTokenCount: 0,
      answerTokenCount
    };
  }

  const source = `${segmentText || ''} ${sourceEvidence || ''}`;
  const coverage = calculateLexicalCoverage(answer, source);

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
    return 0.5; // Lista clínica disfrazada
  }
  if (/\bdiferencia entre\b/.test(normalized) || 
      /\b(?:y|e)\s+(?:cómo|qué|cuál|cuáles|por qué|para qué|tiene|indica|se evita|se calcula)\b/.test(normalized)) {
    return 0.75; // Pregunta compuesta
  }
  
  return 1.0;
}

function calculateAnswerQualityScore(answer) {
  const words = String(answer || '').trim().split(/\s+/).filter(Boolean);
  const len = words.length;
  
  if (len === 0) return 0.0;
  if (len <= 2) return 0.9; // Permite fórmulas y respuestas directas
  if (len <= 40) return 1.0; // Zona óptima
  
  return Math.max(0.6, 1.0 - ((len - 40) * 0.01));
}

function calculateAuditMultiplier(status) {
  if (status === 'fusionada') return 0.8;
  return 1.0; // sin_cambios, corregida, fallback
}

function calculateQualityScore({ question, answer, sourceEvidence, status, segmentText }) {
  const coverageData = calculateSourceCoverageData({ answer, sourceEvidence, segmentText });
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

module.exports = { calculateQualityScore };
