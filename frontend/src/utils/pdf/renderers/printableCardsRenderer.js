import { getPageMetrics } from '../document';
import { fitContain, prepareImageAsset } from '../images';
import { resolveCardPdfStyles, setPdfTextStyle } from '../styles';

function getLineHeight(fontSize) {
  return Math.max(3.2, fontSize * 0.42);
}

function truncateLines(lines, availableHeight, lineHeight) {
  const allowedLines = Math.max(1, Math.floor(availableHeight / lineHeight));
  if (lines.length <= allowedLines) return { lines, truncated: false };

  const truncated = lines.slice(0, allowedLines);
  truncated[truncated.length - 1] = `${truncated[truncated.length - 1].replace(/\.{3}$/, '')}...`;
  return { lines: truncated, truncated: true };
}

function drawImage(doc, asset, x, y, dimensions, context) {
  try {
    doc.addImage(asset.data, asset.format, x, y, dimensions.width, dimensions.height, undefined, 'FAST');
    return true;
  } catch {
    context.warn('Se omitió una imagen que jsPDF no pudo insertar.');
    return false;
  }
}

function drawTextLines(doc, lines, x, y, lineHeight, align) {
  lines.forEach((line, index) => {
    doc.text(line, x, y + (index * lineHeight), { align });
  });
}

function getTextX(x, width, align) {
  if (align === 'center') return x + (width / 2);
  if (align === 'right') return x + width - 6;
  return x + 6;
}

export async function renderPrintableCards(doc, cards, context) {
  const metrics = getPageMetrics(doc, 12);
  const marginY = 15;
  const gapX = 10;
  const gapY = 10;
  const cardWidth = (metrics.width - (metrics.margin * 2) - gapX) / 2;
  const cardHeight = (metrics.height - (marginY * 2) - (gapY * 2)) / 3;

  for (let index = 0; index < cards.length; index += 1) {
    context.throwIfCancelled();
    const card = cards[index];
    const pageItemIndex = index % 6;
    if (index > 0 && pageItemIndex === 0) doc.addPage();

    const column = pageItemIndex % 2;
    const row = Math.floor(pageItemIndex / 2);
    const x = metrics.margin + (column * (cardWidth + gapX));
    const y = marginY + (row * (cardHeight + gapY));
    const styles = resolveCardPdfStyles(card);

    const [backgroundResult, contentResult] = await Promise.all([
      prepareImageAsset(card.bgImage, {
        mode: 'cover',
        targetRatio: cardWidth / cardHeight,
        signal: context.signal,
        assetCache: context.imageAssetCache,
        sourceBlobCache: context.sourceBlobCache,
      }),
      prepareImageAsset(card.contentImage, {
        mode: 'contain',
        signal: context.signal,
        assetCache: context.imageAssetCache,
        sourceBlobCache: context.sourceBlobCache,
      }),
    ]);
    if (backgroundResult.warning) context.warn(backgroundResult.warning, index);
    if (contentResult.warning) context.warn(contentResult.warning, index);
    context.consumeImageAsset(backgroundResult.asset);
    context.consumeImageAsset(contentResult.asset);

    const renderedBackground = backgroundResult.asset
      && drawImage(doc, backgroundResult.asset, x, y, { width: cardWidth, height: cardHeight }, context);

    if (renderedBackground) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.45 }));
      doc.setFillColor(15, 23, 42);
      doc.rect(x, y, cardWidth, cardHeight, 'F');
      doc.restoreGraphicsState();
    } else {
      doc.setFillColor(styles.background.r, styles.background.g, styles.background.b);
      doc.rect(x, y, cardWidth, cardHeight, 'F');
    }

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cardWidth, cardHeight, 'S');

    const dividerY = y + (cardHeight / 2);
    doc.setDrawColor(renderedBackground ? 100 : 210, renderedBackground ? 116 : 225, renderedBackground ? 139 : 235);
    doc.setLineDash([1, 1], 0);
    doc.line(x + 5, dividerY, x + cardWidth - 5, dividerY);
    doc.setLineDash([]);

    const questionHasImage = contentResult.asset && card.imageSide === 'question';
    const answerHasImage = contentResult.asset && card.imageSide === 'answer';
    const questionArea = { top: y + 13, bottom: dividerY - 4 };
    const answerArea = { top: dividerY + 10, bottom: y + cardHeight - 4 };

    const renderSection = (section, area, hasImage, label) => {
      const style = styles[section];
      const align = styles.textAlign;
      const textX = getTextX(x, cardWidth, align);
      const lineHeight = getLineHeight(style.size);
      const imageReserve = hasImage ? Math.min((area.bottom - area.top) * 0.58, 25) : 0;
      const textAvailableHeight = Math.max(lineHeight, (area.bottom - area.top) - imageReserve);

      const textStyle = {
        ...style,
        color: renderedBackground && !style.hasCustomColor
          ? (section === 'question' ? { r: 255, g: 255, b: 255 } : { r: 241, g: 245, b: 249 })
          : style.color,
      };
      setPdfTextStyle(doc, textStyle);
      const lines = doc.splitTextToSize(card[section] || '', cardWidth - 12);
      const fitting = truncateLines(lines, textAvailableHeight, lineHeight);
      if (fitting.truncated) context.warn(`Se recortó texto largo en la ${section === 'question' ? 'pregunta' : 'respuesta'} de una tarjeta imprimible.`, index);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(renderedBackground ? 226 : 100, renderedBackground ? 232 : 116, renderedBackground ? 240 : 139);
      doc.text(label, textX, area.top - 5, { align });

      setPdfTextStyle(doc, textStyle);
      drawTextLines(doc, fitting.lines, textX, area.top, lineHeight, align);

      if (hasImage) {
        const imageTop = area.top + (fitting.lines.length * lineHeight) + 2;
        const dimensions = fitContain(contentResult.asset, cardWidth - 16, Math.max(8, area.bottom - imageTop));
        const imageX = x + ((cardWidth - dimensions.width) / 2);
        drawImage(doc, contentResult.asset, imageX, imageTop, dimensions, context);
      }
    };

    renderSection('question', questionArea, questionHasImage, 'PREGUNTA');
    renderSection('answer', answerArea, answerHasImage, 'RESPUESTA');

    context.reportProgress(index + 1, cards.length, `Procesando tarjeta ${index + 1} de ${cards.length}`);
    await context.yield();
  }
}
