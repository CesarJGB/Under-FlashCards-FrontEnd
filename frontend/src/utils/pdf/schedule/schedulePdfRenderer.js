import { getPageMetrics, createPdfDocument, createPdfFileName } from '../document.js';
import { formatDuration, getDurationMinutes, timeToMinutes } from '../../../components/library/calendar/scheduleUtils.js';
import { getSchedulePdfColors } from './schedulePdfColors.js';
import { createSchedulePdfLayout } from './schedulePdfLayout.js';

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const INK = { r: 15, g: 23, b: 42 };
const MUTED = { r: 100, g: 116, b: 139 };
const GRID = { r: 226, g: 232, b: 240 };

function createAbortError() {
  const error = new Error('La exportación fue cancelada.');
  error.name = 'AbortError';
  return error;
}

function throwIfCancelled(signal) {
  if (signal?.aborted) throw createAbortError();
}

function setFill(doc, color) {
  doc.setFillColor(color.r, color.g, color.b);
}

function setStroke(doc, color) {
  doc.setDrawColor(color.r, color.g, color.b);
}

function setText(doc, color) {
  doc.setTextColor(color.r, color.g, color.b);
}

function safeTime(value) {
  return timeToMinutes(value) === null ? '--:--' : value;
}

function formatHour(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function getClassesDuration(classes = []) {
  return classes.reduce((total, item) => total + getDurationMinutes(item), 0);
}

function getPageClasses(page) {
  return page.days.flatMap((day) => day.classes || []);
}

function ellipsizeLines(doc, value, width, maximumLines) {
  const lines = doc.splitTextToSize(String(value || ''), Math.max(4, width));
  if (lines.length <= maximumLines) return lines;
  const visible = lines.slice(0, maximumLines);
  visible[visible.length - 1] = `${String(visible[visible.length - 1]).replace(/[.…]+$/, '')}…`;
  return visible;
}

function drawHeader(doc, scheduleName, orientation, pageNumber, pageCount) {
  const metrics = getPageMetrics(doc, orientation === 'landscape' ? 10 : 14);
  const x = metrics.margin;
  const width = metrics.contentWidth;

  setFill(doc, { r: 248, g: 250, b: 252 });
  setStroke(doc, GRID);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, metrics.top, width, 20, 2.5, 2.5, 'FD');
  setFill(doc, { r: 99, g: 102, b: 241 });
  doc.roundedRect(x + 4, metrics.top + 4, 2.2, 11.8, 1.1, 1.1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  setText(doc, INK);
  doc.text(String(scheduleName || 'Horario'), x + 9, metrics.top + 9.4, { maxWidth: width - 74 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.3);
  setText(doc, MUTED);
  doc.text('UNDER FLASHCARDS · HORARIO ACADÉMICO', x + 9, metrics.top + 14.3);

  const mode = orientation === 'landscape' ? 'VISTA SEMANAL' : 'UNA HOJA POR DÍA';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  setText(doc, { r: 79, g: 70, b: 229 });
  doc.text(mode, metrics.width - metrics.margin - 3.5, metrics.top + 8.7, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.1);
  setText(doc, MUTED);
  doc.text(`Página ${pageNumber} de ${pageCount}`, metrics.width - metrics.margin - 3.5, metrics.top + 14.1, { align: 'right' });

  return { metrics, top: metrics.top + 27 };
}

function drawFooter(doc, metrics) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  setText(doc, MUTED);
  doc.text('Under Flashcards · Horario listo para imprimir', metrics.margin, metrics.height - 6);
}

function drawEventBlock(doc, item, x, y, width, height, subjectColors) {
  if (height < 1.4 || width < 4) return;

  const colors = getSchedulePdfColors(item, subjectColors);
  const blockHeight = Math.max(1.4, height);
  setFill(doc, colors.surface);
  setStroke(doc, colors.border);
  doc.setLineWidth(0.28);
  doc.roundedRect(x, y, width, blockHeight, 1.15, 1.15, 'FD');
  setFill(doc, colors.accent);
  doc.roundedRect(x, y, Math.min(1.45, width), blockHeight, 1.15, 1.15, 'F');

  const contentX = x + Math.min(3.1, width - 1.5);
  const contentWidth = Math.max(2, width - (contentX - x) - 1.2);
  const timeLine = `${safeTime(item.startTime)} – ${safeTime(item.endTime)}`;

  if (blockHeight < 4.1) return;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(width < 30 ? 3.9 : 5.1);
  setText(doc, colors.accent);
  doc.text(timeLine, contentX, y + 2.45, { maxWidth: contentWidth });

  if (blockHeight < 6.2) return;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(width < 30 ? 4.45 : 6.2);
  setText(doc, INK);
  const titleLines = ellipsizeLines(doc, item.subject || 'Asignatura', contentWidth, blockHeight < 9 ? 1 : 2);
  doc.text(titleLines, contentX, y + 4.7, { maxWidth: contentWidth, lineHeightFactor: 0.95 });

  if (blockHeight < 14) return;
  const detail = [item.teacher, item.room].filter((value) => value && !['Sin profesor', 'Por definir'].includes(value)).join(' · ');
  const duration = formatDuration(getDurationMinutes(item));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(width < 30 ? 3.8 : 5.1);
  setText(doc, MUTED);
  const detailY = y + 4.9 + (titleLines.length * (width < 30 ? 3.55 : 4.7));
  doc.text(detail || duration, contentX, Math.min(y + blockHeight - 2, detailY), { maxWidth: contentWidth });
}

function drawTimeGrid(doc, { metrics, gridLeft, gridRight, top, bottom, timeRange, labelWidth }) {
  const duration = Math.max(1, timeRange.end - timeRange.start);
  const scale = (bottom - top) / duration;

  for (let minute = timeRange.start; minute <= timeRange.end; minute += 30) {
    const y = top + ((minute - timeRange.start) * scale);
    const isHour = minute % 60 === 0;
    setStroke(doc, isHour ? GRID : { r: 241, g: 245, b: 249 });
    doc.setLineWidth(isHour ? 0.3 : 0.16);
    doc.line(gridLeft, y, gridRight, y);
    if (isHour) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.6);
      setText(doc, MUTED);
      doc.text(formatHour(minute), gridLeft - 2.1, y + 1.8, { align: 'right', maxWidth: labelWidth - 2 });
    }
  }

  return scale;
}

function drawLandscapePage(doc, page, subjectColors, header) {
  const { metrics, top } = header;
  const timeLabelWidth = 15;
  const dayHeaderHeight = 10.5;
  const summaryHeight = 7;
  const dayHeaderTop = top + summaryHeight;
  const gridTop = dayHeaderTop + dayHeaderHeight;
  const gridBottom = metrics.bottom - 9;
  const gridWidth = metrics.contentWidth - timeLabelWidth;
  const dayWidth = gridWidth / page.days.length;
  const allClasses = getPageClasses(page);
  const totalMinutes = getClassesDuration(allClasses);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  setText(doc, MUTED);
  doc.text(`${allClasses.length} clases · ${formatDuration(totalMinutes)} ocupadas`, metrics.margin + timeLabelWidth, top + 4.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  setText(doc, { r: 79, g: 70, b: 229 });
  doc.text(`${formatHour(page.timeRange.start)} – ${formatHour(page.timeRange.end)}`, metrics.width - metrics.margin, top + 4.2, { align: 'right' });

  page.days.forEach((day, index) => {
    const x = metrics.margin + timeLabelWidth + (index * dayWidth);
    setFill(doc, { r: 248, g: 250, b: 252 });
    setStroke(doc, GRID);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 0.45, dayHeaderTop, dayWidth - 0.9, dayHeaderHeight, 1.3, 1.3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(dayWidth < 34 ? 6 : 7.1);
    setText(doc, INK);
    doc.text(WEEKDAYS[day.dayIndex], x + (dayWidth / 2), dayHeaderTop + 4.2, { align: 'center', maxWidth: dayWidth - 3 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.1);
    setText(doc, MUTED);
    doc.text(day.classes.length ? `${day.classes.length} bloque${day.classes.length === 1 ? '' : 's'}` : 'Disponible', x + (dayWidth / 2), dayHeaderTop + 7.3, { align: 'center', maxWidth: dayWidth - 3 });
    setStroke(doc, GRID);
    doc.line(x, gridTop, x, gridBottom);
  });
  setStroke(doc, GRID);
  doc.line(metrics.width - metrics.margin, gridTop, metrics.width - metrics.margin, gridBottom);

  const scale = drawTimeGrid(doc, {
    metrics,
    gridLeft: metrics.margin + timeLabelWidth,
    gridRight: metrics.width - metrics.margin,
    top: gridTop,
    bottom: gridBottom,
    timeRange: page.timeRange,
    labelWidth: timeLabelWidth,
  });

  page.days.forEach((day, index) => {
    const x = metrics.margin + timeLabelWidth + (index * dayWidth);
    day.classes.forEach((item) => {
      const start = timeToMinutes(item.startTime);
      const end = timeToMinutes(item.endTime);
      if (start === null || end === null || end <= page.timeRange.start || start >= page.timeRange.end) return;
      const clippedStart = Math.max(start, page.timeRange.start);
      const clippedEnd = Math.min(end, page.timeRange.end);
      const y = gridTop + ((clippedStart - page.timeRange.start) * scale) + 0.8;
      const height = Math.max(1.4, ((clippedEnd - clippedStart) * scale) - 1.6);
      drawEventBlock(doc, item, x + 1.2, y, dayWidth - 2.4, height, subjectColors);
    });
  });
}

function drawPortraitPage(doc, page, subjectColors, header) {
  const { metrics, top } = header;
  const day = page.days[0];
  const totalMinutes = getClassesDuration(day.classes);
  const timelineX = metrics.margin + 21;
  const timelineTop = top + 21;
  const timelineBottom = metrics.bottom - 13;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.2);
  setText(doc, INK);
  doc.text(WEEKDAYS[day.dayIndex], metrics.margin, top + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  setText(doc, MUTED);
  doc.text(day.classes.length ? `${day.classes.length} clases · ${formatDuration(totalMinutes)} programadas` : 'Sin clases programadas', metrics.margin, top + 10.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  setText(doc, { r: 79, g: 70, b: 229 });
  doc.text(`${formatHour(page.timeRange.start)} – ${formatHour(page.timeRange.end)}`, metrics.width - metrics.margin, top + 7.6, { align: 'right' });

  setStroke(doc, { r: 203, g: 213, b: 225 });
  doc.setLineWidth(0.55);
  doc.line(timelineX, timelineTop, timelineX, timelineBottom);
  const scale = drawTimeGrid(doc, {
    metrics,
    gridLeft: timelineX,
    gridRight: metrics.width - metrics.margin,
    top: timelineTop,
    bottom: timelineBottom,
    timeRange: page.timeRange,
    labelWidth: 18,
  });

  if (day.classes.length === 0) {
    const emptyY = timelineTop + ((timelineBottom - timelineTop) / 2);
    setFill(doc, { r: 248, g: 250, b: 252 });
    setStroke(doc, GRID);
    doc.setLineWidth(0.25);
    doc.roundedRect(timelineX + 8, emptyY - 8, metrics.width - metrics.margin - timelineX - 16, 16, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(doc, MUTED);
    doc.text('Día sin clases', metrics.width / 2, emptyY - 1, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Espacio disponible para estudio o descanso.', metrics.width / 2, emptyY + 3.6, { align: 'center' });
    return;
  }

  day.classes.forEach((item) => {
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);
    if (start === null || end === null || end <= page.timeRange.start || start >= page.timeRange.end) return;
    const clippedStart = Math.max(start, page.timeRange.start);
    const clippedEnd = Math.min(end, page.timeRange.end);
    const y = timelineTop + ((clippedStart - page.timeRange.start) * scale) + 1;
    const height = Math.max(1.4, ((clippedEnd - clippedStart) * scale) - 2);
    drawEventBlock(doc, item, timelineX + 3.5, y, metrics.width - metrics.margin - timelineX - 3.5, height, subjectColors);
  });
}

export async function renderSchedulePdf({
  scheduleName,
  classes = [],
  daysCount = 5,
  subjectColors = [],
  orientation = 'portrait',
  signal,
  onProgress,
}) {
  throwIfCancelled(signal);
  const safeOrientation = orientation === 'landscape' ? 'landscape' : 'portrait';
  const layout = createSchedulePdfLayout({ classes, daysCount, orientation: safeOrientation });
  const doc = createPdfDocument({ orientation: safeOrientation, format: 'a4', unit: 'mm' });

  for (let index = 0; index < layout.pages.length; index += 1) {
    throwIfCancelled(signal);
    if (index > 0) doc.addPage(undefined, safeOrientation);
    const page = layout.pages[index];
    const header = drawHeader(doc, scheduleName, safeOrientation, index + 1, layout.pages.length);
    if (page.type === 'week') drawLandscapePage(doc, page, subjectColors, header);
    else drawPortraitPage(doc, page, subjectColors, header);
    drawFooter(doc, header.metrics);
    onProgress?.({
      phase: 'rendering',
      current: index + 1,
      total: layout.pages.length,
      message: `Preparando página ${index + 1} de ${layout.pages.length}...`,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throwIfCancelled(signal);
  onProgress?.({ phase: 'saving', current: layout.pages.length, total: layout.pages.length, message: 'Preparando la descarga...' });
  return {
    buffer: doc.output('arraybuffer'),
    fileName: createPdfFileName(scheduleName || 'Horario', safeOrientation === 'landscape' ? 'horizontal' : 'vertical'),
    pagesProcessed: layout.pages.length,
  };
}
