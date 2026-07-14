export const PDF_EXPORTS = Object.freeze({
  guide: {
    id: 'guide',
    title: 'Guía de Estudio',
    fileSuffix: 'guia',
    kind: 'content',
    sections: ['question', 'answer'],
    columns: 2,
  },
  cards: {
    id: 'cards',
    title: 'Tarjetas Imprimibles',
    fileSuffix: 'tarjetas',
    kind: 'cards',
  },
  questions: {
    id: 'questions',
    title: 'Banco de Preguntas',
    fileSuffix: 'banco-preguntas',
    kind: 'content',
    sections: ['question'],
    columns: 3,
  },
  answers: {
    id: 'answers',
    title: 'Banco de Respuestas',
    fileSuffix: 'banco-respuestas',
    kind: 'content',
    sections: ['answer'],
    columns: 3,
  },
});

export const PDF_LIMITS = Object.freeze({
  maxSingleImageBytes: 12 * 1024 * 1024,
  maxTotalImageBytes: 48 * 1024 * 1024,
  maxTotalSourceImageBytes: 48 * 1024 * 1024,
  maxNormalizedImageBytes: 10 * 1024 * 1024,
  maxNormalizedTotalBytes: 60 * 1024 * 1024,
  maxSourceImagePixels: 24 * 1024 * 1024,
  maxImagePixels: 16 * 1024 * 1024,
  warningImageBytes: 30 * 1024 * 1024,
  warningCardCount: 100,
  workerYieldEvery: 1,
});

export function getPdfExport(type) {
  return PDF_EXPORTS[type] || null;
}
