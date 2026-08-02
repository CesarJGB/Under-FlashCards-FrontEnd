import {
  calculateMedian,
  classifyLine,
  normalizeInlineText,
} from './pdfExtractionPrimitives.js';

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

/**
 * The structured route needs classified lines and a column topology. Keeping
 * them together lets the profile and the semantic builder share one analysis
 * instead of sorting/clustering the same page twice.
 */
export function createPageLayoutAnalysis(lines, dimensions, options) {
  const medianFontSize = calculateMedian(lines.map((line) => line.fontSize));
  const roleLines = lines.map((line) => ({
    ...line,
    role: classifyLine(line, medianFontSize),
  }));
  const topology = buildColumnTopology(
    roleLines,
    dimensions.width,
    medianFontSize,
    options.maxColumnsPerBand,
  );

  return {
    medianFontSize,
    roleLines,
    topology,
  };
}

export function buildVisualBands(lines, pageWidth, medianFontSize, maxColumns, layoutAnalysis = null) {
  const topology = layoutAnalysis?.topology
    || buildColumnTopology(lines, pageWidth, medianFontSize, maxColumns);
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

export function getPageProcessingProfile(runs, lines, dimensions, textRead, options) {
  const nativeCharacters = lines.reduce((sum, line) => sum + line.text.length, 0);
  const layoutAnalysis = createPageLayoutAnalysis(lines, dimensions, options);
  const candidateColumns = layoutAnalysis.topology.centers.length;
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
    && !textRead.itemLimitReached
    && !textRead.textCharacterLimitReached;

  return {
    nativeCharacters,
    candidateColumns,
    layoutAnalysis,
    useCompactLayout,
    shouldInspectGraphics: !useCompactLayout
      || nativeCharacters < minCharactersForFastPath
      || textRead.itemLimitReached
      || textRead.textCharacterLimitReached,
  };
}
