import { prepareImageAsset, fitContain } from '../images';
import { resolveContentTextStyle, setPdfTextStyle } from '../styles';

const PAGE_MARGIN_X = 15;
const HEADER_BAR_HEIGHT = 22;
const HEADER_DIVIDER_Y = 24;
const BODY_TOP_FIRST_PAGE = 28;
const BODY_TOP_OTHER_PAGES = 16;
const BODY_BOTTOM_MARGIN = 16;
const COLUMN_GAP = 7;
const ITEM_GAP = 4.5;
const IMAGE_GAP = 1.8;

const HEADER_BAR_COLOR = { r: 15, g: 23, b: 42 };
const HEADER_META_COLOR = { r: 203, g: 213, b: 225 };
const RUNNING_HEADER_COLOR = { r: 148, g: 163, b: 184 };
const DIVIDER_COLOR = { r: 226, g: 232, b: 240 };

function mmFromPt(pt) {
  return pt * 0.352778;
}

function getItemLabel(config, count) {
  const noun = config.sections.length > 1
    ? 'tarjetas'
    : (config.sections[0] === 'question' ? 'preguntas' : 'respuestas');
  return `${count} ${noun}`;
}

function getColumnGeometry(doc, columns) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - (PAGE_MARGIN_X * 2);
  const columnWidth = (contentWidth - (COLUMN_GAP * (columns - 1))) / columns;
  const columnsX = Array.from({ length: columns }, (_, i) => PAGE_MARGIN_X + (i * (columnWidth + COLUMN_GAP)));
  return { pageWidth, columnWidth, columnsX };
}

function drawHeaderBar(doc, title, meta) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(HEADER_BAR_COLOR.r, HEADER_BAR_COLOR.g, HEADER_BAR_COLOR.b);
  doc.rect(0, 0, pageWidth, HEADER_BAR_HEIGHT, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), PAGE_MARGIN_X, 11);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(HEADER_META_COLOR.r, HEADER_META_COLOR.g, HEADER_META_COLOR.b);
  if (meta.left) doc.text(meta.left.toUpperCase(), PAGE_MARGIN_X, 17.5);
  if (meta.right) doc.text(meta.right.toUpperCase(), pageWidth - PAGE_MARGIN_X, 17.5, { align: 'right' });

  doc.setDrawColor(HEADER_BAR_COLOR.r, HEADER_BAR_COLOR.g, HEADER_BAR_COLOR.b);
  doc.setLineWidth(0.5);
  doc.setLineDash([1, 1], 0);
  doc.line(PAGE_MARGIN_X, HEADER_DIVIDER_Y, pageWidth - PAGE_MARGIN_X, HEADER_DIVIDER_Y);
  doc.setLineDash([]);
}

function drawRunningHeader(doc, label) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(RUNNING_HEADER_COLOR.r, RUNNING_HEADER_COLOR.g, RUNNING_HEADER_COLOR.b);
  doc.text(label, PAGE_MARGIN_X, 10);

  doc.setDrawColor(DIVIDER_COLOR.r, DIVIDER_COLOR.g, DIVIDER_COLOR.b);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN_X, 12.5, pageWidth - PAGE_MARGIN_X, 12.5);
}

function drawColumnDividers(doc, columns, geometry, top, bottom) {
  if (columns <= 1) return;
  doc.setDrawColor(DIVIDER_COLOR.r, DIVIDER_COLOR.g, DIVIDER_COLOR.b);
  doc.setLineWidth(0.2);
  for (let i = 1; i < columns; i += 1) {
    const dividerX = geometry.columnsX[i] - (COLUMN_GAP / 2);
    doc.line(dividerX, top, dividerX, bottom);
  }
}

function drawFooters(doc, deckLabel) {
  const total = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);

    doc.setDrawColor(DIVIDER_COLOR.r, DIVIDER_COLOR.g, DIVIDER_COLOR.b);
    doc.setLineWidth(0.3);
    doc.line(PAGE_MARGIN_X, pageHeight - 12, pageWidth - PAGE_MARGIN_X, pageHeight - 12);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(RUNNING_HEADER_COLOR.r, RUNNING_HEADER_COLOR.g, RUNNING_HEADER_COLOR.b);
    doc.text(deckLabel, PAGE_MARGIN_X, pageHeight - 7);
    doc.text(`Página ${page} de ${total}`, pageWidth - PAGE_MARGIN_X, pageHeight - 7, { align: 'right' });
  }
}

async function prepareSectionImage(source, context, cardIndex, maxWidth, maxHeight) {
  if (!source) return null;

  const result = await prepareImageAsset(source, {
    mode: 'contain',
    signal: context.signal,
    assetCache: context.imageAssetCache,
    sourceBlobCache: context.sourceBlobCache,
  });

  if (result.warning) context.warn(result.warning, cardIndex);
  if (!result.asset) return null;

  context.consumeImageAsset(result.asset);
  const dimensions = fitContain(result.asset, maxWidth, maxHeight);
  return { asset: result.asset, dimensions };
}

/**
 * Renderiza el documento de contenido (Guía de Estudio / Banco de Preguntas /
 * Banco de Respuestas) en un layout tipo examen con columnas densas.
 */
export async function renderContentDocument(doc, items, config, context) {
  context.throwIfCancelled();

  const columns = config.columns || 1;
  const geometry = getColumnGeometry(doc, columns);
  const pageHeight = doc.internal.pageSize.getHeight();
  const questionFallbackSize = columns >= 3 ? 8.5 : 10.5;
  const answerFallbackSize = columns >= 3 ? 8 : 10;
  const maxImageHeight = Math.min(geometry.columnWidth * 0.7, 40);

  const deckTitle = context.deckTitle || 'Mazo';
  const itemLabel = getItemLabel(config, items.length);
  const runningLabel = `${deckTitle} — ${config.title}`;

  drawHeaderBar(doc, config.title, { left: deckTitle, right: itemLabel });
  let pageBodyTop = BODY_TOP_FIRST_PAGE;
  drawColumnDividers(doc, columns, geometry, pageBodyTop, pageHeight - BODY_BOTTOM_MARGIN);

  let columnIndex = 0;
  let cursorY = pageBodyTop;

  const moveToNextColumnOrPage = () => {
    if (columnIndex < columns - 1) {
      columnIndex += 1;
    } else {
      doc.addPage();
      drawRunningHeader(doc, runningLabel);
      pageBodyTop = BODY_TOP_OTHER_PAGES;
      drawColumnDividers(doc, columns, geometry, pageBodyTop, pageHeight - BODY_BOTTOM_MARGIN);
      columnIndex = 0;
    }
    cursorY = pageBodyTop;
  };

  for (let index = 0; index < items.length; index += 1) {
    context.throwIfCancelled();
    const item = items[index];
    const bottomLimit = pageHeight - BODY_BOTTOM_MARGIN;

    // --- 1. Pre-cálculo de alturas (pregunta) ---
    let questionLines = [];
    let questionStyle = null;
    let questionImage = null;
    let questionHeight = 0;

    if (config.sections.includes('question')) {
      questionStyle = resolveContentTextStyle(item, 'question', questionFallbackSize);
      setPdfTextStyle(doc, questionStyle);
      const text = `${index + 1}) ${item.question || ''}`;
      questionLines = doc.splitTextToSize(text, geometry.columnWidth);
      const lineHeight = mmFromPt(questionStyle.size) * 1.35;
      questionHeight = questionLines.length * lineHeight;

      questionImage = await prepareSectionImage(
        item.questionImage,
        context,
        index,
        geometry.columnWidth,
        maxImageHeight
      );
      if (questionImage) questionHeight += questionImage.dimensions.height + IMAGE_GAP;
    }

    // --- 2. Pre-cálculo de alturas (respuesta) ---
    let answerLines = [];
    let answerStyle = null;
    let answerImage = null;
    let answerHeight = 0;

    if (config.sections.includes('answer')) {
      answerStyle = resolveContentTextStyle(item, 'answer', answerFallbackSize);
      setPdfTextStyle(doc, answerStyle);
      const text = `R: ${item.answer || ''}`;
      answerLines = doc.splitTextToSize(text, geometry.columnWidth - 3);
      const lineHeight = mmFromPt(answerStyle.size) * 1.35;
      answerHeight = answerLines.length * lineHeight;

      answerImage = await prepareSectionImage(
        item.answerImage,
        context,
        index,
        geometry.columnWidth - 3,
        maxImageHeight
      );
      if (answerImage) answerHeight += answerImage.dimensions.height + IMAGE_GAP;
    }

    const gapBetweenSections = (questionHeight > 0 && answerHeight > 0) ? 2 : 0;
    const totalBlockHeight = questionHeight + gapBetweenSections + answerHeight;

    // --- 3. Control de paginación / columnas (keep together) ---
    if (cursorY + totalBlockHeight > bottomLimit && cursorY > pageBodyTop) {
      moveToNextColumnOrPage();
    }

    const drawX = geometry.columnsX[columnIndex];

    // --- 4. Renderizado de la pregunta e imagen ---
    if (questionLines.length > 0) {
      setPdfTextStyle(doc, questionStyle);
      const lineHeight = mmFromPt(questionStyle.size) * 1.35;
      questionLines.forEach((line) => {
        doc.text(line, drawX, cursorY + mmFromPt(questionStyle.size));
        cursorY += lineHeight;
      });

      if (questionImage) {
        cursorY += IMAGE_GAP;
        doc.addImage(
          questionImage.asset.data,
          questionImage.asset.format,
          drawX,
          cursorY,
          questionImage.dimensions.width,
          questionImage.dimensions.height,
          undefined,
          'FAST'
        );
        cursorY += questionImage.dimensions.height;
      }
    }

    // --- 5. Renderizado de la respuesta e imagen ---
    if (answerLines.length > 0) {
      cursorY += gapBetweenSections;
      setPdfTextStyle(doc, answerStyle);
      const lineHeight = mmFromPt(answerStyle.size) * 1.35;
      answerLines.forEach((line) => {
        doc.text(line, drawX + 3, cursorY + mmFromPt(answerStyle.size));
        cursorY += lineHeight;
      });

      if (answerImage) {
        cursorY += IMAGE_GAP;
        doc.addImage(
          answerImage.asset.data,
          answerImage.asset.format,
          drawX + 3,
          cursorY,
          answerImage.dimensions.width,
          answerImage.dimensions.height,
          undefined,
          'FAST'
        );
        cursorY += answerImage.dimensions.height;
      }
    }

    cursorY += ITEM_GAP;

    context.reportProgress(index + 1, items.length, `Procesando elemento ${index + 1} de ${items.length}`);
    await context.yield();
  }

  drawFooters(doc, deckTitle);
}
