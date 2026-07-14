export function createCursor(metrics, startY) {
  return { y: startY || metrics.top };
}

export function hasSpace(cursor, metrics, height) {
  return cursor.y + height <= metrics.bottom;
}

export function nextPage(doc, cursor, metrics, drawPageHeader) {
  doc.addPage();
  cursor.y = metrics.top;
  if (typeof drawPageHeader === 'function') {
    cursor.y = drawPageHeader(true);
  }
}

export function writeLines(doc, lines, options) {
  const {
    cursor,
    metrics,
    x,
    lineHeight,
    align = 'left',
    drawPageHeader,
    restoreTextStyle,
  } = options;

  lines.forEach((line) => {
    if (!hasSpace(cursor, metrics, lineHeight)) {
      nextPage(doc, cursor, metrics, drawPageHeader);
      restoreTextStyle?.();
    }
    doc.text(line, x, cursor.y, { align });
    cursor.y += lineHeight;
  });
}
