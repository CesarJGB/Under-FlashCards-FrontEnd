import {
  cleanLineText,
  finiteNumber,
  isAbortError,
  resolveItemLimit,
  throwIfAborted,
} from './pdfExtractionPrimitives.js';

export function getPageDimensions(page) {
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

function getItemTextLength(item) {
  return typeof item?.str === 'string' ? item.str.length : 0;
}

function resolveTextCharacterLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Infinity;
}

/**
 * First stage of the adaptive route. It only walks the raw PDF.js items and
 * deliberately errs on the side of the full layout path whenever a page could
 * contain columns, a table, rotated text, or a truncated text stream.
 */
export function getPageTextProbe(items, dimensions, textRead, options) {
  const sourceItems = Array.isArray(items) ? items : [];
  const leftBoundary = dimensions.width * 0.38;
  const rightBoundary = dimensions.width * 0.52;
  let nativeCharacters = 0;
  let leftAnchors = 0;
  let rightAnchors = 0;
  let containsNonHorizontalText = false;
  let containsTabularGaps = false;

  sourceItems.forEach((item) => {
    const text = typeof item?.str === 'string' ? item.str : '';
    if (!text.trim()) return;

    nativeCharacters += text.length;
    containsTabularGaps ||= text.includes('\t');

    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = finiteNumber(transform[4], 0);
    const skew = finiteNumber(transform[1], 0);
    const width = Math.max(0, finiteNumber(item.width, 0));
    const wideItem = width >= dimensions.width * 0.72 || text.length > 180;

    containsNonHorizontalText ||= item.dir === 'rtl' || item.dir === 'ttb' || Math.abs(skew) > 0.01;
    if (wideItem) return;
    if (x <= leftBoundary) leftAnchors += 1;
    if (x >= rightBoundary) rightAnchors += 1;
  });

  const minCharactersForFastPath = Math.max(
    options.minNativeCharacters * 4,
    options.adaptiveGraphicsMinCharacters,
  );
  const candidateColumns = leftAnchors >= 2 && rightAnchors >= 2;
  const useCompactRoute = Boolean(sourceItems.length)
    && nativeCharacters >= minCharactersForFastPath
    && sourceItems.length <= options.fastPathMaxItems
    && !candidateColumns
    && !containsNonHorizontalText
    && !containsTabularGaps
    && !textRead.itemLimitReached
    && !textRead.textCharacterLimitReached;

  return {
    nativeCharacters,
    candidateColumns: candidateColumns ? 2 : 1,
    useCompactRoute,
    containsNonHorizontalText,
    containsTabularGaps,
  };
}

export function toTextRun(item, pageHeight, index) {
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

export function unionBounds(runs) {
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

export function composeLineText(runs, alreadySorted = false) {
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
export function groupRunsIntoLines(runs) {
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
  const textCharacterLimit = resolveTextCharacterLimit(options.maxTextCharacters);
  let rawItemCount = 0;
  let capturedTextCharacters = 0;
  let itemLimitReached = false;
  let textCharacterLimitReached = false;
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
      for (const item of chunkItems) {
        if (items.length >= itemLimit) {
          itemLimitReached = true;
          break;
        }

        const itemCharacters = getItemTextLength(item);
        // Keep at least one item so an individual long run does not turn a
        // non-empty page into an artificial empty page.
        if (capturedTextCharacters > 0
          && capturedTextCharacters + itemCharacters > textCharacterLimit) {
          textCharacterLimitReached = true;
          break;
        }

        items.push(item);
        capturedTextCharacters += itemCharacters;

        if (capturedTextCharacters >= textCharacterLimit) {
          textCharacterLimitReached = true;
          break;
        }
      }

      if (itemLimitReached || textCharacterLimitReached) {
        break;
      }
    }
  } finally {
    signal?.removeEventListener?.('abort', abortReader);
    if (itemLimitReached || textCharacterLimitReached || signal?.aborted) await cancelTextReader(reader);
    try {
      reader.releaseLock?.();
    } catch {
      // Releasing an already-cancelled reader is only best effort.
    }
  }

  return {
    items,
    rawItemCount,
    capturedTextCharacters,
    itemLimitReached,
    textCharacterLimitReached,
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
  const textCharacterLimit = resolveTextCharacterLimit(options.maxTextCharacters);
  const items = [];
  let capturedTextCharacters = 0;
  let textCharacterLimitReached = false;

  for (const item of allItems) {
    if (items.length >= itemLimit) break;
    const itemCharacters = getItemTextLength(item);
    if (capturedTextCharacters > 0
      && capturedTextCharacters + itemCharacters > textCharacterLimit) {
      textCharacterLimitReached = true;
      break;
    }
    items.push(item);
    capturedTextCharacters += itemCharacters;
    if (capturedTextCharacters >= textCharacterLimit) {
      textCharacterLimitReached = true;
      break;
    }
  }
  const itemLimitReached = allItems.length > itemLimit;

  return {
    items,
    rawItemCount: allItems.length,
    capturedTextCharacters,
    itemLimitReached,
    textCharacterLimitReached,
    extractionMethod: 'materialized-fallback',
    warnings: fallbackWarning ? [fallbackWarning] : [],
  };
}

export async function readPageTextContent(page, options) {
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
