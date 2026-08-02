import {
  elapsedMs,
  isAbortError,
  nextFrame,
  now,
  PdfExtractionError,
  PDF_EXTRACTION_DEFAULTS,
  PDF_EXTRACTION_VERSION,
  resolveItemLimit,
  throwIfAborted,
} from './pdfExtractionPrimitives.js';
import { extractPage } from './pdfPageExtractor.js';
import {
  buildPlainText,
  buildPageHeader,
  countStatuses,
  makeNotProcessedPage,
  removeRepeatedChrome,
  removeRepeatedDecorationsWithinPage,
} from './pdfPostProcessor.js';

function createTimingTotals() {
  return {
    pageLoadMs: 0,
    pageExtractionMs: 0,
    pageCleanupMs: 0,
    textReadMs: 0,
    textProbeMs: 0,
    geometryMs: 0,
    layoutAnalysisMs: 0,
    graphicsInspectionMs: 0,
    layoutBuildMs: 0,
    ocrMs: 0,
    projectionMs: 0,
    inPageCleanupMs: 0,
    repeatedChromeMs: 0,
    plainTextMs: 0,
    statusAggregationMs: 0,
    postProcessingMs: 0,
    totalMs: 0,
  };
}

function addPagePhaseTimings(timings, pageTimings) {
  if (!pageTimings) return;
  [
    'textReadMs',
    'textProbeMs',
    'geometryMs',
    'layoutAnalysisMs',
    'graphicsInspectionMs',
    'layoutBuildMs',
    'ocrMs',
    'projectionMs',
  ].forEach((key) => {
    const value = Number(pageTimings[key]);
    if (Number.isFinite(value)) timings[key] += value;
  });
}

function createFailedPage(pageNumber, error) {
  return {
    pageNumber,
    width: 0,
    height: 0,
    status: 'failed',
    mode: 'failed',
    layout: 'unknown',
    columnCount: 0,
    bandCount: 0,
    sectionCount: 0,
    cardRegionCount: 0,
    regionCount: 0,
    complexity: 'unknown',
    complexityScore: 0,
    nativeTextConfidence: 0,
    blocks: [],
    regions: [],
    text: '',
    characterCount: 0,
    nativeCharacterCount: 0,
    rawItemCount: 0,
    capturedTextCharacters: 0,
    textItemLimitReached: false,
    textCharacterLimitReached: false,
    textExtractionMethod: 'failed',
    hasImages: null,
    imageCount: 0,
    operatorCount: 0,
    graphicsInspection: 'failed',
    detailLevel: 'none',
    readingOrder: 'failed',
    analysisRoute: 'failed',
    needsOcr: false,
    warnings: [{
      code: error?.code || 'PAGE_FAILED',
      message: error?.message || `No se pudo procesar la página ${pageNumber}.`,
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

/**
 * Extract selected pages from a loaded PDF.js document.
 *
 * OCR remains injected. The engine does not ship a browser OCR runtime or
 * expose provider credentials, but it can consume either a text result or a
 * list of OCR blocks with coordinates.
 */
export async function extractPdfDocument(pdf, pageNumbers, options = {}) {
  if (!pdf || typeof pdf.getPage !== 'function') {
    throw new PdfExtractionError('El documento PDF no está disponible.', 'PDF_DOCUMENT_MISSING');
  }

  const normalizedPageNumbers = [...new Set(pageNumbers)]
    .map((pageNumber) => Number(pageNumber))
    .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= pdf.numPages)
    .sort((a, b) => a - b);

  if (!normalizedPageNumbers.length) {
    throw new PdfExtractionError('No hay páginas seleccionadas para extraer.', 'NO_PAGES_SELECTED');
  }

  const settings = {
    ...PDF_EXTRACTION_DEFAULTS,
    ...options,
    maxItemsPerPage: resolveItemLimit(options.maxItemsPerPage ?? PDF_EXTRACTION_DEFAULTS.maxItemsPerPage),
  };
  const { signal, onProgress } = settings;
  const extractionStartedAt = now();
  const timings = createTimingTotals();
  const pages = [];
  let accumulatedCharacters = 0;
  let budgetReached = false;
  const reportProgress = ({
    phase,
    current,
    total,
    pageNumber = null,
    status,
    message,
  }) => {
    onProgress?.({
      phase,
      current,
      total,
      pageNumber,
      status,
      message,
    });
  };

  for (let index = 0; index < normalizedPageNumbers.length; index += 1) {
    throwIfAborted(signal);
    const pageNumber = normalizedPageNumbers[index];

    if (budgetReached || accumulatedCharacters >= settings.maxCharacters) {
      budgetReached = true;
      const skippedPage = makeNotProcessedPage(pageNumber);
      pages.push(skippedPage);
      reportProgress({
        phase: 'extracting',
        current: index + 1,
        total: normalizedPageNumbers.length,
        pageNumber,
        status: skippedPage.status,
        message: 'Límite de texto alcanzado',
      });
      if ((index + 1) % settings.yieldEveryPages === 0) await nextFrame();
      continue;
    }

    let page = null;
    let pageExtractionStartedAt = null;
    try {
      const pageLoadStartedAt = now();
      page = await pdf.getPage(pageNumber);
      timings.pageLoadMs += elapsedMs(pageLoadStartedAt);
      const remainingCharacterBudget = Math.max(0, settings.maxCharacters - accumulatedCharacters);
      if (!remainingCharacterBudget) {
        budgetReached = true;
        const skippedPage = makeNotProcessedPage(pageNumber);
        pages.push(skippedPage);
      } else {
        const pageSettings = {
          ...settings,
          maxPageCharacters: Math.min(settings.maxPageCharacters, remainingCharacterBudget),
          maxTextCharacters: remainingCharacterBudget,
        };
        pageExtractionStartedAt = now();
        const extractedPage = await extractPage(page, pageNumber, pageSettings);
        addPagePhaseTimings(timings, extractedPage.timings);
        pages.push(extractedPage);
        const pageHeaderLength = buildPageHeader(
          pageNumber,
          extractedPage.status,
          pages.length > 1,
        ).length;
        accumulatedCharacters += pageHeaderLength + extractedPage.characterCount;

        const currentPageUsesGlobalBudget = remainingCharacterBudget <= settings.maxPageCharacters;
        if (index < normalizedPageNumbers.length - 1 && (
          accumulatedCharacters >= settings.maxCharacters
          || (currentPageUsesGlobalBudget && extractedPage.truncated)
        )) {
          budgetReached = true;
          extractedPage.truncated = true;
        }
      }
    } catch (error) {
      if (isAbortError(error)) throw error;

      pages.push(createFailedPage(pageNumber, error));
    } finally {
      if (pageExtractionStartedAt !== null) {
        timings.pageExtractionMs += elapsedMs(pageExtractionStartedAt);
      }
      const pageCleanupStartedAt = now();
      try {
        page?.cleanup();
      } catch {
        // Cleanup failures must not hide the extraction result.
      }
      timings.pageCleanupMs += elapsedMs(pageCleanupStartedAt);
    }

    reportProgress({
      phase: 'extracting',
      current: index + 1,
      total: normalizedPageNumbers.length,
      pageNumber,
      status: pages[pages.length - 1]?.status || 'unknown',
    });

    if ((index + 1) % settings.yieldEveryPages === 0) await nextFrame();
  }

  const inPageCleaned = [];
  for (let index = 0; index < pages.length; index += 1) {
    throwIfAborted(signal);
    const page = pages[index];
    const cleanupStartedAt = now();
    const cleaned = page.status === 'not-processed' || page.status === 'failed'
      ? { page, removed: 0 }
      : removeRepeatedDecorationsWithinPage(
        page,
        settings.repeatedInPageMinOccurrences,
        settings.repeatedInPageMaxLength,
      );
    timings.inPageCleanupMs += elapsedMs(cleanupStartedAt);
    inPageCleaned.push(cleaned);
    reportProgress({
      phase: 'post-processing',
      current: index + 1,
      total: pages.length,
      pageNumber: page.pageNumber,
      status: 'removing-repeated-decorations',
      message: 'Limpiando marcas repetidas',
    });
    if ((index + 1) % settings.yieldEveryPages === 0) await nextFrame();
  }
  const pageCleanup = {
    pages: inPageCleaned.map((entry) => entry.page),
    removed: inPageCleaned.reduce((sum, entry) => sum + entry.removed, 0),
  };
  reportProgress({
    phase: 'post-processing',
    current: pages.length,
    total: pages.length,
    status: 'removing-repeated-chrome',
    message: 'Eliminando encabezados y pies repetidos',
  });
  const repeatedChromeStartedAt = now();
  const repeatedChrome = removeRepeatedChrome(
    pageCleanup.pages,
    Math.max(settings.repeatedChromeMinPages, Math.ceil(normalizedPageNumbers.length * 0.35)),
    settings.repeatedChromeMaxLength,
  );
  timings.repeatedChromeMs = elapsedMs(repeatedChromeStartedAt);
  await nextFrame();

  reportProgress({
    phase: 'finalizing',
    current: 0,
    total: 1,
    status: 'building-result',
    message: 'Preparando el resultado final',
  });
  const plainTextStartedAt = now();
  const plainTextResult = buildPlainText(repeatedChrome.pages, settings.maxCharacters);
  timings.plainTextMs = elapsedMs(plainTextStartedAt);
  const statusAggregationStartedAt = now();
  const statusStats = countStatuses(repeatedChrome.pages);
  const warnings = repeatedChrome.pages.flatMap((page) => page.warnings.map((warning) => ({
    pageNumber: page.pageNumber,
    ...warning,
  })));
  timings.statusAggregationMs = elapsedMs(statusAggregationStartedAt);
  timings.postProcessingMs = timings.inPageCleanupMs
    + timings.repeatedChromeMs
    + timings.plainTextMs
    + timings.statusAggregationMs;
  timings.totalMs = elapsedMs(extractionStartedAt);

  const stats = {
    totalPages: pdf.numPages,
    selectedPages: normalizedPageNumbers.length,
    processedPages: repeatedChrome.pages.filter((page) => page.status !== 'not-processed').length,
    sourceCharacters: plainTextResult.plainText.length,
    structuredSourceCharacters: repeatedChrome.pages.reduce((sum, page) => sum + page.characterCount, 0),
    maxCharacters: settings.maxCharacters,
    truncated: plainTextResult.truncated || repeatedChrome.pages.some((page) => page.truncated),
    truncatedAtPage: plainTextResult.truncatedAtPage,
    repeatedBlocksRemoved: repeatedChrome.removed + pageCleanup.removed,
    ocrProviderAvailable: typeof settings.ocrProvider === 'function',
    timings,
    ...statusStats,
  };

  reportProgress({
    phase: 'finalizing',
    current: 1,
    total: 1,
    status: 'completed',
    message: 'Resultado listo',
  });

  return {
    version: PDF_EXTRACTION_VERSION,
    plainText: plainTextResult.plainText,
    pages: repeatedChrome.pages,
    warnings,
    stats,
  };
}

export function createExtractionSummary(result) {
  if (!result?.stats) return '';

  const { stats } = result;
  const parts = [
    `${stats.processedPages}/${stats.selectedPages} páginas`,
    `${stats.nativePages} nativas`,
  ];
  if (stats.regionCount) parts.push(`${stats.regionCount} regiones`);
  if (stats.cardRegionCount) parts.push(`${stats.cardRegionCount} bloques`);
  if (stats.highComplexityPages) parts.push(`${stats.highComplexityPages} complejas`);
  if (stats.ocrPages) parts.push(`${stats.ocrPages} con OCR`);
  if (stats.mixedPages) parts.push(`${stats.mixedPages} mixtas`);
  if (stats.pagesRequiringOcr) parts.push(`${stats.pagesRequiringOcr} requieren OCR`);
  if (stats.failedPages) parts.push(`${stats.failedPages} con error`);
  if (stats.notProcessedPages) parts.push(`${stats.notProcessedPages} no procesadas`);
  if (stats.truncated) parts.push('límite alcanzado');
  return parts.join(' · ');
}
