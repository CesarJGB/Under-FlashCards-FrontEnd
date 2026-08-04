import { getMateriaColor, isValidHexColor, normalizeMateriaName } from '../../../lib/materiaColors.js';
import {
  formatScheduleDuration,
  getEventDurationMinutes,
  getRoundedScheduleTimeRange,
  sortScheduleEvents,
  timeToMinutes,
} from './scheduleTimeline.js';

export function normalizeSubjectName(value) {
  return normalizeMateriaName(value);
}

export function getSubjectKey(subject, fallback = 'materia') {
  return normalizeSubjectName(subject) || fallback;
}

export function getDurationMinutes(classItem) {
  return getEventDurationMinutes(classItem);
}

export function sortClassesByStart(classes = []) {
  return sortScheduleEvents(classes);
}

export function getScheduleTimeRange(classes = []) {
  return getRoundedScheduleTimeRange(classes);
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
  // The per-schedule registry is authoritative for a subject. A legacy
  // per-class color remains a compatible fallback when no registry exists.
  if (registry) {
    return isValidHexColor(registry.color) ? registry.color : getMateriaColor({ name: subjectKey });
  }
  const override = classItem?.colorMode === 'automatic' ? null : classItem?.color;

  if (isValidHexColor(override)) return override;
  if (isValidHexColor(classItem?.resolvedColor)) return classItem.resolvedColor;
  return getMateriaColor({ name: subjectKey });
}

export function getScheduleColorMode(classItem, subjectColors = []) {
  const key = classItem?.subjectKey || getSubjectKey(classItem?.subject);
  const registry = subjectColors.find((entry) => entry?.key === key);
  if (registry) return isValidHexColor(registry.color) ? 'custom' : 'automatic';
  return classItem?.colorMode === 'custom' || isValidHexColor(classItem?.color) ? 'custom' : 'automatic';
}

export function formatDuration(minutes) {
  return formatScheduleDuration(minutes);
}

export function getNextClassLabel(minutes) {
  if (minutes === null || minutes === undefined) return '';
  if (minutes <= 0) return 'Ahora';
  if (minutes < 60) return `En ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `En ${hours} h ${remainder} min` : `En ${hours} h`;
}

export { timeToMinutes };
