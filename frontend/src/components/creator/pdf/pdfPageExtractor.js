import {
  isAbortError,
  PdfExtractionError,
  round,
  throwIfAborted,
} from './pdfExtractionPrimitives.js';
import {
  buildCompactLayout,
  buildSemanticLayout,
  createRegions,
  projectBlocks,
} from './pdfBlockBuilder.js';
import {
  inspectPageGraphics,
  makeGraphicsState,
  resolveGraphicsInspection,
} from './pdfGraphicsInspector.js';
import { getPageProcessingProfile } from './pdfLayoutTopology.js';
import { getImageDetectionWarning, normalizeOcrResult } from './pdfPageQuality.js';
import { appendWithLimit } from './pdfPostProcessor.js';
import {
  getPageDimensions,
  groupRunsIntoLines,
  readPageTextContent,
  toTextRun,
} from './pdfTextReader.js';

export async function extractPage(page, pageNumber, options) {
  const { signal, pdfjsLib, minNativeCharacters, ocrProvider } = options;
  throwIfAborted(signal);

  const dimensions = getPageDimensions(page);
  const warnings = [];
  let textRead = {
    items: [],
    rawItemCount: 0,
    itemLimitReached: false,
    extractionMethod: 'unknown',
    warnings: [],
  };
  let nativeCharacters = 0;
  let graphics = makeGraphicsState('not-requested');
  let layout = {
    blocks: [],
    regions: [],
    plainText: '',
    layout: 'single-column',
    columnCount: 1,
    bandCount: 0,
    sectionCount: 0,
    cardRegionCount: 0,
    complexity: 'low',
    complexityScore: 0,
    detailLevel: 'structured',
    readingOrder: 'geometric',
    warnings: [],
  };

  try {
    textRead = await readPageTextContent(page, options);
    warnings.push(...textRead.warnings);
    if (textRead.itemLimitReached) {
      warnings.push({
        code: 'PAGE_ITEM_LIMIT',
        message: `La página ${pageNumber} superó el límite de elementos de texto; se procesó una parte controlada.`,
      });
    }

    const runs = textRead.items
      .map((item, index) => toTextRun(item, dimensions.height, index))
      .filter(Boolean);
    const lines = groupRunsIntoLines(runs);
    const profile = getPageProcessingProfile(runs, lines, dimensions, textRead, options);
    nativeCharacters = profile.nativeCharacters;
    const graphicsDecision = resolveGraphicsInspection(options.inspectGraphics, profile);

    if (graphicsDecision.shouldInspect) {
      graphics = await inspectPageGraphics(page, pdfjsLib, signal);
    } else {
      graphics = makeGraphicsState(graphicsDecision.reason);
    }
    if (graphics.failed) {
      warnings.push({
        code: 'GRAPHICS_INSPECTION_FAILED',
        message: `No se pudo completar el diagnóstico gráfico de la página ${pageNumber}; no se asume que esté libre de imágenes.`,
      });
    }

    if (lines.length) {
      const useCompactLayout = profile.useCompactLayout && graphics.hasImages !== true;
      layout = useCompactLayout
        ? buildCompactLayout(lines, pageNumber)
        : buildSemanticLayout(lines, pageNumber, dimensions, graphics, options);
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new PdfExtractionError(
      `No se pudo leer la página ${pageNumber}.`,
      'PAGE_TEXT_READ_FAILED',
      { pageNumber, cause: error },
    );
  }

  warnings.push(...layout.warnings);
  const qualityWarning = getImageDetectionWarning(
    pageNumber,
    graphics.hasImages,
    nativeCharacters,
    layout.complexity,
    minNativeCharacters,
  );
  if (qualityWarning) warnings.push(qualityWarning);

  let blocks = layout.blocks;
  let status = nativeCharacters > 0 ? 'native-text' : 'empty';
  let mode = nativeCharacters > 0 ? 'native' : 'empty';
  let ocrUsed = false;

  const lowText = nativeCharacters === 0 || nativeCharacters < minNativeCharacters;
  const shouldTryOcr = typeof ocrProvider === 'function'
    && (lowText || (graphics.hasImages === true && options.ocrMixedPages === true));

  if (shouldTryOcr) {
    try {
      const ocrResult = await ocrProvider({
        page,
        pageNumber,
        signal,
        dimensions,
        layout,
        mode: lowText ? 'page' : 'selective-mixed-page',
      });
      const ocrBlocks = normalizeOcrResult(ocrResult, pageNumber);
      if (ocrBlocks.length) {
        ocrUsed = true;
        blocks = layout.blocks.length ? [...layout.blocks, ...ocrBlocks] : ocrBlocks;
        status = layout.blocks.length ? 'mixed' : 'ocr';
        mode = layout.blocks.length ? 'mixed' : 'ocr';
        warnings.push({
          code: 'OCR_USED',
          message: `La página ${pageNumber} se completó mediante OCR.`,
        });
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      warnings.push({
        code: 'OCR_FAILED',
        message: `El OCR de la página ${pageNumber} no pudo completarse.`,
      });
    }
  }

  const needsOcr = graphics.hasImages === true && (
    nativeCharacters < minNativeCharacters || layout.complexity === 'high'
  ) && !ocrUsed;
  if (needsOcr && !warnings.some((warning) => warning.code === 'OCR_REQUIRED' || warning.code === 'MIXED_PAGE_REVIEW')) {
    warnings.push({
      code: 'OCR_REVIEW_RECOMMENDED',
      message: `La página ${pageNumber} tiene contenido visual que no está cubierto por la capa nativa.`,
    });
  }

  const projectedText = projectBlocks(blocks);
  const pageTextResult = appendWithLimit('', projectedText, options.maxPageCharacters);
  if (pageTextResult.truncated) {
    warnings.push({
      code: 'PAGE_TEXT_TRUNCATED',
      message: `La página ${pageNumber} alcanzó su límite individual de caracteres.`,
    });
  }

  const regions = blocks === layout.blocks ? layout.regions : createRegions(blocks);

  return {
    pageNumber,
    width: round(dimensions.width),
    height: round(dimensions.height),
    status,
    mode,
    layout: layout.layout,
    columnCount: layout.columnCount,
    bandCount: layout.bandCount,
    sectionCount: layout.sectionCount,
    cardRegionCount: layout.cardRegionCount,
    regionCount: regions.length,
    complexity: layout.complexity,
    complexityScore: layout.complexityScore,
    nativeTextConfidence: nativeCharacters > 0 ? (layout.complexity === 'high' ? 0.82 : 0.98) : 0,
    blocks,
    regions,
    text: pageTextResult.value,
    characterCount: pageTextResult.value.length,
    nativeCharacterCount: nativeCharacters,
    rawItemCount: textRead.rawItemCount,
    textItemLimitReached: textRead.itemLimitReached,
    textExtractionMethod: textRead.extractionMethod,
    hasImages: graphics.hasImages,
    imageCount: graphics.imageCount,
    operatorCount: graphics.operatorCount,
    graphicsInspection: graphics.inspection,
    detailLevel: layout.detailLevel,
    readingOrder: layout.readingOrder,
    needsOcr,
    warnings,
    truncated: pageTextResult.truncated,
  };
}
