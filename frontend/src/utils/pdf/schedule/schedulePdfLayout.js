import {
  getDurationMinutes,
  getScheduleTimeRange,
  sortClassesByStart,
} from '../../../components/library/calendar/scheduleUtils.js';

// A4 horizontal remains legible with a 16-hour day (a 30-minute class still
// gets roughly five millimetres of height). This keeps a normal 08:00–22:00
// school week together on one printed sheet, like a real timetable.
const LANDSCAPE_MAX_HOURS_PER_PAGE = 16;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// Todos los días comparten un eje horario con una pequeña respiración arriba y
// abajo. Así, al imprimir las páginas verticales, las 08:00 siempre quedan a
// la misma altura y es mucho más fácil comparar días distintos.
function createVisualTimeRange(classes) {
  const raw = getScheduleTimeRange(classes);
  const minimumDuration = 8 * 60;
  let start = clamp(Math.floor((raw.start - 30) / 60) * 60, 0, 23 * 60);
  let end = clamp(Math.ceil((raw.end + 30) / 60) * 60, 60, 24 * 60);

  if (end - start < minimumDuration) {
    const deficit = minimumDuration - (end - start);
    start = clamp(start - Math.floor(deficit / 2), 0, 24 * 60 - minimumDuration);
    end = start + minimumDuration;
  }

  return { start, end: Math.max(start + 60, end) };
}

function estimateDayHeight(classes) {
  return classes.length === 0
    ? 30
    : 34 + classes.reduce((total, item) => total + Math.max(18, getDurationMinutes(item) * 0.28), 0);
}

function createTimeRanges(classes) {
  const { start, end } = createVisualTimeRange(classes);
  const ranges = [];
  const pageMinutes = LANDSCAPE_MAX_HOURS_PER_PAGE * 60;
  let cursor = start;

  while (cursor < end) {
    const next = Math.min(end, cursor + pageMinutes);
    ranges.push({ start: cursor, end: next });
    cursor = next;
  }
  return ranges.length ? ranges : [{ start, end }];
}

export function createSchedulePdfLayout({ classes = [], daysCount = 5, orientation = 'portrait' } = {}) {
  const safeDaysCount = Math.max(5, Math.min(7, Number(daysCount) || 5));
  const normalizedClasses = sortClassesByStart(classes).filter((item) => (
    Number.isInteger(Number(item?.dayIndex)) && Number(item.dayIndex) >= 0 && Number(item.dayIndex) < safeDaysCount
  ));
  const days = Array.from({ length: safeDaysCount }, (_, dayIndex) => ({
    dayIndex,
    classes: normalizedClasses.filter((item) => Number(item.dayIndex) === dayIndex),
  }));

  if (orientation === 'landscape') {
    return {
      orientation: 'landscape',
      daysCount: safeDaysCount,
      classes: normalizedClasses,
      pages: createTimeRanges(normalizedClasses).map((timeRange) => ({
        type: 'week',
        days,
        timeRange,
      })),
    };
  }

  // Una página por día es un contrato deliberado del formato vertical: un
  // horario de siete días siempre produce siete hojas, incluso cuando un día
  // no tiene clases o el rango total de horas es muy largo.
  const portraitTimeRange = createVisualTimeRange(normalizedClasses);
  const portraitPages = days.map((day) => ({
    type: 'day',
    days: [day],
    timeRange: portraitTimeRange,
  }));

  return {
    orientation: 'portrait',
    daysCount: safeDaysCount,
    classes: normalizedClasses,
    pages: portraitPages,
  };
}

export { createVisualTimeRange, estimateDayHeight };
