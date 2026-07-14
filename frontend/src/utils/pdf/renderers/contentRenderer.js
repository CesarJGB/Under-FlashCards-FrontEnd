import { getPageMetrics } from '../document';
import { fitContain, prepareImageAsset } from '../images';
import { createCursor, hasSpace, nextPage, writeLines } from '../pagination';
import { resolveCardPdfStyles, setPdfTextStyle } from '../styles';

function getLineHeight(fontSize) {
  return Math.max(3.8, fontSize * 0.46);
}

function getTextX(metrics, align) {
  if (align === 'center') return metrics.width / 2;
  if (align === 'right') return metrics.width - metrics.margin;
  return metrics.margin;
}

function drawHeader(doc, metrics, config, deckTitle, cardCount, continuation = false) {
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(`${config.title}: ${deckTitle}`, metrics.margin, metrics.top + 7);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const detail = continuation
    ? 'Continuación'
    : `Total de tarjetas: ${cardCount} | Generado el ${new Date().toLocaleDateString()}`;
  doc.text(detail, metrics.margin, metrics.top + 13);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(metrics.margin, metrics.top + 16, metrics.width - metrics.margin, metrics.top + 16);
  return metrics.top + 26;
}

function sectionText(card, section, cardNumber, isGuide) {
  const value = section === 'question' ? card.question : card.answer;
  if (isGuide) return `${section === 'question' ? 'P' : 'R'}: ${value || ''}`;
  return `${section === 'question' ? 'Pregunta' : 'Respuesta'} #${cardNumber}: ${value || ''}`;
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

export async function renderContentDocument(doc, cards, config, context) {
  const metrics = getPageMetrics(doc);
  const deckTitle = context.deckTitle || 'Mazo';
  const cursor = createCursor(metrics, drawHeader(doc, metrics, config, deckTitle, cards.length));
  const isGuide = config.id === 'guide';

  const drawContinuationHeader = () => drawHeader(doc, metrics, config, deckTitle, cards.length, true);

  for (let index = 0; index < cards.length; index += 1) {
    context.throwIfCancelled();
    const card = cards[index];
    const styles = resolveCardPdfStyles(card);
    const shouldRenderImage = config.sections.includes(card.imageSide);
    const imageResult = shouldRenderImage
      ? await prepareImageAsset(card.contentImage, {
        mode: 'contain',
        signal: context.signal,
        assetCache: context.imageAssetCache,
        sourceBlobCache: context.sourceBlobCache,
      })
      : { asset: null, warning: null };
    if (imageResult.warning) context.warn(imageResult.warning, index);
    context.consumeImageAsset(imageResult.asset);

    for (const section of config.sections) {
      context.throwIfCancelled();
      const style = styles[section];
      const usesImage = imageResult.asset && card.imageSide === section;
      const lineHeight = getLineHeight(style.size);
      const align = styles.textAlign;
      const textX = getTextX(metrics, align);

      setPdfTextStyle(doc, style);
      const lines = doc.splitTextToSize(sectionText(card, section, index + 1, isGuide), metrics.contentWidth);
      const imageDimensions = usesImage ? fitContain(imageResult.asset, Math.min(58, metrics.contentWidth), 38) : null;
      const estimatedHeight = (lines.length * lineHeight) + (imageDimensions ? imageDimensions.height + 5 : 0) + 8;

      if (estimatedHeight <= metrics.bottom - cursor.y) {
        doc.setFillColor(styles.background.r, styles.background.g, styles.background.b);
        doc.setDrawColor(241, 245, 249);
        doc.roundedRect(metrics.margin - 2, cursor.y - 4, metrics.contentWidth + 4, estimatedHeight, 3, 3, 'FD');
      }

      writeLines(doc, lines, {
        cursor,
        metrics,
        x: textX,
        lineHeight,
        align,
        drawPageHeader: drawContinuationHeader,
        restoreTextStyle: () => setPdfTextStyle(doc, style),
      });

      if (imageDimensions) {
        if (!hasSpace(cursor, metrics, imageDimensions.height + 3)) {
          nextPage(doc, cursor, metrics, drawContinuationHeader);
        }
        const imageX = metrics.margin + ((metrics.contentWidth - imageDimensions.width) / 2);
        if (drawImage(doc, imageResult.asset, imageX, cursor.y + 1, imageDimensions, context)) {
          cursor.y += imageDimensions.height + 4;
        }
      }

      cursor.y += 7;
    }

    context.reportProgress(index + 1, cards.length, `Procesando tarjeta ${index + 1} de ${cards.length}`);
    await context.yield();
  }
}
