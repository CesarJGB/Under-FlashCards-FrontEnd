import {
  isAbortError,
  nextFrame,
  PdfExtractionError,
  PDF_EXTRACTION_DEFAULTS,
  PDF_EXTRACTION_VERSION,
  resolveItemLimit,
  throwIfAborted,
} from './pdfExtractionPrimitives.js';
import { extractPage } from './pdfPageExtractor.js';
import {
  buildPlainText,
  countStatuses,
  makeNotProcessedPage,
  removeRepeatedChrome,
  removeRepeatedDecorationsWithinPage,
} from './pdfPostProcessor.js';

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
  const pages = [];
  let accumulatedCharacters = 0;
  let budgetReached = false;
  const reportProgress = (current, pageNumber, status) => {
    onProgress?.({
      phase: 'extracting',
      current,
      total: normalizedPageNumbers.length,
      pageNumber,
      status,
    });
  };

  for (let index = 0; index < normalizedPageNumbers.length; index += 1) {
    throwIfAborted(signal);
    const pageNumber = normalizedPageNumbers[index];

    if (budgetReached) {
      const skippedPage = makeNotProcessedPage(pageNumber);
      pages.push(skippedPage);
      reportProgress(index + 1, pageNumber, skippedPage.status);
      if ((index + 1) % settings.yieldEveryPages === 0) await nextFrame();
      continue;
    }

    let page = null;
    try {
      page = await pdf.getPage(pageNumber);
      const extractedPage = await extractPage(page, pageNumber, settings);
      pages.push(extractedPage);
      const pageLabel = extractedPage.status === 'ocr'
        ? 'OCR'
        : extractedPage.status === 'mixed'
          ? 'mixto'
          : extractedPage.status === 'empty'
            ? 'sin texto extraíble'
            : 'texto nativo';
      const pageHeaderLength = `${pages.length > 1 ? '\n\n' : ''}--- [Página ${pageNumber} | ${pageLabel}] ---\n`.length;
      accumulatedCharacters += pageHeaderLength + extractedPage.characterCount;

      if (accumulatedCharacters >= settings.maxCharacters && index < normalizedPageNumbers.length - 1) {
        budgetReached = true;
        extractedPage.truncated = true;
      }
    } catch (error) {
      if (isAbortError(error)) throw error;

      pages.push({
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
        textItemLimitReached: false,
        textExtractionMethod: 'failed',
        hasImages: null,
        imageCount: 0,
        operatorCount: 0,
        graphicsInspection: 'failed',
        detailLevel: 'none',
        readingOrder: 'failed',
        needsOcr: false,
        warnings: [{
          code: error?.code || 'PAGE_FAILED',
          message: error?.message || `No se pudo procesar la página ${pageNumber}.`,
        }],
        truncated: false,
      });
    } finally {
      try {
        page?.cleanup();
      } catch {
        // Cleanup failures must not hide the extraction result.
      }
    }

    reportProgress(index + 1, pageNumber, pages[pages.length - 1]?.status || 'unknown');

    if ((index + 1) % settings.yieldEveryPages === 0) await nextFrame();
  }

  const inPageCleaned = pages.map((page) => {
    if (page.status === 'not-processed' || page.status === 'failed') return { page, removed: 0 };
    return removeRepeatedDecorationsWithinPage(
      page,
      settings.repeatedInPageMinOccurrences,
      settings.repeatedInPageMaxLength,
    );
  });
  const pageCleanup = {
    pages: inPageCleaned.map((entry) => entry.page),
    removed: inPageCleaned.reduce((sum, entry) => sum + entry.removed, 0),
  };
  const repeatedChrome = removeRepeatedChrome(
    pageCleanup.pages,
    Math.max(settings.repeatedChromeMinPages, Math.ceil(normalizedPageNumbers.length * 0.35)),
    settings.repeatedChromeMaxLength,
  );
  const plainTextResult = buildPlainText(repeatedChrome.pages, settings.maxCharacters);
  const statusStats = countStatuses(repeatedChrome.pages);
  const warnings = repeatedChrome.pages.flatMap((page) => page.warnings.map((warning) => ({
    pageNumber: page.pageNumber,
    ...warning,
  })));

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
    ...statusStats,
  };

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
