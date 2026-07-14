import { parseCardStyles } from '../../lib/utils';

const DEFAULT_QUESTION_COLOR = { r: 15, g: 23, b: 42 };
const DEFAULT_ANSWER_COLOR = { r: 71, g: 85, b: 105 };
const DEFAULT_BACKGROUND_COLOR = { r: 250, g: 250, b: 250 };

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function hexToRgb(value) {
  const hex = value.slice(1);

  if (hex.length === 3 || hex.length === 4) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }

  if (hex.length === 6 || hex.length === 8) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

function rgbStringToRgb(value) {
  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;

  const values = match[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part.trim()));
  if (values.length !== 3 || values.some((part) => Number.isNaN(part))) return null;

  return {
    r: Math.round(clamp(values[0], 0, 255)),
    g: Math.round(clamp(values[1], 0, 255)),
    b: Math.round(clamp(values[2], 0, 255)),
  };
}

export function cssColorToRgb(value) {
  if (!value || typeof value !== 'string') return null;

  const color = value.trim();
  if (color.startsWith('#')) return hexToRgb(color);
  if (color.startsWith('rgb')) return rgbStringToRgb(color);
  return null;
}

export function isDarkColor(color) {
  if (!color) return false;
  return (0.2126 * color.r) + (0.7152 * color.g) + (0.0722 * color.b) < 140;
}

export function toPdfFontSize(pxSize, fallback = 11) {
  const numericSize = Number(pxSize);
  if (!Number.isFinite(numericSize)) return fallback;
  return Math.round(clamp(numericSize * 0.75, 8, 18) * 10) / 10;
}

export function getFontStyle({ bold, italic }) {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

export function resolveCardPdfStyles(card) {
  const styles = parseCardStyles(String(card?.fontSize || ''));
  const background = cssColorToRgb(styles.bgColor);
  const questionColor = cssColorToRgb(styles.qColor);
  const answerColor = cssColorToRgb(styles.aColor);
  const darkBackground = isDarkColor(background);

  return {
    background: background || DEFAULT_BACKGROUND_COLOR,
    hasCustomBackground: Boolean(background),
    question: {
      size: toPdfFontSize(styles.qSize),
      style: getFontStyle({ bold: styles.qBold, italic: styles.qItalic }),
      color: questionColor || (darkBackground ? { r: 255, g: 255, b: 255 } : DEFAULT_QUESTION_COLOR),
      hasCustomColor: Boolean(questionColor),
    },
    answer: {
      size: toPdfFontSize(styles.aSize),
      style: getFontStyle({ bold: styles.aBold, italic: styles.aItalic }),
      color: answerColor || (darkBackground ? { r: 241, g: 245, b: 249 } : DEFAULT_ANSWER_COLOR),
      hasCustomColor: Boolean(answerColor),
    },
    textAlign: ['left', 'center', 'right'].includes(card?.textAlign) ? card.textAlign : 'left',
  };
}

export function setPdfTextStyle(doc, style) {
  doc.setFont('Helvetica', style.style);
  doc.setFontSize(style.size);
  doc.setTextColor(style.color.r, style.color.g, style.color.b);
}
