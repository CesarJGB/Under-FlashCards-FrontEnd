import { createPdfDocument, createSchedulePdfFileName, getPageMetrics } from '../document.js';
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
const MIN_LANDSCAPE_EVENT_MINUTES = 45;

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
  if (width < 27) return { title: 4.6, meta: 3.7, time: 3.75, lineHeight: 2.05 };
  if (width < 34) return { title: 5.15, meta: 4.1, time: 4.05, lineHeight: 2.25 };
  return { title: 5.9, meta: 4.5, time: 4.35, lineHeight: 2.55 };
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
  const durationMinutes = getClassesDuration([item]);
  const duration = formatScheduleDuration(durationMinutes);
  const timeRange = `${startTime} - ${endTime}`;
  const detail = durationMinutes < 60
    ? ''
    : durationMinutes < 120
      ? (item.room || '')
      : [item.teacher, item.room].filter((value) => value && !['Sin profesor', 'Por definir'].includes(value)).join(' · ');
  const padding = Math.min(4.2, Math.max(2.1, 2.1 + ((blockHeight - 7) * 0.12)));
  const lineHeightFactor = Math.min(1.18, Math.max(0.94, 0.94 + ((blockHeight - 7) * 0.012)));

  if (blockHeight < 4.6) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.min(typography.title, 4.4));
    setText(doc, INK);
    doc.text(fitSingleLine(doc, `${title} · ${startTime}`, contentWidth), contentX, y + (blockHeight / 2) + 0.8, { maxWidth: contentWidth });
    return;
  }

  const titleLines = fitLines(doc, title, contentWidth, blockHeight >= 11 ? 2 : 1);
  const titleLineHeight = typography.title * 0.3528 * lineHeightFactor;
  const detailLineHeight = typography.meta * 0.3528;
  const rowCount = titleLines.length + 1 + (detail ? 1 : 0);
  const contentHeight = (titleLines.length * titleLineHeight) + 1.2 + (typography.time * 0.3528) + (detail ? detailLineHeight + 0.8 : 0);
  let cursorY = y + Math.max(padding, ((blockHeight - contentHeight) / 2) + 1.6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(typography.title);
  setText(doc, INK);
  doc.text(titleLines, contentX, cursorY, { maxWidth: contentWidth, lineHeightFactor });
  cursorY += (titleLines.length * titleLineHeight) + Math.min(1.6, 0.9 + ((blockHeight - 7) * 0.035));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(typography.time);
  setText(doc, colors.accent);
  doc.text(fitSingleLine(doc, `${timeRange} · ${duration}`, contentWidth), contentX, cursorY, { maxWidth: contentWidth });
  cursorY += (typography.time * 0.3528) + Math.min(1.3, 0.8 + ((blockHeight - 7) * 0.03));

  if (detail && rowCount > 2) {
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
      // Keep very short classes legible without changing their typography.
      // The floor is visual only; the shared time scale still communicates
      // the real duration everywhere else in the grid.
      const visualDurationMinutes = Math.max(MIN_LANDSCAPE_EVENT_MINUTES, clippedEnd - clippedStart);
      const height = Math.max(1, (visualDurationMinutes * scale) - 1.1);
      drawLandscapeEvent(doc, item, x + 1.05, y, dayWidth - 2.1, height, subjectColors);
    });
  });
}

function drawPortraitClockIcon(doc, x, y, color = MUTED) {
  setStroke(doc, color);
  doc.setLineWidth(0.22);
  doc.circle(x, y, 1.05, 'S');
  doc.line(x, y, x, y - 0.55);
  doc.line(x, y, x + 0.5, y + 0.3);
}

function drawPortraitPersonIcon(doc, x, y, color = MUTED) {
  setStroke(doc, color);
  doc.setLineWidth(0.22);
  doc.circle(x, y - 0.65, 0.55, 'S');
  doc.line(x - 1.05, y + 1.05, x - 0.55, y + 0.2);
  doc.line(x + 1.05, y + 1.05, x + 0.55, y + 0.2);
  doc.line(x - 0.55, y + 0.2, x + 0.55, y + 0.2);
}

function drawPortraitLocationIcon(doc, x, y, color = MUTED) {
  setStroke(doc, color);
  doc.setLineWidth(0.22);
  doc.circle(x, y - 0.3, 0.85, 'S');
  doc.circle(x, y - 0.3, 0.25, 'S');
  doc.line(x - 0.62, y + 0.35, x, y + 1.25);
  doc.line(x + 0.62, y + 0.35, x, y + 1.25);
}

function drawPortraitRail(doc, railX, startY, endY, dashed = false) {
  setStroke(doc, { r: 203, g: 213, b: 225 });
  doc.setLineWidth(0.3);
  if (dashed) doc.setLineDashPattern([1, 1], 0);
  doc.line(railX, startY, railX, endY);
  if (dashed) doc.setLineDashPattern([], 0);
}

function drawPortraitEvent(doc, item, x, y, width, height, subjectColors, railX) {
  const event = item.event;
  const cardX = x + 13;
  const cardWidth = Math.max(20, width - 16);
  const cardHeight = Math.max(4, height - 0.6);
  const dotY = y + 5.2;

  if (!item.isValid) {
    setFill(doc, { r: 255, g: 251, b: 235 });
    setStroke(doc, { r: 253, g: 230, b: 138 });
    doc.roundedRect(cardX, y + 0.2, cardWidth, cardHeight, 1.2, 1.2, 'FD');
    setFill(doc, { r: 217, g: 119, b: 6 });
    doc.circle(railX, dotY, 1.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    setText(doc, { r: 180, g: 83, b: 9 });
    doc.text(fitSingleLine(doc, `${event.subject || 'Clase'} | horario inválido`, cardWidth - 4), cardX + 2.5, y + (height / 2) + 0.8);
    return;
  }

  const colors = getSchedulePdfColors(event, subjectColors);
  setFill(doc, colors.accent);
  doc.circle(railX, dotY, 1.8, 'F');
  setFill(doc, { r: 255, g: 255, b: 255 });
  doc.circle(railX, dotY, 0.55, 'F');

  setFill(doc, colors.surface);
  setStroke(doc, colors.border);
  doc.setLineWidth(0.22);
  doc.roundedRect(cardX, y + 0.2, cardWidth, cardHeight, 1.1, 1.1, 'FD');
  setFill(doc, colors.accent);
  doc.roundedRect(cardX, y + 0.2, 1.4, cardHeight, 0.8, 0.8, 'F');

  const contentX = cardX + 3.5;
  const contentWidth = cardWidth - 5.5;
  const timeLabel = `${safeTime(event.startTime)} - ${safeTime(event.endTime)} · ${formatScheduleDuration(item.durationMinutes)}`;
  const detail = [event.teacher, event.room]
    .filter((value) => value && !['Sin profesor', 'Por definir'].includes(value));
  const showMeta = detail.length > 0 && height >= 12.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.25);
  setText(doc, colors.accent);
  doc.text(fitSingleLine(doc, timeLabel, contentWidth), contentX, y + 3.7, { maxWidth: contentWidth });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setText(doc, INK);
  doc.text(
    fitSingleLine(doc, event.subject || event.title || 'Asignatura', contentWidth),
    contentX,
    showMeta ? y + 7.2 : y + Math.min(height - 2.2, 8.5),
    { maxWidth: contentWidth }
  );

  if (showMeta) {
    const metadataY = y + height - 2.2;
    const slotWidth = detail.length > 1 ? (contentWidth - 4) / 2 : contentWidth;
    detail.slice(0, 2).forEach((value, index) => {
      const slotX = contentX + (index * (slotWidth + 4));
      const iconX = slotX + 0.9;
      const textX = slotX + 2.7;
      if (index === 0) drawPortraitPersonIcon(doc, iconX, metadataY - 0.5);
      else drawPortraitLocationIcon(doc, iconX, metadataY - 0.45);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.35);
      setText(doc, MUTED);
      doc.text(fitSingleLine(doc, value, slotWidth - 3), textX, metadataY, { maxWidth: slotWidth - 3 });
    });
  }
}

function drawPortraitGap(doc, gap, railX, x, y, width, height) {
  drawPortraitRail(doc, railX, y + 0.7, y + height - 0.7, true);
  const centerY = y + (height / 2);
  setFill(doc, { r: 255, g: 255, b: 255 });
  doc.circle(railX, centerY, 2.1, 'F');
  drawPortraitClockIcon(doc, railX, centerY, MUTED);

  const label = formatFreeTime(gap.durationMinutes);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(height < 4.5 ? 4.25 : 4.65);
  setText(doc, MUTED);
  doc.text(fitSingleLine(doc, label, width - 20), railX + 5, centerY + 1.4, { maxWidth: width - 20 });
}

function drawPortraitSection(doc, section, allDays, x, y, width, subjectColors) {
  const day = allDays.find((candidate) => candidate.dayIndex === section.dayIndex) || { classes: [] };
  const height = section.estimatedHeight;
  const railX = x + 7;
  const timelineTop = y + 10.5;

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
    doc.text('Sin clases programadas', x + 14, y + 14.2);
    return;
  }

  const positions = [];
  let cursorY = timelineTop;
  section.items.forEach((item) => {
    positions.push({ item, y: cursorY });
    cursorY += item.estimatedHeight;
  });

  positions.forEach((position, index) => {
    const next = positions[index + 1];
    if (!next) return;
    if (position.item.type === 'event' && next.item.type === 'event') {
      drawPortraitRail(doc, railX, position.y + 5.2, next.y + 5.2);
    } else if (position.item.type === 'event' && next.item.type === 'gap') {
      drawPortraitRail(doc, railX, position.y + 5.2, next.y + 0.7);
      const afterGap = positions[index + 2];
      if (afterGap?.item.type === 'event') {
        drawPortraitRail(doc, railX, next.y + next.item.estimatedHeight - 0.7, afterGap.y + 5.2);
      }
    }
  });

  positions.forEach(({ item, y: itemY }) => {
    if (item.type === 'gap') drawPortraitGap(doc, item, railX, x, itemY, width, item.estimatedHeight);
    else drawPortraitEvent(doc, item, x, itemY, width, item.estimatedHeight, subjectColors, railX);
  });
}

function drawPortraitPage(doc, page, subjectColors, header) {
  const { metrics, top } = header;
  const sections = page.sections || page.columns?.flat() || [];
  const x = metrics.margin;
  let y = top;

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) y += 5;
    drawPortraitSection(doc, section, page.days, x, y, metrics.contentWidth, subjectColors);
    y += section.estimatedHeight;
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
  const fileName = createSchedulePdfFileName(
    scheduleName || 'Horario',
    safeOrientation === 'landscape' ? 'Cuadricula' : 'Compacta'
  );
  const doc = createPdfDocument({ orientation: safeOrientation, format: 'a4', unit: 'mm' });
  doc.setProperties?.({
    title: fileName,
    subject: 'Horario académico',
    author: 'Under Flashcards',
  });

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
    fileName,
    pagesProcessed: layout.pages.length,
    pageCount: layout.pages.length,
    singleFile: true,
  };
}
