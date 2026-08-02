import {
  calculateMedian,
  classifyLine,
  finiteNumber,
  isListLine,
  round,
  stripCardPrefix,
} from './pdfExtractionPrimitives.js';
import { buildVisualBands, createPageLayoutAnalysis } from './pdfLayoutTopology.js';
import { unionBounds } from './pdfTextReader.js';

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

export function projectBlocks(blocks) {
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

export function createRegions(blocks) {
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
  if (!orderedLines.length) return 0;

  const cardAnchors = orderedLines
    .map((line, index) => (line.role === 'card-heading' ? index : -1))
    .filter((index) => index >= 0);

  if (cardAnchors.length) {
    let bandCount = 0;
    if (cardAnchors[0] > 0) {
      const prefix = createBlock(
        orderedLines.slice(0, cardAnchors[0]),
        null,
        orderedLines[0].sectionId,
        orderedLines[0].columnIndex,
      );
      if (prefix) {
        blocks.push(prefix);
        bandCount += 1;
      }
    }

    cardAnchors.forEach((anchorIndex, index) => {
      const end = cardAnchors[index + 1] ?? orderedLines.length;
      const card = createBlock(
        orderedLines.slice(anchorIndex, end),
        'card',
        orderedLines[anchorIndex].sectionId,
        orderedLines[anchorIndex].columnIndex,
      );
      if (card) {
        blocks.push(card);
        bandCount += 1;
      }
    });
    return bandCount;
  }

  const lineGroups = groupOrderedLinesByVerticalGap(orderedLines, medianFontSize);
  lineGroups.forEach((lineGroup) => {
    const block = createBlock(
      lineGroup,
      null,
      lineGroup[0].sectionId,
      lineGroup[0].columnIndex,
    );
    if (block) blocks.push(block);
  });
  return lineGroups.length;
}

export function buildCompactLayout(lines, pageNumber, layoutAnalysis = null) {
  const medianFontSize = layoutAnalysis?.medianFontSize
    ?? calculateMedian(lines.map((line) => line.fontSize));
  const classifiedLines = layoutAnalysis?.roleLines
    ?? lines.map((line) => ({
      ...line,
      role: classifyLine(line, medianFontSize),
    }));
  const orderedLines = [...classifiedLines]
    .map((line) => ({
      ...line,
      columnIndex: 0,
      bandIndex: 0,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const createBlock = createBlockFactory(pageNumber, medianFontSize, 'compact');
  const blocks = [];
  let currentSectionId = null;
  let sectionIndex = 0;
  let contentBandCount = 0;
  let pendingContent = [];

  const flushContent = () => {
    contentBandCount += appendContentBlocks(blocks, createBlock, pendingContent, medianFontSize);
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
    layout: 'single-column',
    columnCount: 1,
    bandCount: contentBandCount + sectionIndex,
    sectionCount: sectionIndex,
    cardRegionCount,
    complexity: 'low',
    complexityScore: 0,
    detailLevel: 'compact',
    readingOrder: ordered.readingOrder,
    warnings: [],
  };
}

export function buildSemanticLayout(
  lines,
  pageNumber,
  dimensions,
  graphics,
  settings,
  layoutAnalysis = null,
) {
  const resolvedAnalysis = layoutAnalysis || createPageLayoutAnalysis(lines, dimensions, settings);
  const { medianFontSize, roleLines } = resolvedAnalysis;
  const visualLayout = buildVisualBands(
    roleLines,
    dimensions.width,
    medianFontSize,
    settings.maxColumnsPerBand,
    resolvedAnalysis,
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
