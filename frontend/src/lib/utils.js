// ARCHIVO: frontend/src/lib/utils.js

/**
 * Mapa de clases viejas de Tailwind (pre-migración a tamaños numéricos en px)
 * a su equivalente en píxeles. Se usa solo como fallback de retrocompatibilidad
 * para mazos/tarjetas guardados antes de que el editor de estilos pasara a usar
 * números directos.
 */
const LEGACY_SIZE_MAP = {
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
  'text-2xl': 24,
};

const toPxSize = (val) => {
  if (typeof val === 'number') return val;
  return LEGACY_SIZE_MAP[val] || 16;
};

/**
 * Parsea el campo `fontSize` de una flashcard, que históricamente puede contener:
 * - Un string JSON con la configuración completa de estilos (qSize, qBold, qColor,
 *   aSize, aBold, aColor, bgColor, etc.) — formato actual.
 * - Una clase de Tailwind suelta como 'text-base' — formato legado, antes de que
 *   existiera el panel de estilos avanzado.
 *
 * Se usa en todos los componentes que renderizan el contenido de una tarjeta:
 * FlashcardCreator (preview en vivo), FlashcardGrid, FastDeleteMode, ReviewMode,
 * y pdfExporter. Mantenerla centralizada aquí evita que una mejora futura (como
 * pasó con el soporte de bgColor) se aplique en algunos componentes y se olvide
 * en otros.
 *
 * @param {string} fontSizeField - El campo crudo `fontSize` de la tarjeta.
 * @returns {{
 *   qSize: number, qBold: boolean, qItalic: boolean, qColor: string,
 *   aSize: number, aBold: boolean, aItalic: boolean, aColor: string,
 *   bgColor: string
 * }}
 */
export function parseCardStyles(fontSizeField) {
  if (fontSizeField && fontSizeField.startsWith('{')) {
    try {
      const p = JSON.parse(fontSizeField);
      return {
        qSize: toPxSize(p.qSize), qBold: p.qBold ?? true, qItalic: p.qItalic ?? false, qColor: p.qColor || '',
        aSize: toPxSize(p.aSize), aBold: p.aBold ?? false, aItalic: p.aItalic ?? false, aColor: p.aColor || '',
        bgColor: p.bgColor || '',
      };
    } catch (e) {
      // JSON corrupto o incompleto: caemos al fallback de abajo.
    }
  }

  const fallbackSize = toPxSize(fontSizeField);
  return {
    qSize: fallbackSize, qBold: true, qItalic: false, qColor: '',
    aSize: fallbackSize, aBold: false, aItalic: false, aColor: '',
    bgColor: '',
  };
}
