const LEGACY_TO_CURRENT = {
  tardies: 'partialAttendances',
  participations: 'canceledClasses',
};

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function normalizeAttendanceValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

export function normalizeAttendanceClass(classItem) {
  if (!classItem || typeof classItem !== 'object') return classItem;

  const normalized = { ...classItem };
  Object.entries(LEGACY_TO_CURRENT).forEach(([currentKey, legacyKey]) => {
    // A present new value, including zero, always wins over the legacy value.
    const currentValue = hasOwn(classItem, currentKey) && classItem[currentKey] !== null
      ? normalizeAttendanceValue(classItem[currentKey])
      : normalizeAttendanceValue(classItem[legacyKey]);
    normalized[currentKey] = currentValue;
  });

  return normalized;
}

export function normalizeScheduleAttendance(schedule) {
  if (!schedule || typeof schedule !== 'object' || !Array.isArray(schedule.classes)) {
    return schedule;
  }

  return {
    ...schedule,
    classes: schedule.classes.map(normalizeAttendanceClass),
  };
}

export function normalizeScheduleListAttendance(schedules) {
  return Array.isArray(schedules) ? schedules.map(normalizeScheduleAttendance) : schedules;
}

export function isAttendanceField(field) {
  return ['attendances', 'absences', 'tardies', 'participations'].includes(field);
}
