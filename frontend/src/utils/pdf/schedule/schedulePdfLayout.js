import {
  getDurationMinutes,
  getScheduleTimeRange,
  sortClassesByStart,
} from '../../../components/library/calendar/scheduleUtils.js';

const LANDSCAPE_MAX_HOURS_PER_PAGE = 13;

function estimateDayHeight(classes) {
  return classes.length === 0
    ? 30
    : 34 + classes.reduce((total, item) => total + Math.max(18, getDurationMinutes(item) * 0.28), 0);
}

function createTimeRanges(classes) {
  const { start, end } = getScheduleTimeRange(classes);
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

  if (normalizedClasses.length === 0) {
    return {
      orientation,
      daysCount: safeDaysCount,
      classes: normalizedClasses,
      pages: [{ type: 'empty', days }],
    };
  }

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

  // Un dÃ­a por pÃ¡gina mantiene legibilidad incluso con nombres largos,
  // clases de 30 minutos y dÃ­as con muchas franjas consecutivas.
  const portraitPages = days.flatMap((day) => createTimeRanges(day.classes).map((timeRange) => ({
    type: 'day',
    days: [day],
    timeRange,
  })));

  return {
    orientation: 'portrait',
    daysCount: safeDaysCount,
    classes: normalizedClasses,
    pages: portraitPages,
  };
}

export { estimateDayHeight };