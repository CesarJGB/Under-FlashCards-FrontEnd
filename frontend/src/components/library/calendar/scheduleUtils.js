import { getMateriaColor, isValidHexColor, normalizeMateriaName } from '../../../lib/materiaColors.js';

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function normalizeSubjectName(value) {
  return normalizeMateriaName(value);
}

export function getSubjectKey(subject, fallback = 'materia') {
  return normalizeSubjectName(subject) || fallback;
}

export function timeToMinutes(value) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

export function getDurationMinutes(classItem) {
  const start = timeToMinutes(classItem?.startTime);
  const end = timeToMinutes(classItem?.endTime);
  if (start === null || end === null || end <= start) return 0;
  return end - start;
}

export function sortClassesByStart(classes = []) {
  return [...classes].sort((a, b) => {
    const startDifference = (timeToMinutes(a?.startTime) ?? Number.MAX_SAFE_INTEGER)
      - (timeToMinutes(b?.startTime) ?? Number.MAX_SAFE_INTEGER);
    if (startDifference !== 0) return startDifference;
    return (timeToMinutes(a?.endTime) ?? Number.MAX_SAFE_INTEGER)
      - (timeToMinutes(b?.endTime) ?? Number.MAX_SAFE_INTEGER);
  });
}

export function getScheduleTimeRange(classes = []) {
  const valid = classes
    .map((item) => ({ start: timeToMinutes(item?.startTime), end: timeToMinutes(item?.endTime) }))
    .filter(({ start, end }) => start !== null && end !== null && end > start);

  if (valid.length === 0) return { start: 8 * 60, end: 18 * 60 };
  return {
    start: Math.min(...valid.map(({ start }) => start)),
    end: Math.max(...valid.map(({ end }) => end)),
  };
}

export function getCurrentDayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

export function getInitialDayIndex(daysCount = 5, rememberedDay = null, date = new Date()) {
  const safeDaysCount = Math.max(5, Math.min(7, Number(daysCount) || 5));
  const currentDay = getCurrentDayIndex(date);
  if (currentDay < safeDaysCount) return currentDay;

  const remembered = Number(rememberedDay);
  if (Number.isInteger(remembered) && remembered >= 0 && remembered < safeDaysCount) {
    return remembered;
  }
  return 0;
}

export function getClassTemporalState(classItem, activeDayIndex, now = new Date()) {
  if (getCurrentDayIndex(now) !== activeDayIndex) return 'scheduled';
  const start = timeToMinutes(classItem?.startTime);
  const end = timeToMinutes(classItem?.endTime);
  if (start === null || end === null) return 'scheduled';
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  if (currentMinutes >= end) return 'completed';
  if (currentMinutes >= start) return 'current';
  return 'upcoming';
}

export function getTimelineRelations(classes = [], activeDayIndex, now = new Date()) {
  const sorted = sortClassesByStart(classes);
  const currentIndex = sorted.findIndex((item) => getClassTemporalState(item, activeDayIndex, now) === 'current');
  const nextIndex = currentIndex >= 0
    ? sorted.findIndex((item, index) => index > currentIndex && getClassTemporalState(item, activeDayIndex, now) === 'upcoming')
    : sorted.findIndex((item) => getClassTemporalState(item, activeDayIndex, now) === 'upcoming');

  return {
    currentId: currentIndex >= 0 ? sorted[currentIndex]?.id : null,
    nextId: nextIndex >= 0 ? sorted[nextIndex]?.id : null,
  };
}

export function getMinutesUntilNextClass(classItem, now = new Date()) {
  if (!classItem || getCurrentDayIndex(now) !== Number(classItem.dayIndex)) return null;
  const start = timeToMinutes(classItem.startTime);
  if (start === null) return null;
  const current = (now.getHours() * 60) + now.getMinutes();
  return start > current ? start - current : 0;
}

export function resolveScheduleClassColor(classItem, subjectColors = []) {
  const subjectKey = classItem?.subjectKey || getSubjectKey(classItem?.subject);
  const registry = subjectColors.find((entry) => entry?.key === subjectKey);
  const override = classItem?.colorMode === 'automatic'
    ? null
    : (classItem?.color || registry?.color);

  if (isValidHexColor(override)) return override;
  if (isValidHexColor(classItem?.resolvedColor)) return classItem.resolvedColor;
  return getMateriaColor({ name: subjectKey });
}

export function getScheduleColorMode(classItem, subjectColors = []) {
  if (classItem?.colorMode === 'custom' || isValidHexColor(classItem?.color)) return 'custom';
  const key = classItem?.subjectKey || getSubjectKey(classItem?.subject);
  const registry = subjectColors.find((entry) => entry?.key === key);
  return isValidHexColor(registry?.color) ? 'custom' : 'automatic';
}

export function formatDuration(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} h`;
  return `${hours} h ${remainder} min`;
}

export function getNextClassLabel(minutes) {
  if (minutes === null || minutes === undefined) return '';
  if (minutes <= 0) return 'Ahora';
  if (minutes < 60) return `En ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `En ${hours} h ${remainder} min` : `En ${hours} h`;
}
