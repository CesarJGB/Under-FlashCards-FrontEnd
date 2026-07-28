// backend/src/services/semantic/qualityScorer.js

/**
 * Módulo de cálculo de QualityScore para v3.2 (Fase A: Shadow Mode).
 * Fórmula multiplicativa: sourceCoverage * atomicity * answerQuality * auditStatus.
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
 * Calcula el solapamiento de tokens.
 * Abstracción preparada para migrar a similitud por embeddings en v3.3.
 */
function calculateTokenOverlap(targetText, sourceText) {
  const targetTokens = normalizeText(targetText).split(/\s+/).filter(Boolean);
  if (targetTokens.length === 0) return 0.0;

  const sourceTokens = new Set(normalizeText(sourceText).split(/\s+/).filter(Boolean));
  const backedTokens = targetTokens.filter(token => sourceTokens.has(token)).length;
  
  return backedTokens / targetTokens.length;
}

function calculateSourceCoverageScore({ answer, sourceEvidence, segmentText }) {
  if (!sourceEvidence && !segmentText) return 0.8; // Fallback defensivo

  const source = `${segmentText || ''} ${sourceEvidence || ''}`;
  return calculateTokenOverlap(answer, source);
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
  const sourceCoverageScore = calculateSourceCoverageScore({ answer, sourceEvidence, segmentText });
  const atomicityScore = calculateAtomicityScore(question);
  const answerQualityScore = calculateAnswerQualityScore(answer);
  const auditScore = calculateAuditMultiplier(status);
  
  const qualityScore = sourceCoverageScore * atomicityScore * answerQualityScore * auditScore;
  
  return {
    qualityScore: Number(qualityScore.toFixed(4)),
    breakdown: {
      sourceCoverageScore: Number(sourceCoverageScore.toFixed(4)),
      atomicityScore,
      answerQualityScore: Number(answerQualityScore.toFixed(4)),
      auditScore
    }
  };
}

module.exports = { calculateQualityScore };
