import {
  finiteNumber,
  normalizeForComparison,
  normalizeInlineText,
  PDF_EXTRACTION_DEFAULTS,
} from './pdfExtractionPrimitives.js';
import { createRegions, projectBlocks } from './pdfBlockBuilder.js';

export function projectPageBlocks(page, blocks, warning = null) {
  const nextText = projectBlocks(blocks);

  return {
    ...page,
    blocks,
    regions: createRegions(blocks),
    text: nextText,
    characterCount: nextText.length,
    warnings: warning ? [...page.warnings, warning] : page.warnings,
  };
}

function isLikelyInPageDecoration(block) {
  if (!block || block.type === 'card') return false;
  const normalized = normalizeInlineText(block.text);
  if (normalized.length < 4 || normalized.length > PDF_EXTRACTION_DEFAULTS.repeatedInPageMaxLength) return false;
  if (/[.!?:;]$/.test(normalized)) return false;
  return normalized === normalized.toLocaleUpperCase() && block.lineCount <= 2;
}

export function removeRepeatedDecorationsWithinPage(page, minimumOccurrences, maxLength) {
  const occurrences = new Map();
  page.blocks.forEach((block) => {
    if (!isLikelyInPageDecoration(block)) return;
    const normalized = normalizeForComparison(block.text);
    if (!normalized || normalized.length > maxLength) return;
    const entry = occurrences.get(normalized) || [];
    entry.push(block.id);
    occurrences.set(normalized, entry);
  });

  const removableIds = new Set(
    [...occurrences.values()]
      .filter((blockIds) => blockIds.length >= minimumOccurrences)
      .flat(),
  );
  if (!removableIds.size) return { page, removed: 0 };

  const blocks = page.blocks.filter((block) => !removableIds.has(block.id));
  return {
    page: projectPageBlocks(page, blocks, {
      code: 'REPEATED_DECORATION_REMOVED',
      message: 'Se eliminaron marcas decorativas repetidas dentro de la página.',
    }),
    removed: page.blocks.length - blocks.length,
  };
}

export function removeRepeatedChrome(pages, minimumPages, maxLength) {
  const occurrences = new Map();

  pages.forEach((page) => {
    const topBand = page.height * 0.14;
    const bottomBand = page.height * 0.86;
    const candidates = page.blocks.filter((block) => {
      const [, y, , height] = block.bbox || [];
      const bottom = finiteNumber(y, 0) + finiteNumber(height, 0);
      return finiteNumber(y, Infinity) <= topBand || bottom >= bottomBand;
    });
    const seenOnPage = new Set();

    candidates.forEach((block) => {
      const normalized = normalizeForComparison(block.text);
      if (!normalized || normalized.length < 4 || normalized.length > maxLength || seenOnPage.has(normalized)) return;
      seenOnPage.add(normalized);

      const existing = occurrences.get(normalized) || { pages: new Set(), sample: block.text };
      existing.pages.add(page.pageNumber);
      occurrences.set(normalized, existing);
    });
  });

  const removable = new Set(
    [...occurrences.entries()]
      .filter(([, entry]) => entry.pages.size >= minimumPages)
      .map(([normalized]) => normalized),
  );
  let removed = 0;

  const nextPages = pages.map((page) => {
    const blocks = page.blocks.filter((block) => !removable.has(normalizeForComparison(block.text)));
    const removedOnPage = page.blocks.length - blocks.length;
    removed += removedOnPage;
    return removedOnPage
      ? projectPageBlocks(page, blocks, {
        code: 'REPEATED_CHROME_REMOVED',
        message: 'Se eliminó contenido repetido de encabezado o pie.',
      })
      : page;
  });

  return { pages: nextPages, removed };
}

export function appendWithLimit(current, addition, limit) {
  if (!addition || current.length >= limit) return { value: current, truncated: Boolean(addition) };
  const remaining = limit - current.length;
  if (addition.length <= remaining) return { value: current + addition, truncated: false };
  return { value: current + addition.slice(0, remaining), truncated: true };
}

export function getPageStatusLabel(status) {
  if (status === 'empty') return 'sin texto extraíble';
  if (status === 'ocr') return 'OCR';
  if (status === 'mixed') return 'mixto';
  return 'texto nativo';
}

export function buildPageHeader(pageNumber, status, hasPreviousContent = false) {
  return `${hasPreviousContent ? '\n\n' : ''}--- [Página ${pageNumber} | ${getPageStatusLabel(status)}] ---\n`;
}

export function buildPlainText(pages, maxCharacters) {
  let value = '';
  let truncated = false;
  let truncatedAtPage = null;

  pages.forEach((page) => {
    if (truncated || page.status === 'not-processed') return;

    const pageHeader = buildPageHeader(page.pageNumber, page.status, Boolean(value));
    const pageBody = page.text || (page.needsOcr ? '[Contenido visual pendiente de OCR]' : '[Sin contenido legible]');
    const result = appendWithLimit(value, pageHeader + pageBody, maxCharacters);
    value = result.value;
    truncated = result.truncated;
    if (truncated) {
      truncatedAtPage = page.pageNumber;
      page.truncated = true;
    }
  });

  if (truncated && maxCharacters >= 80) {
    const suffix = '\n\n[Extracción truncada por el límite de caracteres.]';
    value = `${value.slice(0, Math.max(0, maxCharacters - suffix.length))}${suffix}`;
  }

  return { plainText: value.trim(), truncated, truncatedAtPage };
}

export function makeNotProcessedPage(pageNumber) {
  return {
    pageNumber,
    width: 0,
    height: 0,
    status: 'not-processed',
    mode: 'not-processed',
    layout: 'unknown',
    blocks: [],
    regions: [],
    text: '',
    characterCount: 0,
    nativeCharacterCount: 0,
    rawItemCount: 0,
    capturedTextCharacters: 0,
    textItemLimitReached: false,
    textCharacterLimitReached: false,
    textExtractionMethod: 'not-processed',
    hasImages: null,
    imageCount: 0,
    operatorCount: 0,
    graphicsInspection: 'not-processed',
    detailLevel: 'none',
    readingOrder: 'not-processed',
    analysisRoute: 'not-processed',
    needsOcr: false,
    warnings: [{
      code: 'TEXT_LIMIT_REACHED',
      message: `La página ${pageNumber} no se procesó porque se alcanzó el límite de caracteres.`,
    }],
    truncated: false,
    timings: {
      textReadMs: 0,
      textProbeMs: 0,
      geometryMs: 0,
      layoutAnalysisMs: 0,
      graphicsInspectionMs: 0,
      layoutBuildMs: 0,
      ocrMs: 0,
      projectionMs: 0,
      totalMs: 0,
    },
  };
}

export function countStatuses(pages) {
  return pages.reduce(
    (stats, page) => {
      if (page.status === 'native-text') stats.nativePages += 1;
      if (page.status === 'ocr') stats.ocrPages += 1;
      if (page.status === 'mixed') stats.mixedPages += 1;
      if (page.status === 'empty') stats.emptyPages += 1;
      if (page.status === 'failed') stats.failedPages += 1;
      if (page.status === 'not-processed') stats.notProcessedPages += 1;
      if (page.needsOcr) stats.pagesRequiringOcr += 1;
      if (page.warnings.length) stats.pagesWithWarnings += 1;
      if (page.complexity === 'high') stats.highComplexityPages += 1;
      if (page.detailLevel === 'compact') stats.compactPages += 1;
      if (page.detailLevel === 'structured') stats.structuredPages += 1;
      if (page.textExtractionMethod === 'stream') stats.streamedTextPages += 1;
      if (page.textExtractionMethod === 'materialized-fallback') stats.fallbackTextPages += 1;
      if (page.graphicsInspection === 'inspected') stats.graphicsInspectedPages += 1;
      if (page.graphicsInspection === 'skipped-simple') stats.graphicsSkippedPages += 1;
      if (page.readingOrder === 'column-flow') stats.columnFlowPages += 1;
      if (page.analysisRoute === 'compact-probe') stats.compactProbePages += 1;
      if (page.analysisRoute === 'deep-layout') stats.deepLayoutPages += 1;
      if (page.textCharacterLimitReached) stats.textBudgetLimitedPages += 1;
      stats.regionCount += page.regions?.length || 0;
      stats.cardRegionCount += page.cardRegionCount || 0;
      return stats;
    },
    {
      nativePages: 0,
      ocrPages: 0,
      mixedPages: 0,
      emptyPages: 0,
      failedPages: 0,
      notProcessedPages: 0,
      pagesRequiringOcr: 0,
      pagesWithWarnings: 0,
      highComplexityPages: 0,
      compactPages: 0,
      structuredPages: 0,
      streamedTextPages: 0,
      fallbackTextPages: 0,
      graphicsInspectedPages: 0,
      graphicsSkippedPages: 0,
      columnFlowPages: 0,
      compactProbePages: 0,
      deepLayoutPages: 0,
      textBudgetLimitedPages: 0,
      regionCount: 0,
      cardRegionCount: 0,
    },
  );
}
