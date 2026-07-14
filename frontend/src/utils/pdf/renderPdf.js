import { getPdfExport, PDF_LIMITS } from './constants';
import { createPdfDocument, createPdfFileName } from './document';
import { estimateDeckImageWeight } from './images';
import { renderContentDocument } from './renderers/contentRenderer';
import { renderPrintableCards } from './renderers/printableCardsRenderer';

function createAbortError() {
  const error = new Error('La exportación fue cancelada.');
  error.name = 'AbortError';
  return error;
}

function assertExportRequest(cards, config) {
  if (!config) throw new Error('El formato de exportación solicitado no es válido.');
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error('No hay tarjetas en este mazo para exportar a PDF.');
  }
}

function createYield() {
  return () => new Promise((resolve) => setTimeout(resolve, 0));
}

export async function renderPdf({
  deckTitle,
  cards,
  type,
  signal,
  isCancelled,
  onProgress,
  onWarning,
}) {
  const config = getPdfExport(type);
  assertExportRequest(cards, config);

  const warnings = [];
  let normalizedImageBytes = 0;
  let sourceImageBytes = 0;
  const consumedAssets = new WeakSet();
  const consumedSources = new Set();
  const warn = (message, cardIndex) => {
    const warning = { message, cardIndex: Number.isInteger(cardIndex) ? cardIndex : null };
    warnings.push(warning);
    onWarning?.(warning);
  };
  const throwIfCancelled = () => {
    if (signal?.aborted || isCancelled?.()) throw createAbortError();
  };
  const reportProgress = (current, total, message) => {
    onProgress?.({ phase: 'rendering', current, total, message });
  };
  const consumeImageAsset = (asset) => {
    if (!asset) return;
    if (!consumedSources.has(asset.sourceKey)) {
      consumedSources.add(asset.sourceKey);
      sourceImageBytes += asset.sourceBytes || 0;
      if (sourceImageBytes > PDF_LIMITS.maxTotalSourceImageBytes) {
        throw new Error('Las imágenes fuente superan el límite seguro para generar un PDF en el navegador.');
      }
    }
    if (consumedAssets.has(asset)) return;
    consumedAssets.add(asset);
    normalizedImageBytes += asset.bytes || 0;
    if (normalizedImageBytes > PDF_LIMITS.maxNormalizedTotalBytes) {
      throw new Error('Las imágenes normalizadas superan el límite seguro para generar un PDF en el navegador.');
    }
  };

  throwIfCancelled();
  const weight = estimateDeckImageWeight(cards);
  if (weight.isHeavy) {
    warn(`Este mazo contiene ${cards.length} tarjetas y ${weight.count} imágenes. La generación puede tardar más de lo habitual.`);
  }

  onProgress?.({ phase: 'preparing', current: 0, total: cards.length, message: 'Preparando el documento...' });
  const doc = createPdfDocument();
  const context = {
    deckTitle,
    signal,
    throwIfCancelled,
    reportProgress,
    warn,
    consumeImageAsset,
    imageAssetCache: new Map(),
    sourceBlobCache: new Map(),
    yield: createYield(),
  };

  if (config.kind === 'cards') {
    await renderPrintableCards(doc, cards, context);
  } else {
    await renderContentDocument(doc, cards, config, context);
  }

  throwIfCancelled();
  onProgress?.({ phase: 'saving', current: cards.length, total: cards.length, message: 'Preparando la descarga...' });

  return {
    buffer: doc.output('arraybuffer'),
    fileName: createPdfFileName(deckTitle, config.fileSuffix),
    warnings,
    cardsProcessed: cards.length,
  };
}
