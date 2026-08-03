import { getPageMetrics, createPdfDocument, createPdfFileName } from '../document.js';
import { formatDuration, getDurationMinutes, timeToMinutes } from '../../../components/library/calendar/scheduleUtils.js';
import { getSchedulePdfColors } from './schedulePdfColors.js';
import { createSchedulePdfLayout } from './schedulePdfLayout.js';

const WEEKDAYS = ['Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado', 'Domingo'];

function createAbortError() {
  const error = new Error('La exportaciÃ³n fue cancelada.');
  error.name = 'AbortError';
  return error;
}

function safeTime(value) {
  return timeToMinutes(value) === null ? '--:--' : value;
}

function formatHour(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function throwIfCancelled(signal) {
  if (signal?.aborted) throw createAbortError();
}

function drawHeader(doc, scheduleName, orientation, pageNumber, pageCount) {
  const metrics = getPageMetrics(doc, orientation === 'landscape' ? 10 : 14);
  const x = metrics.margin;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(String(scheduleName || 'Horario'), x, metrics.top + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('HORARIO Â· UNDER FLASHCARDS', x, metrics.top + 13);
  doc.text(`${orientation === 'landscape' ? 'Horizontal' : 'Vertical'} Â· ${pageNumber}/${pageCount}`, metrics.width - metrics.margin, metrics.top + 13, { align: 'right' });
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(x, metrics.top + 17, metrics.width - metrics.margin, metrics.top + 17);
  return { metrics, top: metrics.top + 23 };
}

function drawFooter(doc, metrics) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Under Flashcards', metrics.margin, metrics.height - 6);
}

function drawWrappedBlockText(doc, item, x, y, width, height, subjectColors) {
  const colors = getSchedulePdfColors(item, subjectColors);
  doc.setFillColor(colors.surface.r, colors.surface.g, colors.surface.b);
  doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.setLineWidth(0.65);
  doc.roundedRect(x, y, width, Math.max(8, height), 1.5, 1.5, 'FD');

  const innerWidth = Math.max(10, width - 4);
  const innerHeight = Math.max(2, height - 3);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(height < 7 ? 4.8 : (width < 30 ? 5.6 : 7.2));
  const subjectLines = doc.splitTextToSize(String(item.subject || 'Asignatura'), innerWidth);
  const maxLines = Math.max(1, Math.floor(innerHeight / 3.2));
  const lines = subjectLines.slice(0, maxLines);
  if (subjectLines.length > maxLines && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\.\.\.$/, '')}...`;
  }
  if (height >= 3.5) doc.text(lines, x + 2, y + Math.min(3.2, Math.max(1.8, height - 0.8)), { maxWidth: innerWidth });

  if (height >= 15 && maxLines >= 2) {
    const details = [
      `${safeTime(item.startTime)} â€“ ${safeTime(item.endTime)} Â· ${formatDuration(getDurationMinutes(item))}`,
      [item.teacher, item.room].filter((value) => value && !['Sin profesor', 'Por definir'].includes(value)).join(' Â· '),
    ].filter(Boolean);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(width < 30 ? 4.3 : 5.5);
    doc.setTextColor(71, 85, 105);
    doc.text(details.slice(0, height >= 24 ? 2 : 1), x + 2, y + 4 + (lines.length * 3.2), { maxWidth: innerWidth });
  }
}

function renderLandscapePage(doc, page, subjectColors, header) {
  const { metrics, top } = header;
  const timeLabelWidth = 14;
  const dayHeaderHeight = 9;
  const gridTop = top + dayHeaderHeight;
  const gridBottom = metrics.bottom - 8;
  const gridHeight = Math.max(30, gridBottom - gridTop);
  const gridWidth = metrics.contentWidth - timeLabelWidth;
  const dayWidth = gridWidth / page.days.length;
  const duration = Math.max(1, page.timeRange.end - page.timeRange.start);
  const scale = gridHeight / duration;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  page.days.forEach((day, index) => {
    const x = metrics.margin + timeLabelWidth + (index * dayWidth);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, top, dayWidth, dayHeaderHeight, 'FD');
    doc.text(WEEKDAYS[day.dayIndex], x + (dayWidth / 2), top + 5.7, { align: 'center', maxWidth: dayWidth - 2 });
  });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  for (let minute = Math.ceil(page.timeRange.start / 60) * 60; minute <= page.timeRange.end; minute += 60) {
    const y = gridTop + ((minute - page.timeRange.start) * scale);
    doc.line(metrics.margin + timeLabelWidth, y, metrics.width - metrics.margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(formatHour(minute), metrics.margin, y + 2, { maxWidth: timeLabelWidth - 2 });
  }

  page.days.forEach((day, index) => {
    const x = metrics.margin + timeLabelWidth + (index * dayWidth);
    doc.line(x, gridTop, x, gridBottom);
    day.classes.forEach((item) => {
      const start = timeToMinutes(item.startTime);
      const end = timeToMinutes(item.endTime);
      if (start === null || end === null || end <= page.timeRange.start || start >= page.timeRange.end) return;
      const clippedStart = Math.max(start, page.timeRange.start);
      const clippedEnd = Math.min(end, page.timeRange.end);
      const y = gridTop + ((clippedStart - page.timeRange.start) * scale) + 0.8;
      const height = Math.max(1.8, ((clippedEnd - clippedStart) * scale) - 1.6);
      drawWrappedBlockText(doc, item, x + 1.3, y, dayWidth - 2.6, height, subjectColors);
    });
  });
}

function renderPortraitPage(doc, page, subjectColors, header) {
  const { metrics, top } = header;
  const day = page.days[0];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(WEEKDAYS[day.dayIndex], metrics.margin, top + 2);

  if (day.classes.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Sin clases programadas.', metrics.margin, top + 18);
    return;
  }

  const timelineX = metrics.margin + 19;
  const timelineTop = top + 12;
  const timelineBottom = metrics.bottom - 9;
  const timelineHeight = Math.max(50, timelineBottom - timelineTop);
  const duration = Math.max(1, page.timeRange.end - page.timeRange.start);
  const scale = timelineHeight / duration;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.55);
  doc.line(timelineX, timelineTop, timelineX, timelineBottom);
  for (let minute = Math.ceil(page.timeRange.start / 60) * 60; minute <= page.timeRange.end; minute += 60) {
    const y = timelineTop + ((minute - page.timeRange.start) * scale);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(formatHour(minute), metrics.margin, y + 2, { maxWidth: 15 });
    doc.setDrawColor(226, 232, 240);
    doc.line(timelineX, y, metrics.width - metrics.margin, y);
  }

  day.classes.forEach((item) => {
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);
    if (start === null || end === null || end <= start) return;
    if (end <= page.timeRange.start || start >= page.timeRange.end) return;
    const clippedStart = Math.max(start, page.timeRange.start);
    const clippedEnd = Math.min(end, page.timeRange.end);
    const y = timelineTop + ((clippedStart - page.timeRange.start) * scale) + 1;
    const height = Math.max(1.8, ((clippedEnd - clippedStart) * scale) - 2);
    drawWrappedBlockText(doc, item, timelineX + 3, y, metrics.width - timelineX - 3, height, subjectColors);
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
    if (page.type === 'week') renderLandscapePage(doc, page, subjectColors, header);
    else if (page.type === 'day') renderPortraitPage(doc, page, subjectColors, header);
    else {
      const metrics = header.metrics;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text('Este horario todavÃ­a no tiene clases.', metrics.margin, header.top + 18);
    }
    drawFooter(doc, header.metrics);
    onProgress?.({
      phase: 'rendering',
      current: index + 1,
      total: layout.pages.length,
      message: `Preparando pÃ¡gina ${index + 1} de ${layout.pages.length}...`,
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