import { createPdfDocument, createPdfFileName, getPageMetrics } from '../document.js';
import {
  formatFreeTime,
  formatScheduleDuration,
  getScheduleGaps,
  getScheduleStats,
  minutesToTime,
  timeToMinutes,
} from '../../../components/library/calendar/scheduleTimeline.js';
import { getSchedulePdfColors } from './schedulePdfColors.js';
import { createSchedulePdfLayout } from './schedulePdfLayout.js';

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const INK = { r: 15, g: 23, b: 42 };
const MUTED = { r: 100, g: 116, b: 139 };
const GRID = { r: 226, g: 232, b: 240 };
const SOFT = { r: 248, g: 250, b: 252 };
const INDIGO = { r: 79, g: 70, b: 229 };

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

export function sanitizeSchedulePdfText(value) {
  return String(value ?? '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u00b7]/g, '|')
    .replace(/[^\x20-\x7E\u00C0-\u00FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeTime(value) {
  return timeToMinutes(value) === null ? '--:--' : value;
}

function fitSingleLine(doc, value, width) {
  const text = sanitizeSchedulePdfText(value);
  if (doc.getTextWidth(text) <= width) return text;
  const suffix = '...';
  let visible = text;
  while (visible.length > 1 && doc.getTextWidth(`${visible}${suffix}`) > width) {
    visible = visible.slice(0, -1);
  }
  return `${visible.trimEnd()}${suffix}`;
}

function fitLines(doc, value, width, maximumLines) {
  const lines = doc.splitTextToSize(sanitizeSchedulePdfText(value), Math.max(4, width));
  if (lines.length <= maximumLines) return lines;
  const visible = lines.slice(0, maximumLines);
  visible[visible.length - 1] = fitSingleLine(doc, visible[visible.length - 1], width);
  return visible;
}

function getClassesDuration(classes = []) {
  return classes.reduce((total, item) => {
    const start = timeToMinutes(item?.startTime);
    const end = timeToMinutes(item?.endTime);
    return total + (start !== null && end !== null && end > start ? end - start : 0);
  }, 0);
}

function getLandscapeTypography(width) {
  // Keep type primarily tied to the column width. A two-hour block should
  // have more content, not an exaggerated font that changes with its height.
  if (width < 27) return { title: 4.25, meta: 3.65, time: 3.75, lineHeight: 2.05 };
  if (width < 34) return { title: 4.8, meta: 4.05, time: 4.05, lineHeight: 2.25 };
  return { title: 5.55, meta: 4.45, time: 4.35, lineHeight: 2.55 };
}

function drawHeader(doc, {
  scheduleName,
  orientation,
  pageNumber,
  pageCount,
  stats,
  hiddenEventCount,
}) {
  const metrics = getPageMetrics(doc, orientation === 'landscape' ? 10 : 11);
  const x = metrics.margin;
  const width = metrics.contentWidth;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  setText(doc, INDIGO);
  doc.text('UNDER FLASHCARDS | HORARIO ACADÉMICO', x, metrics.top + 3.6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(orientation === 'landscape' ? 16 : 15);
  setText(doc, INK);
  doc.text(fitSingleLine(doc, scheduleName || 'Horario', width - 56), x, metrics.top + 11);

  const mode = orientation === 'landscape' ? 'SEMANA EN CUADRÍCULA' : 'SEMANA COMPACTA';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  setText(doc, INDIGO);
  doc.text(mode, metrics.width - metrics.margin, metrics.top + 5, { align: 'right' });
  if (pageCount > 1) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.1);
    setText(doc, MUTED);
    doc.text(`Página ${pageNumber} de ${pageCount}`, metrics.width - metrics.margin, metrics.top + 10, { align: 'right' });
  }

  const summary = [
    `${stats.eventCount} ${stats.eventCount === 1 ? 'clase' : 'clases'}`,
    `${formatScheduleDuration(stats.totalMinutes)} programadas`,
    stats.largestGap ? `mayor hueco: ${formatFreeTime(stats.largestGap.durationMinutes)}` : null,
    stats.invalidEventCount > 0 ? `${stats.invalidEventCount} con horario inválido` : null,
    hiddenEventCount > 0 ? `${hiddenEventCount} ${hiddenEventCount === 1 ? 'clase oculta no incluida' : 'clases ocultas no incluidas'}` : null,
  ].filter(Boolean).join(' | ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  setText(doc, MUTED);
  doc.text(fitSingleLine(doc, summary, width), x, metrics.top + 16.2);

  setStroke(doc, GRID);
  doc.setLineWidth(0.3);
  doc.line(x, metrics.top + 20.4, metrics.width - metrics.margin, metrics.top + 20.4);

  return { metrics, top: metrics.top + 24.5 };
}

function drawFooter(doc, metrics, pageNumber, pageCount) {
  if (pageCount <= 1) return;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.1);
  setText(doc, MUTED);
  doc.text('Under Flashcards | Horario académico', metrics.margin, metrics.height - 5.5);
  doc.text(`${pageNumber} / ${pageCount}`, metrics.width - metrics.margin, metrics.height - 5.5, { align: 'right' });
}

function drawLandscapeEvent(doc, item, x, y, width, height, subjectColors) {
  if (height < 1 || width < 5) return;
  const colors = getSchedulePdfColors(item, subjectColors);
  const blockHeight = Math.max(1, height);
  setFill(doc, colors.surface);
  setStroke(doc, colors.border);
  doc.setLineWidth(0.24);
  doc.roundedRect(x, y, width, blockHeight, 1, 1, 'FD');
  setFill(doc, colors.accent);
  doc.roundedRect(x, y, Math.min(1.35, width), blockHeight, 0.8, 0.8, 'F');

  const contentX = x + 2.5;
  const contentWidth = Math.max(2, width - 3.6);
  const startTime = safeTime(item.startTime);
  const endTime = safeTime(item.endTime);
  const title = item.subject || item.title || 'Asignatura';
  const typography = getLandscapeTypography(width);
  const duration = formatScheduleDuration(getClassesDuration([item]));
  const timeRange = `${startTime} - ${endTime}`;

  if (blockHeight < 3.4) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(typography.time);
    setText(doc, colors.accent);
    doc.text(startTime, contentX, y + (blockHeight / 2) + 0.7, { maxWidth: contentWidth });
    return;
  }

  if (blockHeight < 6.2) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(typography.title);
    setText(doc, INK);
    doc.text(fitSingleLine(doc, title, contentWidth), contentX, y + 2.25, { maxWidth: contentWidth });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(typography.meta);
    setText(doc, colors.accent);
    doc.text(fitSingleLine(doc, `${timeRange} · ${duration}`, contentWidth), contentX, y + blockHeight - 1.15, { maxWidth: contentWidth });
    return;
  }

  const roomy = blockHeight >= 10.5;
  const titleLines = fitLines(doc, title, contentWidth, roomy ? 2 : 1);
  const detail = [item.teacher, item.room]
    .filter((value) => value && !['Sin profesor', 'Por definir'].includes(value))
    .join(' · ');
  let cursorY = y + 2.25;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(typography.title);
  setText(doc, INK);
  doc.text(titleLines, contentX, cursorY, { maxWidth: contentWidth, lineHeightFactor: 0.9 });
  cursorY += (titleLines.length * typography.lineHeight) + 1.1;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(typography.time);
  setText(doc, colors.accent);
  doc.text(fitSingleLine(doc, `${timeRange} · ${duration}`, contentWidth), contentX, cursorY, { maxWidth: contentWidth });
  cursorY += 2.25;

  if (roomy && detail) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(typography.meta);
    setText(doc, MUTED);
    doc.text(fitSingleLine(doc, detail, contentWidth), contentX, Math.min(y + blockHeight - 1.25, cursorY), { maxWidth: contentWidth });
  }
}

function drawGapArea(doc, gap, x, y, width, height) {
  if (height < 0.45 || width < 5) return;
  setFill(doc, { r: 250, g: 251, b: 253 });
  doc.rect(x, y, width, Math.max(0.45, height), 'F');
  setStroke(doc, { r: 203, g: 213, b: 225 });
  doc.setLineWidth(0.18);
  doc.setLineDashPattern([1.1, 1.1], 0);
  doc.line(x, y + 0.2, x + width, y + 0.2);
  doc.line(x, y + Math.max(0.25, height - 0.2), x + width, y + Math.max(0.25, height - 0.2));
  doc.setLineDashPattern([], 0);

  if (height >= 3.4) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.4);
    setText(doc, MUTED);
    doc.text(formatFreeTime(gap.durationMinutes), x + (width / 2), y + (height / 2) + 0.75, { align: 'center', maxWidth: width - 2 });
  }
}

function drawTimeGrid(doc, { gridLeft, gridRight, top, bottom, timeRange, labelWidth }) {
  const duration = Math.max(1, timeRange.end - timeRange.start);
  const scale = (bottom - top) / duration;

  for (let minute = timeRange.start; minute <= timeRange.end; minute += 30) {
    const y = top + ((minute - timeRange.start) * scale);
    const isHour = minute % 60 === 0;
    setStroke(doc, isHour ? GRID : { r: 241, g: 245, b: 249 });
    doc.setLineWidth(isHour ? 0.28 : 0.14);
    doc.line(gridLeft, y, gridRight, y);
    if (isHour) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.4);
      setText(doc, MUTED);
      doc.text(minutesToTime(minute), gridLeft - 2, y + 1.7, { align: 'right', maxWidth: labelWidth - 2 });
    }
  }
  return scale;
}

function drawLandscapePage(doc, page, subjectColors, header, pageCount) {
  const { metrics, top } = header;
  const timeLabelWidth = 14;
  const dayHeaderHeight = 10;
  const gridTop = top + dayHeaderHeight;
  const gridBottom = metrics.bottom - (pageCount > 1 ? 5 : 1);
  const gridWidth = metrics.contentWidth - timeLabelWidth;
  const dayWidth = gridWidth / page.days.length;

  page.days.forEach((day, index) => {
    const x = metrics.margin + timeLabelWidth + (index * dayWidth);
    const invalidCount = day.classes.filter((item) => {
      const start = timeToMinutes(item.startTime);
      const end = timeToMinutes(item.endTime);
      return start === null || end === null || end <= start;
    }).length;
    setFill(doc, index % 2 === 0 ? SOFT : { r: 255, g: 255, b: 255 });
    doc.rect(x, gridTop, dayWidth, gridBottom - gridTop, 'F');
    setFill(doc, SOFT);
    setStroke(doc, GRID);
    doc.setLineWidth(0.24);
    doc.roundedRect(x + 0.45, top, dayWidth - 0.9, dayHeaderHeight - 1, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(dayWidth < 33 ? 5.8 : 6.8);
    setText(doc, INK);
    doc.text(WEEKDAYS[day.dayIndex], x + (dayWidth / 2), top + 3.7, { align: 'center', maxWidth: dayWidth - 3 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.9);
    setText(doc, MUTED);
    const daySummary = invalidCount > 0
      ? `${day.classes.length} | ${invalidCount} sin hora`
      : (day.classes.length ? `${day.classes.length} ${day.classes.length === 1 ? 'clase' : 'clases'}` : 'Día libre');
    doc.text(daySummary, x + (dayWidth / 2), top + 6.8, { align: 'center', maxWidth: dayWidth - 3 });
    setStroke(doc, GRID);
    doc.line(x, gridTop, x, gridBottom);
  });
  setStroke(doc, GRID);
  doc.line(metrics.width - metrics.margin, gridTop, metrics.width - metrics.margin, gridBottom);

  const scale = drawTimeGrid(doc, {
    gridLeft: metrics.margin + timeLabelWidth,
    gridRight: metrics.width - metrics.margin,
    top: gridTop,
    bottom: gridBottom,
    timeRange: page.timeRange,
    labelWidth: timeLabelWidth,
  });

  page.days.forEach((day, index) => {
    const x = metrics.margin + timeLabelWidth + (index * dayWidth);
    const gaps = getScheduleGaps(day.classes, { dayIndex: day.dayIndex }).filter((gap) => gap.status === 'positive');
    gaps.forEach((gap) => {
      if (gap.endMinutes <= page.timeRange.start || gap.startMinutes >= page.timeRange.end) return;
      const clippedStart = Math.max(gap.startMinutes, page.timeRange.start);
      const clippedEnd = Math.min(gap.endMinutes, page.timeRange.end);
      const y = gridTop + ((clippedStart - page.timeRange.start) * scale);
      drawGapArea(doc, gap, x + 1.15, y, dayWidth - 2.3, (clippedEnd - clippedStart) * scale);
    });

    day.classes.forEach((item) => {
      const start = timeToMinutes(item.startTime);
      const end = timeToMinutes(item.endTime);
      if (start === null || end === null || end <= page.timeRange.start || start >= page.timeRange.end) return;
      const clippedStart = Math.max(start, page.timeRange.start);
      const clippedEnd = Math.min(end, page.timeRange.end);
      const y = gridTop + ((clippedStart - page.timeRange.start) * scale) + 0.55;
      const height = Math.max(1, ((clippedEnd - clippedStart) * scale) - 1.1);
      drawLandscapeEvent(doc, item, x + 1.05, y, dayWidth - 2.1, height, subjectColors);
    });
  });
}

function drawPortraitEvent(doc, item, x, y, width, height, subjectColors) {
  const event = item.event;
  if (!item.isValid) {
    setFill(doc, { r: 255, g: 251, b: 235 });
    setStroke(doc, { r: 253, g: 230, b: 138 });
    doc.roundedRect(x, y, width, height - 0.5, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    setText(doc, { r: 180, g: 83, b: 9 });
    doc.text(fitSingleLine(doc, `${event.subject || 'Clase'} | horario inválido`, width - 4), x + 2, y + (height / 2) + 0.8);
    return;
  }

  const colors = getSchedulePdfColors(event, subjectColors);
  setFill(doc, colors.surface);
  setStroke(doc, colors.border);
  doc.setLineWidth(0.22);
  doc.roundedRect(x, y, width, height - 0.5, 1.1, 1.1, 'FD');
  setFill(doc, colors.accent);
  doc.roundedRect(x, y, 1.4, height - 0.5, 0.8, 0.8, 'F');

  const timeWidth = Math.min(25, width * 0.29);
  const contentX = x + timeWidth;
  const contentWidth = width - timeWidth - 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.1);
  setText(doc, colors.accent);
  doc.text(`${safeTime(event.startTime)} - ${safeTime(event.endTime)}`, x + 3, y + 3.6, { maxWidth: timeWidth - 4 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  setText(doc, MUTED);
  doc.text(formatScheduleDuration(item.durationMinutes), x + 3, y + 6.8, { maxWidth: timeWidth - 4 });

  const detail = [event.room, event.teacher]
    .filter((value) => value && !['Sin profesor', 'Por definir'].includes(value))
    .join(' | ');
  const showDetail = Boolean(detail && height >= 10.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setText(doc, INK);
  doc.text(
    fitSingleLine(doc, event.subject || event.title || 'Asignatura', contentWidth),
    contentX,
    showDetail ? y + 3.8 : y + (height / 2) + 0.8
  );

  if (showDetail) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    setText(doc, MUTED);
    doc.text(fitSingleLine(doc, detail, contentWidth), contentX, y + 7.2);
  }
}

function drawPortraitGap(doc, gap, x, y, width, height) {
  const centerY = y + (height / 2);
  setStroke(doc, { r: 203, g: 213, b: 225 });
  doc.setLineWidth(0.18);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(x, centerY, x + width, centerY);
  doc.setLineDashPattern([], 0);

  const label = formatFreeTime(gap.durationMinutes);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(height < 4 ? 4.1 : 4.6);
  const labelWidth = Math.min(width - 8, doc.getTextWidth(label) + 5);
  setFill(doc, { r: 255, g: 255, b: 255 });
  doc.roundedRect(x + ((width - labelWidth) / 2), centerY - 1.7, labelWidth, 3.4, 1.7, 1.7, 'F');
  setText(doc, MUTED);
  doc.text(label, x + (width / 2), centerY + 0.7, { align: 'center', maxWidth: labelWidth - 2 });
}

function drawPortraitSection(doc, section, allDays, x, y, width, subjectColors) {
  const day = allDays.find((candidate) => candidate.dayIndex === section.dayIndex) || { classes: [] };
  const height = section.estimatedHeight;
  setFill(doc, { r: 255, g: 255, b: 255 });
  setStroke(doc, GRID);
  doc.setLineWidth(0.26);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');

  setFill(doc, SOFT);
  doc.roundedRect(x + 0.25, y + 0.25, width - 0.5, 8.2, 1.7, 1.7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  setText(doc, INK);
  const title = `${WEEKDAYS[section.dayIndex]}${section.continued ? ' (continuación)' : ''}`;
  doc.text(fitSingleLine(doc, title, width - 31), x + 3, y + 5.1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.1);
  setText(doc, MUTED);
  const countLabel = day.classes.length ? `${day.classes.length} ${day.classes.length === 1 ? 'clase' : 'clases'}` : 'Día libre';
  doc.text(countLabel, x + width - 3, y + 5.1, { align: 'right', maxWidth: 28 });

  if (section.items.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    setText(doc, MUTED);
    doc.text('Sin clases programadas', x + 3, y + 14.2);
    return;
  }

  let cursorY = y + 9.5;
  section.items.forEach((item) => {
    if (item.type === 'gap') drawPortraitGap(doc, item, x + 3, cursorY, width - 6, item.estimatedHeight);
    else drawPortraitEvent(doc, item, x + 2.5, cursorY, width - 5, item.estimatedHeight, subjectColors);
    cursorY += item.estimatedHeight;
  });
}

function drawPortraitPage(doc, page, subjectColors, header) {
  const { metrics, top } = header;
  const columnGap = 6;
  const columnWidth = (metrics.contentWidth - columnGap) / 2;

  page.columns.forEach((sections, columnIndex) => {
    const x = metrics.margin + (columnIndex * (columnWidth + columnGap));
    let y = top;
    sections.forEach((section, sectionIndex) => {
      if (sectionIndex > 0) y += 4;
      drawPortraitSection(doc, section, page.days, x, y, columnWidth, subjectColors);
      y += section.estimatedHeight;
    });
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
  const stats = getScheduleStats(layout.classes, layout.daysCount);
  const doc = createPdfDocument({ orientation: safeOrientation, format: 'a4', unit: 'mm' });

  for (let index = 0; index < layout.pages.length; index += 1) {
    throwIfCancelled(signal);
    if (index > 0) doc.addPage('a4', safeOrientation);
    const page = layout.pages[index];
    const header = drawHeader(doc, {
      scheduleName,
      orientation: safeOrientation,
      pageNumber: index + 1,
      pageCount: layout.pages.length,
      stats,
      hiddenEventCount: layout.hiddenEventCount,
    });
    if (page.type === 'landscape-week') drawLandscapePage(doc, page, subjectColors, header, layout.pages.length);
    else drawPortraitPage(doc, page, subjectColors, header);
    drawFooter(doc, header.metrics, index + 1, layout.pages.length);
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
    pageCount: layout.pages.length,
    singleFile: true,
  };
}
