/**
 * Shared constants, errors and small deterministic helpers for PDF extraction.
 *
 * This module intentionally has no PDF.js or React dependency.
 */

export const PDF_EXTRACTION_VERSION = 'pdf-extraction';

export const PDF_EXTRACTION_DEFAULTS = Object.freeze({
  maxCharacters: 600000,
  maxPageCharacters: 120000,
  minNativeCharacters: 24,
  yieldEveryPages: 4,
  repeatedChromeMinPages: 3,
  repeatedChromeMaxLength: 220,
  repeatedInPageMinOccurrences: 3,
  repeatedInPageMaxLength: 80,
  maxItemsPerPage: 50000,
  maxColumnsPerBand: 8,
  // `true` preserves the v2 behaviour (inspect every page), `false` disables
  // the diagnostic and `adaptive` only inspects pages that are not clearly
  // simple native-text pages.
  inspectGraphics: 'adaptive',
  fastPathMaxLines: 120,
  fastPathMaxItems: 900,
  adaptiveGraphicsMinCharacters: 160,
  ocrMixedPages: false,
});

export class PdfExtractionError extends Error {
  constructor(message, code = 'PDF_EXTRACTION_FAILED', details = {}) {
    super(message);
    this.name = 'PdfExtractionError';
    this.code = code;
    this.details = details;
  }
}

export function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'PDF_EXTRACTION_ABORTED';
}

export function createAbortError() {
  return new PdfExtractionError(
    'La extracción fue cancelada antes de terminar.',
    'PDF_EXTRACTION_ABORTED',
  );
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw createAbortError();
}

export function nextFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function normalizeInlineText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

export function normalizeForComparison(value) {
  const normalized = normalizeInlineText(value)
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return normalized
    .replace(/^(?:pág(?:ina)?|pag\.?|page)\s*\d+(?:\s*(?:de|\/)\s*\d+)?$/i, '')
    .replace(/\s+(?:pág(?:ina)?|pag\.?|page)\s*\d+(?:\s*(?:de|\/)\s*\d+)?$/i, '')
    .trim();
}

export function cleanLineText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+([,.;:!?%\)\]\}])/g, '$1')
    .replace(/([\(\[\{]) +/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function isListLine(text) {
  return /^(?:[-*•◦▪‣]|\(?\d{1,3}[.)]|\(?[A-Za-z][.)])\s+/.test(text);
}

function looksLikeHeading(text, fontSize, medianFontSize) {
  if (!text || text.length > 180) return false;
  if (fontSize >= medianFontSize * 1.2) return true;
  return text.length <= 90
    && !/[.!?:;]$/.test(text)
    && /[A-ZÁÉÍÓÚÜÑ]{3}/.test(text)
    && text === text.toLocaleUpperCase();
}

function isCardHeading(text) {
  const normalized = normalizeInlineText(text);
  if (!normalized || isListLine(normalized)) return false;

  const body = normalized.replace(/^[-–—]\s*/, '').trim();
  if (!/^[-–—]/.test(normalized) || body.length < 2 || body.length > 110) return false;
  if (/[.!?]$/.test(body)) return false;
  return /[:：]$/.test(body) || /^[A-ZÁÉÍÓÚÜÑÁÉÍÓÚÜÑ0-9][^\n]{1,80}$/.test(body);
}

export function classifyLine(line, medianFontSize) {
  if (isCardHeading(line.text)) return 'card-heading';
  if (looksLikeHeading(line.text, line.fontSize, medianFontSize)) return 'heading';
  if (isListLine(line.text)) return 'list';
  return 'content';
}

export function stripCardPrefix(value) {
  return normalizeInlineText(value)
    .replace(/^[-–—]\s*/, '')
    .replace(/[：:]$/, '')
    .trim();
}

export function calculateMedian(values) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function resolveItemLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : PDF_EXTRACTION_DEFAULTS.maxItemsPerPage;
}
