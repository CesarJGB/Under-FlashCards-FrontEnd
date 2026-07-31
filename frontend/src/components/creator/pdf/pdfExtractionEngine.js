/**
 * PDF extraction engine v1.
 *
 * This module deliberately has no React dependency. It turns PDF.js text
 * items into an auditable document while keeping a plain-text projection for
 * the existing AI generation flow.
 */

export const PDF_EXTRACTION_VERSION = 'pdf-extraction-v1';

export const PDF_EXTRACTION_DEFAULTS = Object.freeze({
  maxCharacters: 600000,
  maxPageCharacters: 120000,
  minNativeCharacters: 24,
  yieldEveryPages: 4,
  repeatedChromeMinPages: 3,
  repeatedChromeMaxLength: 220,
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
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
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
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
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
    dir: item.dir === 'rtl' ? 'rtl' : 'ltr',
    hasEOL: Boolean(item.hasEOL),
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

function composeLineText(runs) {
  if (!runs.length) return '';

  const rtlCount = runs.filter((run) => run.dir === 'rtl').length;
  const orderedRuns = [...runs].sort((a, b) => {
    if (rtlCount > runs.length / 2) return b.x - a.x;
    return a.x - b.x;
  });

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

function makeLine(runs, rawIndex, columnIndex = null) {
  const bounds = unionBounds(runs);
  const text = composeLineText(runs);
  const fontSize = runs.length
    ? runs.reduce((sum, run) => sum + run.fontSize, 0) / runs.length
    : 1;

  return {
    id: `line-${rawIndex + 1}${columnIndex === null ? '' : `-${columnIndex}`}`,
    rawIndex,
    columnIndex,
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

function groupRunsIntoLines(runs) {
  const orderedRuns = [...runs].sort((a, b) => {
    if (Math.abs(a.baseline - b.baseline) > 0.5) return a.baseline - b.baseline;
    return a.x - b.x;
  });
  const lines = [];

  orderedRuns.forEach((run) => {
    const lastLine = lines[lines.length - 1];
    const tolerance = Math.max(2.5, Math.min(run.fontSize, lastLine?.fontSize ?? run.fontSize) * 0.55);
    const canJoin = lastLine
      && !lastLine.runs[lastLine.runs.length - 1]?.hasEOL
      && Math.abs(run.baseline - lastLine.baseline) <= tolerance;

    if (canJoin) {
      lastLine.runs.push(run);
      lastLine.x = Math.min(lastLine.x, run.x);
      lastLine.right = Math.max(lastLine.right, run.right);
      lastLine.y = Math.min(lastLine.y, run.top);
      lastLine.bottom = Math.max(lastLine.bottom, run.bottom);
      lastLine.width = lastLine.right - lastLine.x;
      lastLine.height = lastLine.bottom - lastLine.y;
      lastLine.fontSize = (lastLine.fontSize + run.fontSize) / 2;
      lastLine.text = composeLineText(lastLine.runs);
      return;
    }

    lines.push(makeLine([run], lines.length));
  });

  return lines
    .map((line) => ({
      ...line,
      runs: [...line.runs].sort((a, b) => a.x - b.x),
      text: composeLineText(line.runs),
    }))
    .filter((line) => line.text);
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

async function detectPageImages(page, pdfjsLib, signal) {
  throwIfAborted(signal);

  if (typeof page.getOperatorList !== 'function') return null;

  try {
    const operatorList = await page.getOperatorList();
    throwIfAborted(signal);

    const imageOps = getImageOperatorValues(pdfjsLib);
    if (!imageOps.size) return null;

    return operatorList.fnArray?.some((fn) => imageOps.has(fn)) || false;
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

function findColumnSplit(lines, pageWidth, pageHeight) {
  const runs = lines.flatMap((line) => line.runs.map((run) => ({ ...run, rawIndex: line.rawIndex })));
  if (runs.length < 8 || pageWidth < 300) return null;

  const ordered = [...runs].sort((a, b) => a.x - b.x);
  const candidates = [];

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const left = ordered[index];
    const right = ordered[index + 1];
    const gap = right.x - left.right;
    if (gap < Math.max(24, pageWidth * 0.065)) continue;

    const split = left.right + gap / 2;
    const leftRuns = runs.filter((run) => run.right <= split);
    const rightRuns = runs.filter((run) => run.x >= split);
    const leftLines = new Set(leftRuns.map((run) => run.rawIndex));
    const rightLines = new Set(rightRuns.map((run) => run.rawIndex));
    if (leftLines.size < 4 || rightLines.size < 4) continue;

    const leftY = leftRuns.reduce(
      (bounds, run) => ({ min: Math.min(bounds.min, run.top), max: Math.max(bounds.max, run.bottom) }),
      { min: Infinity, max: -Infinity },
    );
    const rightY = rightRuns.reduce(
      (bounds, run) => ({ min: Math.min(bounds.min, run.top), max: Math.max(bounds.max, run.bottom) }),
      { min: Infinity, max: -Infinity },
    );
    const overlap = Math.max(0, Math.min(leftY.max, rightY.max) - Math.max(leftY.min, rightY.min));
    const overlapRatio = overlap / Math.max(1, Math.min(leftY.max - leftY.min, rightY.max - rightY.min));
    if (overlapRatio < 0.25) continue;

    const leftCoverage = leftRuns.reduce((max, run) => Math.max(max, run.right), 0) / pageWidth;
    const rightCoverage = rightRuns.reduce((min, run) => Math.min(min, run.x), pageWidth) / pageWidth;
    if (leftCoverage > 0.62 || rightCoverage < 0.38) continue;

    candidates.push({ split, gap, leftLines: leftLines.size, rightLines: rightLines.size });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (b.gap !== a.gap) return b.gap - a.gap;
    return (b.leftLines + b.rightLines) - (a.leftLines + a.rightLines);
  });

  return candidates[0].split;
}

function splitLinesByColumns(lines, pageWidth, pageHeight) {
  const split = findColumnSplit(lines, pageWidth, pageHeight);
  if (split === null) {
    return { layout: 'single-column', columnCount: 1, lines: lines.map((line) => ({ ...line, columnIndex: 0 })) };
  }

  const left = [];
  const right = [];
  const fullWidth = [];

  lines.forEach((line) => {
    const leftRuns = line.runs.filter((run) => run.right <= split);
    const rightRuns = line.runs.filter((run) => run.x >= split);
    const crossingRun = line.runs.some((run) => run.x < split && run.right > split);
    const looksFullWidth = line.width >= pageWidth * 0.72
      && line.runs.length <= 3
      && line.text.length <= 180;

    if (crossingRun || (leftRuns.length && rightRuns.length && looksFullWidth)) {
      fullWidth.push({ ...line, columnIndex: null });
      return;
    }

    if (leftRuns.length) left.push(makeLine(leftRuns, line.rawIndex, 0));
    if (rightRuns.length) right.push(makeLine(rightRuns, line.rawIndex, 1));

    if (!leftRuns.length && !rightRuns.length) fullWidth.push({ ...line, columnIndex: null });
  });

  if (left.length < 3 || right.length < 3) {
    return { layout: 'single-column', columnCount: 1, lines: lines.map((line) => ({ ...line, columnIndex: 0 })) };
  }

  const firstColumnTop = Math.min(left[0]?.y ?? Infinity, right[0]?.y ?? Infinity);
  const lastColumnBottom = Math.max(left[left.length - 1]?.bottom ?? 0, right[right.length - 1]?.bottom ?? 0);
  const prelude = fullWidth.filter((line) => line.y <= firstColumnTop).sort((a, b) => a.y - b.y);
  const middle = fullWidth.filter((line) => line.y > firstColumnTop && line.bottom < lastColumnBottom).sort((a, b) => a.y - b.y);
  const epilogue = fullWidth.filter((line) => line.bottom >= lastColumnBottom).sort((a, b) => a.y - b.y);

  return {
    layout: 'two-column',
    columnCount: 2,
    lines: [
      ...prelude,
      ...left.sort((a, b) => a.y - b.y),
      ...middle,
      ...right.sort((a, b) => a.y - b.y),
      ...epilogue,
    ],
  };
}

function calculateMedian(values) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function buildBlocks(lines, pageNumber, medianFontSize) {
  const blocks = [];
  let current = null;

  const flush = () => {
    if (!current) return;

    const text = current.lines.map((line) => line.text).filter(Boolean).join('\n').trim();
    if (!text) {
      current = null;
      return;
    }

    const bounds = unionBounds(current.lines.flatMap((line) => line.runs));
    const firstLine = current.lines[0];
    const isList = current.lines.some((line) => isListLine(line.text));
    const isTable = current.lines.some((line) => line.text.includes('\t'));
    const type = isTable
      ? 'table'
      : isList
        ? 'list'
        : looksLikeHeading(text, firstLine.fontSize, medianFontSize)
          ? 'heading'
          : 'paragraph';

    blocks.push({
      id: `p${pageNumber}-b${blocks.length + 1}`,
      type,
      text,
      bbox: [
        round(bounds.x),
        round(bounds.y),
        round(Math.max(0, bounds.right - bounds.x)),
        round(Math.max(0, bounds.bottom - bounds.y)),
      ],
      confidence: 0.99,
      source: 'pdf-text',
      columnIndex: current.columnIndex,
      lineCount: current.lines.length,
    });
    current = null;
  };

  lines.forEach((line) => {
    const previous = current?.lines[current.lines.length - 1];
    const verticalGap = previous ? line.y - previous.bottom : Infinity;
    const alignmentShift = previous ? Math.abs(line.x - previous.x) : 0;
    const startsNewSemanticUnit = isListLine(line.text)
      || looksLikeHeading(line.text, line.fontSize, medianFontSize);
    const canJoin = current
      && current.columnIndex === line.columnIndex
      && verticalGap <= Math.max(8, line.fontSize * 0.9)
      && alignmentShift <= Math.max(32, line.fontSize * 3.5)
      && !startsNewSemanticUnit;

    if (!canJoin) flush();

    if (!current) {
      current = { lines: [line], columnIndex: line.columnIndex };
    } else {
      current.lines.push(line);
    }
  });

  flush();
  return blocks;
}

function getImageDetectionWarning(pageNumber, hasImages, nativeCharacters) {
  if (hasImages === true && nativeCharacters === 0) {
    return {
      code: 'OCR_REQUIRED',
      message: `La página ${pageNumber} contiene imagen y no tiene capa de texto; requiere OCR.`,
    };
  }

  if (hasImages === true && nativeCharacters > 0) {
    return {
      code: 'MIXED_PAGE_REVIEW',
      message: `La página ${pageNumber} combina imagen y texto; puede faltar texto dentro de la imagen.`,
    };
  }

  if (nativeCharacters > 0 && nativeCharacters < PDF_EXTRACTION_DEFAULTS.minNativeCharacters) {
    return {
      code: 'LOW_TEXT_DENSITY',
      message: `La página ${pageNumber} tiene una capa de texto muy pequeña; conviene revisarla con OCR.`,
    };
  }

  return null;
}

function normalizeOcrResult(ocrResult, pageNumber) {
  if (!ocrResult) return null;
  const text = typeof ocrResult === 'string' ? ocrResult : ocrResult.text;
  if (!normalizeInlineText(text)) return null;

  const bbox = Array.isArray(ocrResult?.bbox) && ocrResult.bbox.length === 4
    ? ocrResult.bbox.map((value) => round(finiteNumber(value, 0)))
    : null;

  return {
    id: `p${pageNumber}-b-ocr-1`,
    type: 'paragraph',
    text: String(text).trim(),
    bbox,
    confidence: Math.min(1, Math.max(0, finiteNumber(ocrResult?.confidence, 0.72))),
    source: 'ocr',
    columnIndex: null,
    lineCount: String(text).split(/\r?\n/).length,
  };
}

async function extractPage(page, pageNumber, options) {
  const { signal, pdfjsLib, minNativeCharacters, ocrProvider } = options;
  throwIfAborted(signal);

  const dimensions = getPageDimensions(page);
  let textContent = null;
  let nativeBlocks = [];
  let nativeCharacters = 0;
  let hasImages = null;
  const warnings = [];

  try {
    textContent = await page.getTextContent({ includeMarkedContent: true });
    throwIfAborted(signal);

    const runs = (textContent.items || [])
      .map((item, index) => toTextRun(item, dimensions.height, index))
      .filter(Boolean);
    const lines = groupRunsIntoLines(runs);
    nativeCharacters = lines.reduce((sum, line) => sum + line.text.length, 0);

    if (lines.length) {
      const layout = splitLinesByColumns(lines, dimensions.width, dimensions.height);
      const medianFontSize = calculateMedian(lines.map((line) => line.fontSize));
      nativeBlocks = buildBlocks(layout.lines, pageNumber, medianFontSize);
      hasImages = nativeCharacters < minNativeCharacters
        ? await detectPageImages(page, pdfjsLib, signal)
        : null;
    } else {
      hasImages = await detectPageImages(page, pdfjsLib, signal);
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new PdfExtractionError(
      `No se pudo leer la página ${pageNumber}.`,
      'PAGE_TEXT_READ_FAILED',
      { pageNumber, cause: error },
    );
  }

  const qualityWarning = getImageDetectionWarning(pageNumber, hasImages, nativeCharacters);
  if (qualityWarning) warnings.push(qualityWarning);

  let blocks = nativeBlocks;
  let status = nativeCharacters > 0 ? 'native-text' : 'empty';
  let mode = nativeCharacters > 0 ? 'native' : 'empty';
  let ocrUsed = false;

  const shouldTryOcr = typeof ocrProvider === 'function'
    && (nativeCharacters === 0 || nativeCharacters < minNativeCharacters || hasImages === true);

  if (shouldTryOcr) {
    try {
      const ocrResult = await ocrProvider({
        page,
        pageNumber,
        signal,
        dimensions,
      });
      const ocrBlock = normalizeOcrResult(ocrResult, pageNumber);

      if (ocrBlock) {
        ocrUsed = true;
        blocks = nativeBlocks.length ? [...nativeBlocks, ocrBlock] : [ocrBlock];
        status = nativeBlocks.length ? 'mixed' : 'ocr';
        mode = nativeBlocks.length ? 'mixed' : 'ocr';
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

  if (!nativeCharacters && !ocrUsed && hasImages === true && !warnings.some((warning) => warning.code === 'OCR_REQUIRED')) {
    warnings.push({
      code: 'OCR_REQUIRED',
      message: `La página ${pageNumber} necesita OCR para recuperar su contenido visual.`,
    });
  }

  const text = blocks.map((block) => block.text).filter(Boolean).join('\n\n').trim();
  return {
    pageNumber,
    width: round(dimensions.width),
    height: round(dimensions.height),
    status,
    mode,
    layout: nativeBlocks.length > 0 && nativeBlocks.some((block) => block.columnIndex === 1)
      ? 'two-column'
      : 'single-column',
    blocks,
    text,
    characterCount: text.length,
    nativeCharacterCount: nativeCharacters,
    rawItemCount: textContent?.items?.length ?? 0,
    hasImages,
    needsOcr: Boolean(hasImages === true && !ocrUsed),
    warnings,
    truncated: false,
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

      const existing = occurrences.get(normalized) || { pages: new Set(), blockIds: new Set(), sample: block.text };
      existing.pages.add(page.pageNumber);
      existing.blockIds.add(`${page.pageNumber}:${block.id}`);
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
    const originalCount = page.blocks.length;
    const blocks = page.blocks.filter((block) => !removable.has(normalizeForComparison(block.text)));
    removed += originalCount - blocks.length;
    return {
      ...page,
      blocks,
      text: blocks.map((block) => block.text).filter(Boolean).join('\n\n').trim(),
      characterCount: blocks.reduce((sum, block) => sum + block.text.length, 0),
      warnings: blocks.length !== originalCount
        ? [...page.warnings, { code: 'REPEATED_CHROME_REMOVED', message: 'Se eliminó contenido repetido de encabezado o pie.' }]
        : page.warnings,
    };
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
    if (truncated) return;

    const label = page.status === 'empty'
      ? 'sin texto extraíble'
      : page.status === 'ocr'
        ? 'OCR'
        : page.status === 'mixed'
          ? 'mixto'
          : 'texto nativo';
    const pageHeader = `${value ? '\n\n' : ''}--- [Página ${page.pageNumber} | ${label}] ---\n`;
    const pageBody = page.text || (page.needsOcr ? '[Contenido visual pendiente de OCR]' : '[Sin contenido legible]');
    const pageValue = pageHeader + pageBody;
    const result = appendWithLimit(value, pageValue, maxCharacters);
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

function countStatuses(pages) {
  return pages.reduce(
    (stats, page) => {
      if (page.status === 'native-text') stats.nativePages += 1;
      if (page.status === 'ocr') stats.ocrPages += 1;
      if (page.status === 'mixed') stats.mixedPages += 1;
      if (page.status === 'empty') stats.emptyPages += 1;
      if (page.status === 'failed') stats.failedPages += 1;
      if (page.needsOcr) stats.pagesRequiringOcr += 1;
      if (page.warnings.length) stats.pagesWithWarnings += 1;
      return stats;
    },
    {
      nativePages: 0,
      ocrPages: 0,
      mixedPages: 0,
      emptyPages: 0,
      failedPages: 0,
      pagesRequiringOcr: 0,
      pagesWithWarnings: 0,
    },
  );
}

/**
 * Extract selected pages from a loaded PDF.js document.
 *
 * `ocrProvider` is intentionally injected. It can be backed by Tesseract,
 * an application server, or another OCR service without coupling the core
 * extractor to a large model/runtime or leaking credentials to the browser.
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
  };
  const { signal, onProgress, pdfjsLib } = settings;
  const pages = [];

  for (let index = 0; index < normalizedPageNumbers.length; index += 1) {
    throwIfAborted(signal);
    const pageNumber = normalizedPageNumbers[index];
    let page = null;

    try {
      page = await pdf.getPage(pageNumber);
      const extractedPage = await extractPage(page, pageNumber, settings);
      pages.push(extractedPage);
    } catch (error) {
      if (isAbortError(error)) throw error;

      pages.push({
        pageNumber,
        width: 0,
        height: 0,
        status: 'failed',
        mode: 'failed',
        layout: 'unknown',
        blocks: [],
        text: '',
        characterCount: 0,
        nativeCharacterCount: 0,
        rawItemCount: 0,
        hasImages: null,
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
        // PDF.js cleanup failures must not hide the extraction result.
      }
    }

    onProgress?.({
      phase: 'extracting',
      current: index + 1,
      total: normalizedPageNumbers.length,
      pageNumber,
    });

    if ((index + 1) % settings.yieldEveryPages === 0) await nextFrame();
  }

  const repeatedChrome = removeRepeatedChrome(
    pages,
    Math.max(settings.repeatedChromeMinPages, Math.ceil(pages.length * 0.35)),
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
    processedPages: repeatedChrome.pages.length,
    sourceCharacters: plainTextResult.plainText.length,
    maxCharacters: settings.maxCharacters,
    truncated: plainTextResult.truncated,
    truncatedAtPage: plainTextResult.truncatedAtPage,
    repeatedBlocksRemoved: repeatedChrome.removed,
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
  if (stats.ocrPages) parts.push(`${stats.ocrPages} con OCR`);
  if (stats.mixedPages) parts.push(`${stats.mixedPages} mixtas`);
  if (stats.pagesRequiringOcr) parts.push(`${stats.pagesRequiringOcr} requieren OCR`);
  if (stats.failedPages) parts.push(`${stats.failedPages} con error`);
  if (stats.truncated) parts.push('límite alcanzado');
  return parts.join(' · ');
}

