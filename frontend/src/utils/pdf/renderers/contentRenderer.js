import { prepareImageAsset, fitContain } from '../images';
import { resolveContentTextStyle, setPdfTextStyle } from '../styles';

const APP_NAME = 'UnderFlashCards';

const PAGE_MARGIN_X = 15;
const BODY_TOP_FIRST_PAGE = 46;
const BODY_TOP_OTHER_PAGES = 16;
const BODY_BOTTOM_MARGIN = 16;
const COLUMN_GAP = 7;
const ITEM_GAP = 4.5;
const IMAGE_GAP = 1.8;

// Marco de imagen: MISMO estilo (contorno + mat) para todas, pero el tamaño
// de la caja se ajusta al de cada imagen ya escalada — nunca se recorta
// contenido. Es la prioridad frente a la uniformidad exacta de tamaño:
// perder info de un mapa/diagrama es peor que una caja un poco más chica.
const FRAME_PADDING = 2.2;
const FRAME_BORDER_WIDTH = 0.7;
const MAX_IMAGE_HEIGHT = 34; // tope para que una imagen no domine la columna
const PLACEHOLDER_INNER_HEIGHT = 18;

const INK_COLOR = { r: 15, g: 23, b: 42 };
const KICKER_COLOR = { r: 51, g: 65, b: 85 };
const SUBTITLE_COLOR = { r: 71, g: 85, b: 105 };
const RUNNING_HEADER_COLOR = { r: 148, g: 163, b: 184 };
const DIVIDER_COLOR = { r: 226, g: 232, b: 240 };
const RULE_COLOR = { r: 30, g: 30, b: 30 };
const PLACEHOLDER_COLOR = { r: 148, g: 163, b: 184 };

function mmFromPt(pt) {
  return pt * 0.352778;
}

function getItemLabel(config, count) {
  const noun = config.sections.length > 1
    ? 'Tarjetas'
    : (config.sections[0] === 'question' ? 'Preguntas' : 'Respuestas');
  return `${count} ${noun}`;
}

function getColumnGeometry(doc, columns) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - (PAGE_MARGIN_X * 2);
  const columnWidth = (contentWidth - (COLUMN_GAP * (columns - 1))) / columns;
  const columnsX = Array.from({ length: columns }, (_, i) => PAGE_MARGIN_X + (i * (columnWidth + COLUMN_GAP)));
  return { pageWidth, columnWidth, columnsX };
}

// Reduce el tamaño de fuente hasta que el texto quepa en maxWidth (para
// nombres de materia largos), sin bajar de minSize.
function fitTextSize(doc, text, maxWidth, startSize, minSize, font, style) {
  let size = startSize;
  doc.setFont(font, style);
  doc.setFontSize(size);
  while (doc.getTextWidth(text) > maxWidth && size > minSize) {
    size -= 1;
    doc.setFontSize(size);
  }
  return size;
}

// Dibuja una línea de texto centrada flanqueada por una o dos reglas
// horizontales delgadas (el "───  TEXTO  ───" del diseño de diploma).
function drawFlankedLine(doc, text, y, doubleRule) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const textWidth = doc.getTextWidth(text);
  const gap = 4;
  const ruleStartRight = centerX + (textWidth / 2) + gap;
  const ruleEndLeft = centerX - (textWidth / 2) - gap;

  doc.text(text, centerX, y, { align: 'center' });

  doc.setDrawColor(RULE_COLOR.r, RULE_COLOR.g, RULE_COLOR.b);
  const ruleYOffsets = doubleRule ? [-1.6, -0.8] : [-1.2];
  ruleYOffsets.forEach((offset) => {
    const ruleY = y + offset;
    doc.line(PAGE_MARGIN_X, ruleY, ruleEndLeft, ruleY);
    doc.line(ruleStartRight, ruleY, pageWidth - PAGE_MARGIN_X, ruleY);
  });
}

/**
 * Encabezado tipo "diploma": kicker pequeño (GUÍA DE ESTUDIO), título grande
 * con el nombre del mazo, y firma de la app — inspirado en la referencia que
 * Cesar aprobó.
 */
function drawTitleBlock(doc, kickerLabel, deckTitle, subtitleLabel) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const maxTextWidth = pageWidth - (PAGE_MARGIN_X * 2) - 20;

  // Kicker: "GUÍA DE ESTUDIO"
  doc.setLineWidth(0.35);
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(KICKER_COLOR.r, KICKER_COLOR.g, KICKER_COLOR.b);
  drawFlankedLine(doc, kickerLabel.toUpperCase(), 13, false);

  // Título grande: nombre del mazo
  const titleSize = fitTextSize(doc, deckTitle.toUpperCase(), maxTextWidth, 30, 16, 'times', 'bold');
  doc.setFont('times', 'bold');
  doc.setFontSize(titleSize);
  doc.setTextColor(INK_COLOR.r, INK_COLOR.g, INK_COLOR.b);
  doc.text(deckTitle.toUpperCase(), centerX, 26, { align: 'center' });

  // Firma: "N Tarjetas - UnderFlashCards"
  doc.setLineWidth(0.3);
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(SUBTITLE_COLOR.r, SUBTITLE_COLOR.g, SUBTITLE_COLOR.b);
  drawFlankedLine(doc, subtitleLabel, 35, true);
}

function drawRunningHeader(doc, deckTitle, exportTitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(RUNNING_HEADER_COLOR.r, RUNNING_HEADER_COLOR.g, RUNNING_HEADER_COLOR.b);
  doc.text(`${deckTitle} — ${exportTitle}`, PAGE_MARGIN_X, 10);

  doc.setDrawColor(DIVIDER_COLOR.r, DIVIDER_COLOR.g, DIVIDER_COLOR.b);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN_X, 12.5, pageWidth - PAGE_MARGIN_X, 12.5);
}

async function renderAnswerKey(doc, items, config, context, deckTitle, geometry, pageHeight, answerFallbackSize) {
  const title = 'Respuestas';
  const columns = config.columns || 1;
  const bottomLimit = pageHeight - BODY_BOTTOM_MARGIN;
  let pageBodyTop = BODY_TOP_FIRST_PAGE;
  let columnIndex = 0;
  let cursorY = pageBodyTop;

  doc.addPage();
  drawTitleBlock(doc, title, deckTitle, `${items.length} Respuestas - ${APP_NAME}`);
  drawColumnDividers(doc, columns, geometry, pageBodyTop, bottomLimit);

  const moveToNextColumnOrPage = () => {
    if (columnIndex < columns - 1) {
      columnIndex += 1;
    } else {
      doc.addPage();
      drawRunningHeader(doc, deckTitle, title);
      pageBodyTop = BODY_TOP_OTHER_PAGES;
      drawColumnDividers(doc, columns, geometry, pageBodyTop, bottomLimit);
      columnIndex = 0;
    }
    cursorY = pageBodyTop;
  };

  for (let index = 0; index < items.length; index += 1) {
    context.throwIfCancelled();
    const item = items[index];
    const answerStyle = resolveContentTextStyle(item, 'answer', answerFallbackSize);
    setPdfTextStyle(doc, answerStyle);
    const lines = doc.splitTextToSize(`${index + 1}) ${item.answer || 'Sin respuesta configurada'}`, geometry.columnWidth);
    const lineHeight = mmFromPt(answerStyle.size) * 1.35;
    const height = lines.length * lineHeight;

    if (cursorY + height > bottomLimit && cursorY > pageBodyTop) {
      moveToNextColumnOrPage();
    }

    setPdfTextStyle(doc, answerStyle);
    const drawX = geometry.columnsX[columnIndex];
    lines.forEach((line) => {
      doc.text(line, drawX, cursorY + mmFromPt(answerStyle.size));
      cursorY += lineHeight;
    });
    cursorY += ITEM_GAP;

    await context.yield();
  }
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

// mode:'contain' preserva la imagen COMPLETA (nunca recorta), ajustándola
// dentro de maxWidth x maxHeight conservando su proporción original.
async function prepareSectionImage(source, context, cardIndex, maxWidth, maxHeight) {
  if (!source) return null;

  const result = await prepareImageAsset(source, {
    mode: 'contain',
    signal: context.signal,
    assetCache: context.imageAssetCache,
    sourceBlobCache: context.sourceBlobCache,
  });

  if (result.warning) context.warn(result.warning, cardIndex);

  if (!result.asset) {
    return { failed: true, frameWidth: maxWidth + (FRAME_PADDING * 2), frameHeight: PLACEHOLDER_INNER_HEIGHT + (FRAME_PADDING * 2) };
  }

  context.consumeImageAsset(result.asset);
  const dimensions = fitContain(result.asset, maxWidth, maxHeight);
  return {
    failed: false,
    asset: result.asset,
    dimensions,
    frameWidth: dimensions.width + (FRAME_PADDING * 2),
    frameHeight: dimensions.height + (FRAME_PADDING * 2),
  };
}

// Dibuja el marco (contorno + mat) ajustado EXACTAMENTE al tamaño ya
// resuelto de la imagen (imageResult.frameWidth/frameHeight) — nunca fuerza
// una caja más grande que deje huecos, ni recorta para llenarla.
function drawImageFrame(doc, x, y, imageResult) {
  const { frameWidth, frameHeight } = imageResult;

  doc.setDrawColor(RULE_COLOR.r, RULE_COLOR.g, RULE_COLOR.b);
  doc.setLineWidth(FRAME_BORDER_WIDTH);
  doc.rect(x, y, frameWidth, frameHeight);

  if (imageResult.failed) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(PLACEHOLDER_COLOR.r, PLACEHOLDER_COLOR.g, PLACEHOLDER_COLOR.b);
    doc.text('Imagen no disponible', x + (frameWidth / 2), y + (frameHeight / 2) + 1, { align: 'center' });
    return;
  }

  doc.addImage(
    imageResult.asset.data,
    imageResult.asset.format,
    x + FRAME_PADDING,
    y + FRAME_PADDING,
    imageResult.dimensions.width,
    imageResult.dimensions.height,
    undefined,
    'FAST'
  );
}

/**
 * Renderiza el documento de contenido (Guía de Estudio / Banco de Preguntas /
 * Banco de Respuestas): encabezado tipo diploma + columnas densas tipo examen.
 */
export async function renderContentDocument(doc, items, config, context) {
  context.throwIfCancelled();

  const columns = config.columns || 1;
  const geometry = getColumnGeometry(doc, columns);
  const pageHeight = doc.internal.pageSize.getHeight();
  const questionFallbackSize = columns >= 3 ? 8.5 : 10.5;
  const answerFallbackSize = columns >= 3 ? 8 : 10;

  const deckTitle = context.deckTitle || 'Mazo';
  const itemLabel = getItemLabel(config, items.length);
  const subtitleLabel = `${itemLabel} - ${APP_NAME}`;

  drawTitleBlock(doc, config.title, deckTitle, subtitleLabel);
  let pageBodyTop = BODY_TOP_FIRST_PAGE;
  drawColumnDividers(doc, columns, geometry, pageBodyTop, pageHeight - BODY_BOTTOM_MARGIN);

  let columnIndex = 0;
  let cursorY = pageBodyTop;

  const moveToNextColumnOrPage = () => {
    if (columnIndex < columns - 1) {
      columnIndex += 1;
    } else {
      doc.addPage();
      drawRunningHeader(doc, deckTitle, config.title);
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

    // El modelo de datos guarda una sola imagen por card (item.contentImage)
    // más item.imageSide indicando a cuál sección pertenece — igual que en
    // printableCardsRenderer.js. No hay campos separados de pregunta/respuesta.
    const showImageOnQuestion = config.sections.includes('question')
      && Boolean(item.contentImage) && item.imageSide === 'question';
    const showImageOnAnswer = config.sections.includes('answer')
      && Boolean(item.contentImage) && item.imageSide === 'answer';

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

      if (showImageOnQuestion) {
        const maxWidth = geometry.columnWidth - (FRAME_PADDING * 2);
        questionImage = await prepareSectionImage(item.contentImage, context, index, maxWidth, MAX_IMAGE_HEIGHT);
        questionHeight += questionImage.frameHeight + IMAGE_GAP;
      }
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

      if (showImageOnAnswer) {
        const maxWidth = (geometry.columnWidth - 3) - (FRAME_PADDING * 2);
        answerImage = await prepareSectionImage(item.contentImage, context, index, maxWidth, MAX_IMAGE_HEIGHT);
        answerHeight += answerImage.frameHeight + IMAGE_GAP;
      }
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
        drawImageFrame(doc, drawX, cursorY, questionImage);
        cursorY += questionImage.frameHeight;
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
        drawImageFrame(doc, drawX + 3, cursorY, answerImage);
        cursorY += answerImage.frameHeight;
      }
    }

    cursorY += ITEM_GAP;

    context.reportProgress(index + 1, items.length, `Procesando elemento ${index + 1} de ${items.length}`);
    await context.yield();
  }

  if (config.answerKeyAtEnd) {
    context.reportProgress(items.length, items.length, 'Preparando clave de respuestas...');
    await renderAnswerKey(doc, items, config, context, deckTitle, geometry, pageHeight, answerFallbackSize);
  }

  drawFooters(doc, deckTitle);
}
