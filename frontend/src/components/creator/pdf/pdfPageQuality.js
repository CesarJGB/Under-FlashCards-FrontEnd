import {
  finiteNumber,
  normalizeInlineText,
  round,
} from './pdfExtractionPrimitives.js';

export function getImageDetectionWarning(pageNumber, hasImages, nativeCharacters, complexity, minNativeCharacters) {
  if (hasImages === true && nativeCharacters === 0) {
    return {
      code: 'OCR_REQUIRED',
      message: `La página ${pageNumber} contiene imagen y no tiene capa de texto; requiere OCR.`,
    };
  }

  if (hasImages === true && (nativeCharacters > 0 || complexity === 'high')) {
    return {
      code: 'MIXED_PAGE_REVIEW',
      message: `La página ${pageNumber} combina texto e imágenes; puede faltar contenido dentro de elementos visuales.`,
    };
  }

  if (nativeCharacters > 0 && nativeCharacters < minNativeCharacters) {
    return {
      code: 'LOW_TEXT_DENSITY',
      message: `La página ${pageNumber} tiene una capa de texto muy pequeña; conviene revisarla con OCR.`,
    };
  }

  return null;
}

export function normalizeOcrResult(ocrResult, pageNumber) {
  if (!ocrResult) return [];

  if (Array.isArray(ocrResult.blocks)) {
    return ocrResult.blocks
      .map((block, index) => normalizeOcrResult({ ...block, id: `p${pageNumber}-b-ocr-${index + 1}` }, pageNumber)[0])
      .filter(Boolean);
  }

  const text = typeof ocrResult === 'string' ? ocrResult : ocrResult.text;
  if (!normalizeInlineText(text)) return [];

  const bbox = Array.isArray(ocrResult?.bbox) && ocrResult.bbox.length === 4
    ? ocrResult.bbox.map((value) => round(finiteNumber(value, 0)))
    : null;
  const confidence = Math.min(1, Math.max(0, finiteNumber(ocrResult?.confidence, 0.72)));

  return [{
    id: ocrResult?.id || `p${pageNumber}-b-ocr-1`,
    regionId: `p${pageNumber}-r-ocr-1`,
    type: 'paragraph',
    role: 'paragraph',
    title: null,
    bodyText: '',
    text: String(text).trim(),
    bbox,
    confidence,
    source: 'ocr',
    columnIndex: null,
    lineCount: String(text).split(/\r?\n/).length,
    order: Number.MAX_SAFE_INTEGER,
    lineIds: [],
    sourceRunIds: [],
    sourceEvidence: {
      pageNumber,
      regionId: `p${pageNumber}-r-ocr-1`,
      bbox,
      lineIds: [],
      source: 'ocr',
      confidence,
    },
  }];
}
