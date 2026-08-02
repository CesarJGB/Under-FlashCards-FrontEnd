import {
  elapsedMs,
  isAbortError,
  now,
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
  getPageTextProbe,
  groupRunsIntoLines,
  readPageTextContent,
  toTextRun,
} from './pdfTextReader.js';

export async function extractPage(page, pageNumber, options) {
  const { signal, pdfjsLib, minNativeCharacters, ocrProvider } = options;
  throwIfAborted(signal);

  const startedAt = now();
  const timings = {
    textReadMs: 0,
    textProbeMs: 0,
    geometryMs: 0,
    layoutAnalysisMs: 0,
    graphicsInspectionMs: 0,
    layoutBuildMs: 0,
    ocrMs: 0,
    projectionMs: 0,
    totalMs: 0,
  };
  const dimensions = getPageDimensions(page);
  const warnings = [];
  let textRead = {
    items: [],
    rawItemCount: 0,
    capturedTextCharacters: 0,
    itemLimitReached: false,
    textCharacterLimitReached: false,
    extractionMethod: 'unknown',
    warnings: [],
  };
  let nativeCharacters = 0;
  let analysisRoute = 'deep-layout';
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
    const textReadStartedAt = now();
    textRead = await readPageTextContent(page, options);
    timings.textReadMs = elapsedMs(textReadStartedAt);
    warnings.push(...textRead.warnings);
    if (textRead.itemLimitReached) {
      warnings.push({
        code: 'PAGE_ITEM_LIMIT',
        message: `La página ${pageNumber} superó el límite de elementos de texto; se procesó una parte controlada.`,
      });
    }
    if (textRead.textCharacterLimitReached) {
      warnings.push({
        code: 'PAGE_TEXT_BUDGET_REACHED',
        message: `La página ${pageNumber} alcanzó el presupuesto de texto disponible para el documento.`,
      });
    }

    const probeStartedAt = now();
    const textProbe = getPageTextProbe(textRead.items, dimensions, textRead, options);
    timings.textProbeMs = elapsedMs(probeStartedAt);

    const geometryStartedAt = now();
    const runs = textRead.items
      .map((item, index) => toTextRun(item, dimensions.height, index))
      .filter(Boolean);
    const lines = groupRunsIntoLines(runs);
    timings.geometryMs = elapsedMs(geometryStartedAt);

    const forceGraphicsInspection = options.inspectGraphics === true
      || options.inspectGraphics === 'always'
      || (Boolean(options.inspectGraphics) && options.inspectGraphics !== 'adaptive');

    if (textProbe.useCompactRoute && !forceGraphicsInspection) {
      analysisRoute = 'compact-probe';
      nativeCharacters = lines.reduce((sum, line) => sum + line.text.length, 0);
      graphics = makeGraphicsState('skipped-simple');

      if (lines.length) {
        const layoutStartedAt = now();
        layout = buildCompactLayout(lines, pageNumber);
        timings.layoutBuildMs = elapsedMs(layoutStartedAt);
      }
    } else {
      const profileStartedAt = now();
      const profile = getPageProcessingProfile(runs, lines, dimensions, textRead, options);
      timings.layoutAnalysisMs = elapsedMs(profileStartedAt);
      nativeCharacters = profile.nativeCharacters;
      const graphicsDecision = resolveGraphicsInspection(options.inspectGraphics, profile);

      const graphicsStartedAt = now();
      if (graphicsDecision.shouldInspect) {
        graphics = await inspectPageGraphics(page, pdfjsLib, signal);
      } else {
        graphics = makeGraphicsState(graphicsDecision.reason);
      }
      timings.graphicsInspectionMs = elapsedMs(graphicsStartedAt);

      if (graphics.failed) {
        warnings.push({
          code: 'GRAPHICS_INSPECTION_FAILED',
          message: `No se pudo completar el diagnóstico gráfico de la página ${pageNumber}; no se asume que esté libre de imágenes.`,
        });
      }

      if (lines.length) {
        const layoutStartedAt = now();
        const useCompactLayout = profile.useCompactLayout && graphics.hasImages !== true;
        layout = useCompactLayout
          ? buildCompactLayout(lines, pageNumber, profile.layoutAnalysis)
          : buildSemanticLayout(lines, pageNumber, dimensions, graphics, options, profile.layoutAnalysis);
        timings.layoutBuildMs = elapsedMs(layoutStartedAt);
      }
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
    const ocrStartedAt = now();
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
    } finally {
      timings.ocrMs = elapsedMs(ocrStartedAt);
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

  const projectionStartedAt = now();
  const projectedText = projectBlocks(blocks);
  const pageTextResult = appendWithLimit('', projectedText, options.maxPageCharacters);
  timings.projectionMs = elapsedMs(projectionStartedAt);
  if (pageTextResult.truncated) {
    warnings.push({
      code: 'PAGE_TEXT_TRUNCATED',
      message: `La página ${pageNumber} alcanzó su límite individual de caracteres.`,
    });
  }

  const regions = blocks === layout.blocks ? layout.regions : createRegions(blocks);
  timings.totalMs = elapsedMs(startedAt);

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
    capturedTextCharacters: textRead.capturedTextCharacters,
    textItemLimitReached: textRead.itemLimitReached,
    textCharacterLimitReached: textRead.textCharacterLimitReached,
    textExtractionMethod: textRead.extractionMethod,
    hasImages: graphics.hasImages,
    imageCount: graphics.imageCount,
    operatorCount: graphics.operatorCount,
    graphicsInspection: graphics.inspection,
    detailLevel: layout.detailLevel,
    readingOrder: layout.readingOrder,
    analysisRoute,
    needsOcr,
    warnings,
    truncated: pageTextResult.truncated,
    timings,
  };
}
