/**
 * PDF extraction engine v3.
 *
 * The public API deliberately remains compatible with the v1 extractor:
 * `extractPdfDocument(pdf, pageNumbers, options)` still returns `plainText`,
 * `pages`, `warnings` and `stats`. The additional structure is kept alongside
 * that projection so the existing AI flow can continue using `aiText` while
 * complex pages retain their layout evidence.
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

const IMAGE_OPERATOR_NAMES = Object.freeze([
  'paintImageMaskXObject',
  'paintImageMaskXObjectRepeat',
  'paintImageXObject',
  'paintInlineImageXObject',
  'paintSolidColorImageMask',
  'paintJpegXObject',
]);

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

function createAbortError() {
  return new PdfExtractionError(
    'La extracción fue cancelada antes de terminar.',
    'PDF_EXTRACTION_ABORTED',
  );
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw createAbortError();
}

function nextFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeInlineText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

function normalizeForComparison(value) {
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

function cleanLineText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+([,.;:!?%\)\]\}])/g, '$1')
    .replace(/([\(\[\{]) +/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function isListLine(text) {
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

function classifyLine(line, medianFontSize) {
  if (isCardHeading(line.text)) return 'card-heading';
  if (looksLikeHeading(line.text, line.fontSize, medianFontSize)) return 'heading';
  if (isListLine(line.text)) return 'list';
  return 'content';
}

function stripCardPrefix(value) {
  return normalizeInlineText(value)
    .replace(/^[-–—]\s*/, '')
    .replace(/[：:]$/, '')
    .trim();
}

function getPageDimensions(page) {
  try {
    const viewport = page.getViewport({ scale: 1 });
    return {
      width: Math.max(1, finiteNumber(viewport.width, 612)),
      height: Math.max(1, finiteNumber(viewport.height, 792)),
    };
  } catch {
    return { width: 612, height: 792 };
  }
}

function toTextRun(item, pageHeight, index) {
  const text = typeof item?.str === 'string' ? item.str : '';
  if (!text || !text.trim()) return null;

  const transform = Array.isArray(item.transform) ? item.transform : [];
  const a = finiteNumber(transform[0], 1);
  const b = finiteNumber(transform[1], 0);
  const d = finiteNumber(transform[3], 1);
  const x = finiteNumber(transform[4], 0);
  const baseline = pageHeight - finiteNumber(transform[5], pageHeight);
  const fontSize = Math.max(
    1,
    Math.abs(d),
    Math.abs(b),
    finiteNumber(item.height, 0),
  );
  const width = Math.max(
    0.5,
    finiteNumber(item.width, 0),
    Math.hypot(a, b) * Math.max(1, text.length * 0.45),
  );
  const height = Math.max(fontSize, finiteNumber(item.height, 0), 1);

  return {
    id: `run-${index + 1}`,
    text,
    x,
    right: x + width,
    top: baseline - height,
    bottom: baseline,
    baseline,
    width,
    height,
    fontSize,
    dir: item.dir === 'rtl' ? 'rtl' : item.dir === 'ttb' ? 'ttb' : 'ltr',
    hasEOL: Boolean(item.hasEOL),
    fontName: item.fontName || null,
  };
}

function unionBounds(runs) {
  if (!runs.length) return { x: 0, y: 0, right: 0, bottom: 0 };

  return runs.reduce(
    (bounds, run) => ({
      x: Math.min(bounds.x, run.x),
      y: Math.min(bounds.y, run.top),
      right: Math.max(bounds.right, run.right),
      bottom: Math.max(bounds.bottom, run.bottom),
    }),
    { x: Infinity, y: Infinity, right: -Infinity, bottom: -Infinity },
  );
}

function composeLineText(runs, alreadySorted = false) {
  if (!runs.length) return '';

  const rtlCount = runs.filter((run) => run.dir === 'rtl').length;
  const isRtl = rtlCount > runs.length / 2;
  const orderedRuns = alreadySorted && !isRtl
    ? runs
    : [...runs].sort((a, b) => (isRtl ? b.x - a.x : a.x - b.x));

  let result = '';
  let previous = null;
  let tabularGap = false;

  orderedRuns.forEach((run) => {
    const currentText = run.text.replace(/\r?\n/g, ' ');
    if (!currentText) return;

    if (previous) {
      const gap = run.x - previous.right;
      const fontSize = Math.max(previous.fontSize, run.fontSize, 1);
      const hasExplicitSpace = /\s$/.test(previous.text) || /^\s/.test(currentText);
      const previousEndsHyphen = /[-‐‑‒–—]$/.test(previous.text.trim());
      const wideGap = gap > Math.max(18, fontSize * 2.5);
      const normalGap = gap > Math.max(1.5, fontSize * 0.16);

      if (wideGap) {
        tabularGap = true;
        result += '\t';
      } else if ((normalGap || hasExplicitSpace) && !previousEndsHyphen) {
        result += ' ';
      }
    }

    result += currentText;
    previous = run;
  });

  const cleaned = cleanLineText(result);
  return tabularGap ? cleaned.replace(/\t+/g, '\t') : cleaned;
}

function makeLine(runs, rawIndex) {
  const bounds = unionBounds(runs);
  const text = composeLineText(runs);
  const fontSize = runs.length
    ? runs.reduce((sum, run) => sum + run.fontSize, 0) / runs.length
    : 1;

  return {
    id: `line-${rawIndex + 1}`,
    rawIndex,
    runs,
    text,
    x: bounds.x,
    y: bounds.y,
    right: bounds.right,
    bottom: bounds.bottom,
    width: Math.max(0, bounds.right - bounds.x),
    height: Math.max(1, bounds.bottom - bounds.y),
    baseline: runs.length ? runs.reduce((sum, run) => sum + run.baseline, 0) / runs.length : 0,
    fontSize,
  };
}

/**
 * PDF.js may return text from several visual columns with the exact same
 * baseline. A single line object for all of those runs is the source of many
 * column-ordering errors, so a large horizontal gap deliberately starts a
 * separate line fragment.
 */
function groupRunsIntoLines(runs) {
  const orderedRuns = [...runs].sort((a, b) => {
    if (Math.abs(a.baseline - b.baseline) > 0.5) return a.baseline - b.baseline;
    return a.x - b.x;
  });
  const lines = [];

  orderedRuns.forEach((run) => {
    const lastLine = lines[lines.length - 1];
    const lastRun = lastLine?.runs[lastLine.runs.length - 1];
    const tolerance = Math.max(2.5, Math.min(run.fontSize, lastLine?.fontSize ?? run.fontSize) * 0.55);
    const horizontalGap = lastRun ? run.x - lastRun.right : 0;
    // A gap larger than roughly two glyph heights is usually a separate
    // visual cell/column, not a continuation of the same sentence.
    const maxInlineGap = Math.max(14, Math.min(34, run.fontSize * 2.2));
    const canJoin = lastLine
      && lastRun
      && !lastRun.hasEOL
      && Math.abs(run.baseline - lastLine.baseline) <= tolerance
      && horizontalGap <= maxInlineGap;

    if (canJoin) {
      lastLine.runs.push(run);
      lastLine.x = Math.min(lastLine.x, run.x);
      lastLine.right = Math.max(lastLine.right, run.right);
      lastLine.y = Math.min(lastLine.y, run.top);
      lastLine.bottom = Math.max(lastLine.bottom, run.bottom);
      lastLine.width = lastLine.right - lastLine.x;
      lastLine.height = lastLine.bottom - lastLine.y;
      lastLine.fontSize = (lastLine.fontSize + run.fontSize) / 2;
      return;
    }

    lines.push(makeLine([run], lines.length));
  });

  return lines
    .map((line) => {
      const orderedLineRuns = [...line.runs].sort((a, b) => a.x - b.x);
      return {
        ...line,
        runs: orderedLineRuns,
        text: composeLineText(orderedLineRuns, true),
      };
    })
    .filter((line) => line.text);
}

function calculateMedian(values) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function getImageOperatorValues(pdfjsLib) {
  const ops = pdfjsLib?.OPS;
  if (!ops) return new Set();

  return new Set(
    IMAGE_OPERATOR_NAMES
      .map((name) => ops[name])
      .filter((value) => typeof value === 'number'),
  );
}

function resolveItemLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : PDF_EXTRACTION_DEFAULTS.maxItemsPerPage;
}

async function cancelTextReader(reader) {
  try {
    await reader?.cancel?.();
  } catch {
    // A cancelled PDF.js stream may reject while it is being torn down.
  }
}

async function readTextContentFromStream(page, options) {
  const { signal } = options;
  const stream = page.streamTextContent({ includeMarkedContent: false });
  if (!stream || typeof stream.getReader !== 'function') {
    throw new Error('PDF.js no devolvió un stream de texto legible.');
  }

  const reader = stream.getReader();
  const items = [];
  const itemLimit = resolveItemLimit(options.maxItemsPerPage);
  let rawItemCount = 0;
  let itemLimitReached = false;
  const abortReader = () => {
    void cancelTextReader(reader);
  };

  signal?.addEventListener?.('abort', abortReader, { once: true });

  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      throwIfAborted(signal);
      if (done) break;

      const chunkItems = Array.isArray(value?.items) ? value.items : [];
      rawItemCount += chunkItems.length;
      const remaining = itemLimit - items.length;
      if (remaining <= 0) {
        itemLimitReached = true;
        break;
      }

      if (chunkItems.length > remaining) {
        items.push(...chunkItems.slice(0, remaining));
        itemLimitReached = true;
        break;
      }

      items.push(...chunkItems);
      if (items.length >= itemLimit) {
        itemLimitReached = true;
        break;
      }
    }
  } finally {
    signal?.removeEventListener?.('abort', abortReader);
    if (itemLimitReached || signal?.aborted) await cancelTextReader(reader);
    try {
      reader.releaseLock?.();
    } catch {
      // Releasing an already-cancelled reader is only best effort.
    }
  }

  return {
    items,
    rawItemCount,
    itemLimitReached,
    extractionMethod: 'stream',
    warnings: [],
  };
}

async function readTextContentFallback(page, options, fallbackWarning = null) {
  const { signal } = options;
  throwIfAborted(signal);
  const textContent = await page.getTextContent({ includeMarkedContent: false });
  throwIfAborted(signal);
  const allItems = Array.isArray(textContent?.items) ? textContent.items : [];
  const itemLimit = resolveItemLimit(options.maxItemsPerPage);
  const itemLimitReached = allItems.length > itemLimit;

  return {
    items: itemLimitReached ? allItems.slice(0, itemLimit) : allItems,
    rawItemCount: allItems.length,
    itemLimitReached,
    extractionMethod: 'materialized-fallback',
    warnings: fallbackWarning ? [fallbackWarning] : [],
  };
}

async function readPageTextContent(page, options) {
  if (typeof page.streamTextContent !== 'function') {
    return readTextContentFallback(page, options);
  }

  try {
    return await readTextContentFromStream(page, options);
  } catch (error) {
    if (isAbortError(error)) throw error;
    return readTextContentFallback(page, options, {
      code: 'TEXT_STREAM_FALLBACK',
      message: 'La lectura incremental de texto falló; se usó la ruta compatible de PDF.js.',
    });
  }
}

function makeGraphicsState(inspection, extras = {}) {
  return {
    hasImages: null,
    imageCount: 0,
    operatorCount: 0,
    inspection,
    failed: false,
    ...extras,
  };
}

async function inspectPageGraphics(page, pdfjsLib, signal) {
  throwIfAborted(signal);
  if (typeof page.getOperatorList !== 'function') return makeGraphicsState('unavailable');

  try {
    const operatorList = await page.getOperatorList();
    throwIfAborted(signal);
    const imageOps = getImageOperatorValues(pdfjsLib);
    if (!imageOps.size) {
      return makeGraphicsState('inspected', {
        operatorCount: operatorList.fnArray?.length ?? 0,
      });
    }

    const fnArray = Array.isArray(operatorList.fnArray) ? operatorList.fnArray : [];
    const imageCount = fnArray.reduce((count, fn) => count + (imageOps.has(fn) ? 1 : 0), 0);
    return makeGraphicsState('inspected', {
      hasImages: imageCount > 0,
      imageCount,
      operatorCount: fnArray.length,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    return makeGraphicsState('failed', { failed: true });
  }
}

function resolveGraphicsInspection(inspectGraphics, profile) {
  if (inspectGraphics === false) return { shouldInspect: false, reason: 'disabled' };
  if (inspectGraphics === true || inspectGraphics === 'always') {
    return { shouldInspect: true, reason: 'forced' };
  }
  if (inspectGraphics === 'adaptive' || inspectGraphics == null) {
    return profile.shouldInspectGraphics
      ? { shouldInspect: true, reason: 'adaptive-suspicion' }
      : { shouldInspect: false, reason: 'skipped-simple' };
  }

  // Preserve the old opt-in behaviour for unknown truthy values instead of
  // silently weakening diagnostics because of a typo in a consumer.
  return { shouldInspect: Boolean(inspectGraphics), reason: 'forced' };
}

function lineIsWide(line, pageWidth) {
  return line.width >= pageWidth * 0.72 || line.text.length > 180;
}

function clusterColumnAnchors(lines, pageWidth, medianFontSize, maxColumns) {
  const candidates = lines
    .filter((line) => !lineIsWide(line, pageWidth))
    .sort((a, b) => a.x - b.x);

  if (candidates.length < 4) return [];

  const maximumAnchorGap = Math.max(22, Math.min(72, pageWidth * 0.12, medianFontSize * 5));
  const clusters = [];

  candidates.forEach((line) => {
    const current = clusters[clusters.length - 1];
    const currentRight = current?.[current.length - 1]?.x ?? null;
    if (!current || line.x - currentRight > maximumAnchorGap) {
      clusters.push([line]);
    } else {
      current.push(line);
    }
  });

  const usable = clusters
    .map((cluster) => ({
      lines: cluster,
      center: cluster.reduce((sum, line) => sum + line.x, 0) / cluster.length,
    }))
    .filter((cluster) => cluster.lines.length >= 2);

  if (usable.length > 1) return usable.slice(0, maxColumns);
  return [];
}

function assignPageColumns(lines, pageWidth, centers) {
  return lines.map((line) => {
    const wide = lineIsWide(line, pageWidth);
    if (wide && line.role !== 'card-heading') {
      return { ...line, columnIndex: null, isFullWidth: true };
    }

    if (!centers.length) {
      return { ...line, columnIndex: 0, isFullWidth: false };
    }

    let nearestIndex = 0;
    let nearestDistance = Math.abs(line.x - centers[0]);
    centers.forEach((center, index) => {
      const distance = Math.abs(line.x - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return { ...line, columnIndex: nearestIndex, isFullWidth: false };
  });
}

function groupLinesIntoVisualRows(lines, medianFontSize) {
  const ordered = [...lines]
    .filter((line) => !line.isFullWidth)
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > 0.5) return a.y - b.y;
      return a.x - b.x;
    });
  const tolerance = Math.max(2.5, medianFontSize * 0.65);
  const rows = [];

  ordered.forEach((line) => {
    const current = rows[rows.length - 1];
    if (!current || Math.abs(line.y - current.y) > tolerance) {
      rows.push({ y: line.y, lines: [line] });
      return;
    }
    current.lines.push(line);
  });

  return rows;
}

function buildColumnTopology(lines, pageWidth, medianFontSize, maxColumns) {
  const clusters = clusterColumnAnchors(lines, pageWidth, medianFontSize, maxColumns);
  const centers = clusters.map((cluster) => cluster.center);
  const assignedLines = assignPageColumns(lines, pageWidth, centers);
  const nonFullWidthLines = assignedLines.filter((line) => Number.isInteger(line.columnIndex));
  const columnCounts = centers.map((_, index) => (
    nonFullWidthLines.filter((line) => line.columnIndex === index).length
  ));
  const visualRows = groupLinesIntoVisualRows(assignedLines, medianFontSize);
  const multiColumnRows = visualRows.filter((row) => (
    new Set(row.lines.map((line) => line.columnIndex)).size > 1
  )).length;
  const shortLineShare = nonFullWidthLines.length
    ? nonFullWidthLines.filter((line) => normalizeInlineText(line.text).length <= 36).length / nonFullWidthLines.length
    : 0;
  const tableLike = centers.length >= 3
    ? multiColumnRows >= 2
    : multiColumnRows >= 5
      && visualRows.length > 0
      && multiColumnRows / visualRows.length >= 0.6
      && shortLineShare >= 0.72;
  const minimumColumnLines = Math.max(2, Math.ceil(nonFullWidthLines.length * 0.08));
  const hasBalancedColumns = centers.length >= 2
    && columnCounts.every((count) => count >= minimumColumnLines);
  const minimumSeparation = Math.max(40, pageWidth * 0.14, medianFontSize * 4);
  const hasSeparatedColumns = centers.length === 2
    && centers[1] - centers[0] >= minimumSeparation;
  const useColumnFlow = centers.length === 2
    && nonFullWidthLines.length >= 6
    && hasBalancedColumns
    && hasSeparatedColumns
    && !tableLike;

  return {
    centers,
    columnCount: Math.max(1, centers.length),
    candidate: centers.length >= 2,
    tableLike,
    useColumnFlow,
    assignedLines,
  };
}

function buildVisualBands(lines, pageWidth, medianFontSize, maxColumns) {
  const topology = buildColumnTopology(lines, pageWidth, medianFontSize, maxColumns);
  const ordered = [...topology.assignedLines].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 0.5) return a.y - b.y;
    return a.x - b.x;
  });
  const bands = [];
  const verticalBreak = Math.max(12, medianFontSize * 1.85);
  let current = [];
  let currentBottom = -Infinity;
  let currentTop = Infinity;

  ordered.forEach((line) => {
    const gap = line.y - currentBottom;
    const headingBreak = line.role === 'heading'
      && current.length > 0
      && line.y > currentTop + medianFontSize * 0.75;

    if (current.length && (gap > verticalBreak || headingBreak)) {
      bands.push(current);
      current = [];
      currentBottom = -Infinity;
      currentTop = Infinity;
    }

    current.push(line);
    currentBottom = Math.max(currentBottom, line.bottom);
    currentTop = Math.min(currentTop, line.y);
  });

  if (current.length) bands.push(current);

  return {
    topology,
    bands: bands.map((bandLines, bandIndex) => {
      const assigned = bandLines.map((line) => ({ ...line, bandIndex }));
      return {
      bandIndex,
      lines: assigned,
      columnCount: topology.columnCount,
      top: Math.min(...assigned.map((line) => line.y)),
      bottom: Math.max(...assigned.map((line) => line.bottom)),
      };
    }),
  };
}

function getPageProcessingProfile(runs, lines, dimensions, textRead, options) {
  const nativeCharacters = lines.reduce((sum, line) => sum + line.text.length, 0);
  const medianFontSize = calculateMedian(lines.map((line) => line.fontSize));
  const candidateColumns = clusterColumnAnchors(
    lines,
    dimensions.width,
    medianFontSize,
    options.maxColumnsPerBand,
  ).length;
  const containsNonHorizontalText = runs.some((run) => run.dir === 'rtl' || run.dir === 'ttb');
  const containsTabularGaps = lines.some((line) => line.text.includes('\t'));
  const minCharactersForFastPath = Math.max(
    options.minNativeCharacters * 4,
    options.adaptiveGraphicsMinCharacters,
  );
  const useCompactLayout = Boolean(lines.length)
    && nativeCharacters >= minCharactersForFastPath
    && lines.length <= options.fastPathMaxLines
    && runs.length <= options.fastPathMaxItems
    && candidateColumns < 2
    && !containsNonHorizontalText
    && !containsTabularGaps
    && !textRead.itemLimitReached;

  return {
    nativeCharacters,
    candidateColumns,
    useCompactLayout,
    shouldInspectGraphics: !useCompactLayout
      || nativeCharacters < minCharactersForFastPath
      || textRead.itemLimitReached,
  };
}

function makeBounds(lines) {
  return unionBounds(lines.flatMap((line) => line.runs));
}

function blockTypeForLines(lines, forcedType = null) {
  if (forcedType) return forcedType;
  if (lines.some((line) => line.text.includes('\t'))) return 'table';
  if (lines.some((line) => line.role === 'list' || isListLine(line.text))) return 'list';
  return 'paragraph';
}

function buildProjectionForBlock(block) {
  if (block.type === 'section') return `[Sección: ${block.title || block.text}]`;
  if (block.type === 'card') {
    return block.bodyText ? `[Tema: ${block.title}]\n${block.bodyText}` : `[Tema: ${block.title}]`;
  }
  return block.text;
}

function compareBlocksGeometrically(left, right) {
  if (left.order !== right.order) return left.order - right.order;
  if ((left.columnIndex ?? -1) !== (right.columnIndex ?? -1)) {
    return (left.columnIndex ?? -1) - (right.columnIndex ?? -1);
  }
  return left.id.localeCompare(right.id);
}

function projectBlocks(blocks) {
  return [...blocks]
    .sort((a, b) => {
      if (Number.isInteger(a.readingOrder) && Number.isInteger(b.readingOrder)) {
        return a.readingOrder - b.readingOrder;
      }
      return compareBlocksGeometrically(a, b);
    })
    .map(buildProjectionForBlock)
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function createRegions(blocks) {
  return blocks.map((block) => ({
    id: block.regionId,
    type: block.type === 'section' ? 'section' : block.type === 'card' ? 'card' : 'content',
    title: block.title,
    text: block.text,
    bodyText: block.bodyText,
    bbox: block.bbox,
    confidence: block.confidence,
    sectionId: block.sectionId,
    columnIndex: block.columnIndex,
    bandIndex: block.bandIndex,
    blockIds: [block.id],
    lineIds: block.lineIds,
  }));
}

function createBlockFactory(pageNumber, medianFontSize, detailLevel = 'structured') {
  let blockIndex = 0;
  let regionIndex = 0;

  return (lines, forcedType = null, sectionId = null, columnIndex = null) => {
    const cleanLines = lines.filter((line) => line?.text);
    if (!cleanLines.length) return null;

    const bounds = makeBounds(cleanLines);
    const type = blockTypeForLines(cleanLines, forcedType);
    const fullText = cleanLines.map((line) => line.text).join('\n').trim();
    const title = type === 'card'
      ? stripCardPrefix(cleanLines[0].text)
      : type === 'section'
        ? cleanLines[0].text
        : null;
    const bodyText = type === 'card'
      ? cleanLines.slice(1).map((line) => line.text).filter(Boolean).join('\n').trim()
      : '';
    const regionId = `p${pageNumber}-r${++regionIndex}`;
    const id = `p${pageNumber}-b${++blockIndex}`;
    const confidence = type === 'card' ? 0.94 : type === 'section' ? 0.92 : 0.96;
    const bbox = [
      round(bounds.x),
      round(bounds.y),
      round(Math.max(0, bounds.right - bounds.x)),
      round(Math.max(0, bounds.bottom - bounds.y)),
    ];

    const block = {
      id,
      regionId,
      sectionId,
      type,
      role: type,
      title,
      bodyText,
      text: fullText,
      bbox,
      confidence: Math.max(0.5, Math.min(1, confidence - Math.max(0, cleanLines[0].fontSize - medianFontSize) * 0.002)),
      source: 'pdf-text',
      columnIndex,
      bandIndex: cleanLines[0].bandIndex ?? 0,
      order: cleanLines[0].y * 1000 + cleanLines[0].x,
      lineCount: cleanLines.length,
      lineIds: cleanLines.map((line) => line.id),
    };

    if (detailLevel === 'structured') {
      block.sourceRunIds = cleanLines.flatMap((line) => line.runs.map((run) => run.id));
      block.sourceEvidence = {
        pageNumber,
        regionId,
        bbox,
        lineIds: cleanLines.map((line) => line.id),
        source: 'pdf-text',
        confidence,
      };
    }

    return block;
  };
}

function groupOrderedLinesByVerticalGap(ordered, medianFontSize) {
  const groups = [];
  const gapLimit = Math.max(12, medianFontSize * 1.8);
  let current = [];
  let currentBottom = -Infinity;

  ordered.forEach((line) => {
    if (current.length && line.y - currentBottom > gapLimit) {
      groups.push(current);
      current = [];
      currentBottom = -Infinity;
    }
    current.push(line);
    currentBottom = Math.max(currentBottom, line.bottom);
  });

  if (current.length) groups.push(current);
  return groups;
}

function groupLinesByVerticalGap(lines, medianFontSize) {
  const ordered = [...lines].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 0.5) return a.y - b.y;
    return a.x - b.x;
  });
  return groupOrderedLinesByVerticalGap(ordered, medianFontSize);
}

function getBlockTop(block) {
  return finiteNumber(block?.bbox?.[1], finiteNumber(block?.order, 0) / 1000);
}

function orderBlocksByReadingFlow(blocks, topology) {
  const geometric = [...blocks].sort(compareBlocksGeometrically);
  if (!topology?.useColumnFlow) {
    return {
      blocks: geometric.map((block, index) => ({ ...block, readingOrder: index })),
      readingOrder: 'geometric',
    };
  }

  const fullWidth = geometric
    .filter((block) => block.columnIndex === null)
    .sort((left, right) => getBlockTop(left) - getBlockTop(right) || compareBlocksGeometrically(left, right));
  const columnBlocks = geometric.filter((block) => block.columnIndex !== null);
  const ordered = [];
  let segmentTop = -Infinity;

  const appendColumnSegment = (segmentBottom) => {
    const segment = columnBlocks.filter((block) => {
      const top = getBlockTop(block);
      return top >= segmentTop - 0.5 && top < segmentBottom - 0.5;
    });
    segment.sort((left, right) => {
      if (left.columnIndex !== right.columnIndex) return left.columnIndex - right.columnIndex;
      return compareBlocksGeometrically(left, right);
    });
    ordered.push(...segment);
  };

  fullWidth.forEach((block) => {
    const top = getBlockTop(block);
    appendColumnSegment(top);
    ordered.push(block);
    segmentTop = top;
  });
  appendColumnSegment(Infinity);

  return {
    blocks: ordered.map((block, index) => ({ ...block, readingOrder: index })),
    readingOrder: 'column-flow',
  };
}

function appendContentBlocks(blocks, createBlock, orderedLines, medianFontSize) {
  if (!orderedLines.length) return;

  const cardAnchors = orderedLines
    .map((line, index) => (line.role === 'card-heading' ? index : -1))
    .filter((index) => index >= 0);

  if (cardAnchors.length) {
    if (cardAnchors[0] > 0) {
      const prefix = createBlock(
        orderedLines.slice(0, cardAnchors[0]),
        null,
        orderedLines[0].sectionId,
        orderedLines[0].columnIndex,
      );
      if (prefix) blocks.push(prefix);
    }

    cardAnchors.forEach((anchorIndex, index) => {
      const end = cardAnchors[index + 1] ?? orderedLines.length;
      const card = createBlock(
        orderedLines.slice(anchorIndex, end),
        'card',
        orderedLines[anchorIndex].sectionId,
        orderedLines[anchorIndex].columnIndex,
      );
      if (card) blocks.push(card);
    });
    return;
  }

  groupOrderedLinesByVerticalGap(orderedLines, medianFontSize).forEach((lineGroup) => {
    const block = createBlock(
      lineGroup,
      null,
      lineGroup[0].sectionId,
      lineGroup[0].columnIndex,
    );
    if (block) blocks.push(block);
  });
}

function buildCompactLayout(lines, pageNumber) {
  const medianFontSize = calculateMedian(lines.map((line) => line.fontSize));
  const orderedLines = [...lines]
    .map((line) => ({
      ...line,
      role: classifyLine(line, medianFontSize),
      columnIndex: 0,
      bandIndex: 0,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const createBlock = createBlockFactory(pageNumber, medianFontSize, 'compact');
  const blocks = [];
  let currentSectionId = null;
  let sectionIndex = 0;
  let pendingContent = [];

  const flushContent = () => {
    appendContentBlocks(blocks, createBlock, pendingContent, medianFontSize);
    pendingContent = [];
  };

  orderedLines.forEach((line) => {
    if (line.role !== 'heading') {
      pendingContent.push({ ...line, sectionId: currentSectionId });
      return;
    }

    flushContent();
    currentSectionId = `p${pageNumber}-s${++sectionIndex}`;
    const heading = { ...line, sectionId: currentSectionId };
    const block = createBlock([heading], 'section', currentSectionId, heading.columnIndex);
    if (block) blocks.push(block);
  });
  flushContent();

  const ordered = orderBlocksByReadingFlow(blocks, { useColumnFlow: false });
  const regions = createRegions(ordered.blocks);
  const cardRegionCount = ordered.blocks.filter((block) => block.type === 'card').length;

  return {
    blocks: ordered.blocks,
    regions,
    plainText: projectBlocks(ordered.blocks),
    layout: 'single-column',
    columnCount: 1,
    bandCount: groupOrderedLinesByVerticalGap(orderedLines, medianFontSize).length,
    sectionCount: sectionIndex,
    cardRegionCount,
    complexity: 'low',
    complexityScore: 0,
    detailLevel: 'compact',
    readingOrder: ordered.readingOrder,
    warnings: [],
  };
}

function buildSemanticLayout(lines, pageNumber, dimensions, graphics, settings) {
  const medianFontSize = calculateMedian(lines.map((line) => line.fontSize));
  const roleLines = lines.map((line) => ({
    ...line,
    role: classifyLine(line, medianFontSize),
  }));
  const visualLayout = buildVisualBands(
    roleLines,
    dimensions.width,
    medianFontSize,
    settings.maxColumnsPerBand,
  );
  const { bands, topology } = visualLayout;
  const geometricLines = bands
    .flatMap((band) => band.lines)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const latestSectionByColumn = new Map();
  let latestFullWidthSection = null;
  let sectionIndex = 0;

  const enrichedLines = geometricLines.map((line) => {
    if (line.role === 'heading') {
      const sectionId = `p${pageNumber}-s${++sectionIndex}`;
      if (line.columnIndex === null) {
        latestFullWidthSection = sectionId;
        latestSectionByColumn.clear();
      } else {
        latestSectionByColumn.set(line.columnIndex, sectionId);
      }
      return { ...line, sectionId };
    }

    const sectionId = line.columnIndex === null
      ? latestFullWidthSection
      : latestSectionByColumn.get(line.columnIndex) || latestFullWidthSection;
    return { ...line, sectionId };
  });
  const createBlock = createBlockFactory(pageNumber, medianFontSize, 'structured');
  const blocks = [];

  enrichedLines
    .filter((line) => line.role === 'heading')
    .forEach((line) => {
      const block = createBlock([line], 'section', line.sectionId, line.columnIndex);
      if (block) blocks.push(block);
    });

  const groups = new Map();
  enrichedLines
    .filter((line) => line.role !== 'heading')
    .forEach((line) => {
      const key = `${line.sectionId || 'unsectioned'}|${line.columnIndex ?? 'full'}`;
      const group = groups.get(key) || [];
      group.push(line);
      groups.set(key, group);
    });

  groups.forEach((groupLines) => {
    const orderedLines = [...groupLines].sort((a, b) => a.y - b.y || a.x - b.x);
    appendContentBlocks(blocks, createBlock, orderedLines, medianFontSize);
  });

  const ordered = orderBlocksByReadingFlow(blocks, topology);
  const regions = createRegions(ordered.blocks);
  const columnCount = topology.columnCount;
  const sectionCount = ordered.blocks.filter((block) => block.type === 'section').length;
  const cardRegionCount = ordered.blocks.filter((block) => block.type === 'card').length;
  const complexityScore = (
    (columnCount >= 5 ? 4 : columnCount >= 3 ? 3 : columnCount === 2 ? 1 : 0)
    + (bands.length >= 7 ? 3 : bands.length >= 4 ? 2 : bands.length >= 2 ? 1 : 0)
    + (regions.length >= 14 ? 3 : regions.length >= 8 ? 2 : regions.length >= 4 ? 1 : 0)
    + (graphics.imageCount >= 8 ? 3 : graphics.imageCount > 0 ? 2 : 0)
    + (sectionCount >= 5 ? 2 : sectionCount >= 2 ? 1 : 0)
  );
  const complexity = complexityScore >= 8 ? 'high' : complexityScore >= 4 ? 'medium' : 'low';
  const layout = columnCount >= 3 || regions.length >= 8
    ? 'multi-region'
    : columnCount === 2
      ? 'two-column'
      : 'single-column';
  const warnings = [];

  if (layout !== 'single-column') {
    warnings.push({
      code: 'LAYOUT_RECONSTRUCTED',
      message: `La página ${pageNumber} se reconstruyó como ${layout} con ${regions.length} regiones de contenido.`,
    });
  }
  if (topology.candidate && !topology.useColumnFlow) {
    warnings.push({
      code: 'COLUMN_FLOW_FALLBACK',
      message: topology.tableLike
        ? `La página ${pageNumber} parece tabular; se conservó el orden geométrico para no mezclar filas.`
        : `La distribución de columnas de la página ${pageNumber} fue ambigua; se conservó el orden geométrico seguro.`,
    });
  }
  if (complexity === 'high') {
    warnings.push({
      code: 'COMPLEX_LAYOUT_REVIEW',
      message: `La página ${pageNumber} tiene diseño visual complejo; conviene revisar sus regiones y contenido dentro de imágenes.`,
    });
  }

  return {
    blocks: ordered.blocks,
    regions,
    plainText: projectBlocks(ordered.blocks),
    layout,
    columnCount,
    bandCount: bands.length,
    sectionCount,
    cardRegionCount,
    complexity,
    complexityScore,
    detailLevel: 'structured',
    readingOrder: ordered.readingOrder,
    warnings,
  };
}

function getImageDetectionWarning(pageNumber, hasImages, nativeCharacters, complexity, minNativeCharacters) {
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

function normalizeOcrResult(ocrResult, pageNumber) {
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

function projectPageBlocks(page, blocks, warning = null) {
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

function removeRepeatedDecorationsWithinPage(page, minimumOccurrences, maxLength) {
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

function removeRepeatedChrome(pages, minimumPages, maxLength) {
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

function appendWithLimit(current, addition, limit) {
  if (!addition || current.length >= limit) return { value: current, truncated: Boolean(addition) };
  const remaining = limit - current.length;
  if (addition.length <= remaining) return { value: current + addition, truncated: false };
  return { value: current + addition.slice(0, remaining), truncated: true };
}

function buildPlainText(pages, maxCharacters) {
  let value = '';
  let truncated = false;
  let truncatedAtPage = null;

  pages.forEach((page) => {
    if (truncated || page.status === 'not-processed') return;

    const label = page.status === 'empty'
      ? 'sin texto extraíble'
      : page.status === 'ocr'
        ? 'OCR'
        : page.status === 'mixed'
          ? 'mixto'
          : 'texto nativo';
    const pageHeader = `${value ? '\n\n' : ''}--- [Página ${page.pageNumber} | ${label}] ---\n`;
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

function makeNotProcessedPage(pageNumber) {
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
    textItemLimitReached: false,
    textExtractionMethod: 'not-processed',
    hasImages: null,
    imageCount: 0,
    operatorCount: 0,
    graphicsInspection: 'not-processed',
    detailLevel: 'none',
    readingOrder: 'not-processed',
    needsOcr: false,
    warnings: [{
      code: 'TEXT_LIMIT_REACHED',
      message: `La página ${pageNumber} no se procesó porque se alcanzó el límite de caracteres.`,
    }],
    truncated: false,
  };
}

function countStatuses(pages) {
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
      regionCount: 0,
      cardRegionCount: 0,
    },
  );
}

async function extractPage(page, pageNumber, options) {
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
