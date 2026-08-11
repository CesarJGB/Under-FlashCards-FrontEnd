export const FOLDER_TITLE_LAYOUT = Object.freeze({
  folderHeightPx: 144,
  folderFrontTopPx: 52,
  leftPaddingPx: 16,
  rightPaddingPx: 16,
  rightEdgePaddingPx: 10,
  actionButtonTopPx: 64,
  actionButtonWidthPx: 30,
  actionButtonHeightPx: 30,
  actionButtonGapPx: 8,
  titleActionGapPx: 2,
  bottomStripeHeightPx: 8,
  bottomStripeGapPx: 4,
  maxLines: 2,
  singleLineFontSizePx: 20,
  comfortableFontSizePx: 17,
  denseFontSizesPx: Object.freeze([16, 15, 14]),
});

export function getFolderTitleSafeArea(folderWidth) {
  const width = Math.max(0, Number(folderWidth) || 0);
  const rightReservedPx = FOLDER_TITLE_LAYOUT.rightPaddingPx;
  const topPx = FOLDER_TITLE_LAYOUT.actionButtonTopPx
    - FOLDER_TITLE_LAYOUT.folderFrontTopPx
    + FOLDER_TITLE_LAYOUT.actionButtonHeightPx
    + FOLDER_TITLE_LAYOUT.titleActionGapPx;
  const bottomReservedPx = FOLDER_TITLE_LAYOUT.bottomStripeHeightPx
    + FOLDER_TITLE_LAYOUT.bottomStripeGapPx;
  const frontHeightPx = FOLDER_TITLE_LAYOUT.folderHeightPx - FOLDER_TITLE_LAYOUT.folderFrontTopPx;

  return {
    leftPx: FOLDER_TITLE_LAYOUT.leftPaddingPx,
    rightReservedPx,
    topPx,
    bottomReservedPx,
    heightPx: Math.max(0, frontHeightPx - topPx - bottomReservedPx),
    widthPx: Math.max(0, width - FOLDER_TITLE_LAYOUT.leftPaddingPx - rightReservedPx),
  };
}

function countWrappedLines(text, availableWidth, fontSize, measureText) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || availableWidth <= 0) return 0;

  let lines = 1;
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (measureText(candidate, fontSize) <= availableWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines += 1;
      currentLine = word;
    } else {
      currentLine = word;
    }

    const wordWidth = measureText(word, fontSize);
    if (wordWidth > availableWidth) {
      const occupiedLines = Math.ceil(wordWidth / availableWidth);
      lines += occupiedLines - 1;
      currentLine = wordWidth % availableWidth === 0 ? '' : word;
    }
  }

  return lines;
}

export function getMateriaTitleLayout({ name, availableWidth, measureText }) {
  const normalizedName = String(name ?? '').trim();
  const width = Math.max(0, Number(availableWidth) || 0);
  const measure = typeof measureText === 'function'
    ? measureText
    : (value, fontSize) => String(value).length * fontSize * 0.56;

  if (!normalizedName || width <= 0) {
    return {
      state: 'dense',
      fontSizePx: FOLDER_TITLE_LAYOUT.denseFontSizesPx.at(-1),
      lineHeight: 1.12,
      maxLines: FOLDER_TITLE_LAYOUT.maxLines,
      showLabel: false,
      truncated: false,
    };
  }

  if (measure(normalizedName, FOLDER_TITLE_LAYOUT.singleLineFontSizePx) <= width) {
    return {
      state: 'single',
      fontSizePx: FOLDER_TITLE_LAYOUT.singleLineFontSizePx,
      lineHeight: 1.08,
      maxLines: 1,
      showLabel: true,
      truncated: false,
    };
  }

  const comfortableLines = countWrappedLines(
    normalizedName,
    width,
    FOLDER_TITLE_LAYOUT.comfortableFontSizePx,
    measure
  );
  const comfortableMeasure = measure(normalizedName, FOLDER_TITLE_LAYOUT.comfortableFontSizePx);
  if (
    comfortableLines <= FOLDER_TITLE_LAYOUT.maxLines
    && comfortableMeasure <= width * 1.75
  ) {
    return {
      state: 'comfortable',
      fontSizePx: FOLDER_TITLE_LAYOUT.comfortableFontSizePx,
      lineHeight: 1.05,
      maxLines: FOLDER_TITLE_LAYOUT.maxLines,
      showLabel: false,
      truncated: false,
    };
  }

  const fittingDenseSize = FOLDER_TITLE_LAYOUT.denseFontSizesPx.find((fontSize) =>
    countWrappedLines(normalizedName, width, fontSize, measure) <= FOLDER_TITLE_LAYOUT.maxLines
  );
  const fontSizePx = fittingDenseSize || FOLDER_TITLE_LAYOUT.denseFontSizesPx.at(-1);

  return {
    state: 'dense',
    fontSizePx,
    lineHeight: 1.08,
    maxLines: FOLDER_TITLE_LAYOUT.maxLines,
    showLabel: false,
    truncated: !fittingDenseSize,
  };
}
