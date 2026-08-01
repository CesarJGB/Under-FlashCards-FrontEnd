// Run from frontend with:
// node --test src/components/creator/pdf/pdfExtractionEngine.test.js
import assert from 'node:assert/strict';
import test from 'node:test';
import { ReadableStream } from 'node:stream/web';
import {
  createExtractionSummary,
  extractPdfDocument,
  isAbortError,
  PDF_EXTRACTION_DEFAULTS,
  PDF_EXTRACTION_VERSION,
  PdfExtractionError,
} from './pdfExtractionEngine.js';

const PDFJS = {
  OPS: {
    paintImageXObject: 91,
  },
};

function makeTextItem(text, x, top, width = 100, fontSize = 12) {
  const pageHeight = 800;
  const baseline = top + fontSize;
  return {
    str: text,
    transform: [1, 0, 0, fontSize, x, pageHeight - baseline],
    width,
    height: fontSize,
    dir: 'ltr',
  };
}

function createPage({ items = [], stream = 'available', streamChunks = [items], image = false } = {}) {
  const calls = {
    streamOptions: [],
    fallbackOptions: [],
    graphics: 0,
    streamCancelled: 0,
  };

  const page = {
    calls,
    getViewport: () => ({ width: 600, height: 800 }),
    getTextContent: async (options) => {
      calls.fallbackOptions.push(options);
      return { items };
    },
    getOperatorList: async () => {
      calls.graphics += 1;
      return { fnArray: image ? [PDFJS.OPS.paintImageXObject] : [] };
    },
    cleanup() {},
  };

  if (stream === 'available') {
    page.streamTextContent = (options) => {
      calls.streamOptions.push(options);
      let chunkIndex = 0;
      return new ReadableStream({
        pull(controller) {
          if (chunkIndex >= streamChunks.length) {
            controller.close();
            return;
          }
          controller.enqueue({ items: streamChunks[chunkIndex] || [] });
          chunkIndex += 1;
        },
        cancel() {
          calls.streamCancelled += 1;
        },
      });
    };
  }

  if (stream === 'throws') {
    page.streamTextContent = () => {
      throw new Error('stream unavailable');
    };
  }

  return page;
}

function createDocument(pages) {
  return {
    numPages: pages.length,
    getPage: async (pageNumber) => pages[pageNumber - 1],
  };
}

test('mantiene la fachada pública del motor después de dividirlo en módulos', () => {
  assert.equal(PDF_EXTRACTION_VERSION, 'pdf-extraction');
  assert.equal(PDF_EXTRACTION_DEFAULTS.maxCharacters, 600000);
  assert.ok(PdfExtractionError.prototype instanceof Error);
  assert.equal(isAbortError(new PdfExtractionError('cancelado', 'PDF_EXTRACTION_ABORTED')), true);
  assert.equal(createExtractionSummary(null), '');
});

test('usa streaming sin marked content y aplica la ruta compacta a una página simple', async () => {
  const page = createPage({
    items: [makeTextItem('Texto nativo largo y lineal. '.repeat(12), 40, 50, 500)],
  });

  const result = await extractPdfDocument(createDocument([page]), [1], { pdfjsLib: PDFJS });
  const extractedPage = result.pages[0];

  assert.deepEqual(page.calls.streamOptions, [{ includeMarkedContent: false }]);
  assert.equal(page.calls.fallbackOptions.length, 0);
  assert.equal(page.calls.graphics, 0);
  assert.equal(extractedPage.textExtractionMethod, 'stream');
  assert.equal(extractedPage.graphicsInspection, 'skipped-simple');
  assert.equal(extractedPage.detailLevel, 'compact');
  assert.equal('sourceRunIds' in extractedPage.blocks[0], false);
  assert.equal('sourceEvidence' in extractedPage.blocks[0], false);
});

test('usa el fallback compatible cuando streaming no está disponible o falla', async () => {
  const unavailable = createPage({
    stream: 'unavailable',
    items: [makeTextItem('Texto de compatibilidad. '.repeat(12), 40, 50, 500)],
  });
  const broken = createPage({
    stream: 'throws',
    items: [makeTextItem('Texto con fallback después de error. '.repeat(8), 40, 50, 500)],
  });

  const result = await extractPdfDocument(createDocument([unavailable, broken]), [1, 2], { pdfjsLib: PDFJS });

  assert.deepEqual(unavailable.calls.fallbackOptions, [{ includeMarkedContent: false }]);
  assert.deepEqual(broken.calls.fallbackOptions, [{ includeMarkedContent: false }]);
  assert.equal(result.pages[0].textExtractionMethod, 'materialized-fallback');
  assert.equal(result.pages[1].textExtractionMethod, 'materialized-fallback');
  assert.ok(result.pages[1].warnings.some((warning) => warning.code === 'TEXT_STREAM_FALLBACK'));
});

test('cancela el stream cuando llega al límite de elementos antes de materializar toda la página', async () => {
  const page = createPage({
    streamChunks: [[
      makeTextItem('Primero', 40, 50),
      makeTextItem('Segundo', 120, 50),
      makeTextItem('Tercero', 200, 50),
    ]],
  });

  const result = await extractPdfDocument(createDocument([page]), [1], {
    pdfjsLib: PDFJS,
    maxItemsPerPage: 2,
  });

  assert.equal(page.calls.streamCancelled, 1);
  assert.equal(result.pages[0].textItemLimitReached, true);
  assert.ok(result.pages[0].warnings.some((warning) => warning.code === 'PAGE_ITEM_LIMIT'));
});

test('inspecciona una página sin texto en modo adaptativo y conserva la necesidad de OCR', async () => {
  const page = createPage({ image: true });

  const result = await extractPdfDocument(createDocument([page]), [1], { pdfjsLib: PDFJS });
  const extractedPage = result.pages[0];

  assert.equal(page.calls.graphics, 1);
  assert.equal(extractedPage.hasImages, true);
  assert.equal(extractedPage.needsOcr, true);
  assert.ok(extractedPage.warnings.some((warning) => warning.code === 'OCR_REQUIRED'));
});

test('no declara una página limpia cuando falla el diagnóstico gráfico requerido', async () => {
  const page = createPage();
  page.getOperatorList = async () => {
    throw new Error('operator list unavailable');
  };

  const result = await extractPdfDocument(createDocument([page]), [1], { pdfjsLib: PDFJS });

  assert.equal(result.pages[0].hasImages, null);
  assert.equal(result.pages[0].graphicsInspection, 'failed');
  assert.ok(result.pages[0].warnings.some((warning) => warning.code === 'GRAPHICS_INSPECTION_FAILED'));
});

test('lee dos columnas estables de arriba abajo por columna, no por filas alternadas', async () => {
  const items = [];
  [80, 110, 140].forEach((top, index) => {
    items.push(makeTextItem(`Izquierda ${index + 1} explicación extensa.`, 40, top, 180));
    items.push(makeTextItem(`Derecha ${index + 1} explicación extensa.`, 340, top, 180));
  });
  const page = createPage({ items });

  const result = await extractPdfDocument(createDocument([page]), [1], { pdfjsLib: PDFJS });
  const text = result.plainText;

  assert.equal(result.pages[0].readingOrder, 'column-flow');
  assert.ok(text.indexOf('Izquierda 3') < text.indexOf('Derecha 1'));
});

test('reporta progreso también para páginas omitidas después del límite global', async () => {
  const pages = [1, 2, 3].map((pageNumber) => createPage({
    items: [makeTextItem(`Página ${pageNumber}: ${'contenido '.repeat(20)}`, 40, 50, 500)],
  }));
  const progress = [];

  const result = await extractPdfDocument(createDocument(pages), [1, 2, 3], {
    pdfjsLib: PDFJS,
    maxCharacters: 80,
    onProgress: (entry) => progress.push(entry),
  });

  assert.deepEqual(progress.map((entry) => entry.current), [1, 2, 3]);
  assert.equal(result.pages[1].status, 'not-processed');
  assert.equal(result.pages[2].status, 'not-processed');
});
