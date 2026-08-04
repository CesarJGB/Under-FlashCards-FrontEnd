const HEX_COLOR_PATTERN = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ATTENDANCE_FIELDS = ['attendances', 'absences', 'tardies', 'participations'];
const LEGACY_ATTENDANCE_FIELDS = {
  tardies: 'partialAttendances',
  participations: 'canceledClasses',
};
const DEFAULT_TEACHER = 'Sin profesor';
const DEFAULT_ROOM = 'Por definir';

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function toPlain(value) {
  return value && typeof value.toObject === 'function' ? value.toObject() : (value || {});
}

function normalizeCounter(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function hasCounter(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0;
}

function normalizeSubjectName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function timeToMinutes(value) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function isValidHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());
}

function isValidDaysCount(value) {
  return Number.isInteger(value) && value >= 5 && value <= 7;
}

function isValidDayIndex(value, daysCount = 7) {
  return Number.isInteger(value) && value >= 0 && value < 7 && value < daysCount;
}

function validateClassInput(input, { daysCount = 7, requireVisibleDay = true } = {}) {
  if (!input || typeof input !== 'object') return 'Los datos de la clase son inválidos.';
  if (typeof input.subject !== 'string' || !input.subject.trim()) {
    return 'La asignatura es requerida.';
  }

  for (const field of ['teacher', 'room']) {
    if (input[field] !== undefined && input[field] !== null && typeof input[field] !== 'string') {
      return `El campo ${field} no es válido.`;
    }
  }

  const dayIndex = Number(input.dayIndex);
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= 7) {
    return 'El día de la clase no es válido.';
  }
  if (requireVisibleDay && dayIndex >= daysCount) {
    return 'El día seleccionado no pertenece a este horario.';
  }

  if (!TIME_PATTERN.test(input.startTime) || !TIME_PATTERN.test(input.endTime)) {
    return 'Las horas deben tener el formato HH:mm.';
  }
  if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
    return 'La hora final debe ser posterior a la hora inicial.';
  }

  for (const field of [...ATTENDANCE_FIELDS, 'partialAttendances', 'canceledClasses']) {
    if (input[field] === undefined) continue;
    if (!Number.isInteger(Number(input[field])) || Number(input[field]) < 0) {
      return `El valor de ${field} no puede ser negativo.`;
    }
  }

  if (input.color !== undefined && input.color !== null && !isValidHexColor(input.color)) {
    return 'El color debe ser un código hexadecimal válido.';
  }
  if (input.colorMode !== undefined && input.colorMode !== null && !['automatic', 'custom'].includes(input.colorMode)) {
    return 'El modo de color no es válido.';
  }
  if (input.colorMode === 'custom' && !isValidHexColor(input.color)) {
    return 'El color personalizado debe ser un código hexadecimal válido.';
  }
  if (input.subjectKey !== undefined && input.subjectKey !== null && typeof input.subjectKey !== 'string') {
    return 'La identidad de la asignatura no es válida.';
  }
  return null;
}

function classesOverlap(first, second) {
  if (Number(first.dayIndex) !== Number(second.dayIndex)) return false;
  const firstStart = timeToMinutes(first.startTime);
  const firstEnd = timeToMinutes(first.endTime);
  const secondStart = timeToMinutes(second.startTime);
  const secondEnd = timeToMinutes(second.endTime);
  if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) return false;
  return firstStart < secondEnd && firstEnd > secondStart;
}

function findScheduleConflict(classes, candidate, ignoredId = null) {
  return classes.find((item) => String(item._id || item.id) !== String(ignoredId) && classesOverlap(item, candidate)) || null;
}

function normalizeClassSubjectKey(subjectKey, subject) {
  return normalizeSubjectName(subjectKey) || normalizeSubjectName(subject) || 'materia';
}

function getClassAttendanceValue(classItem, field) {
  const currentValue = classItem?.[field];
  if (currentValue !== undefined && currentValue !== null) return normalizeCounter(currentValue);
  const legacyField = LEGACY_ATTENDANCE_FIELDS[field];
  return legacyField ? normalizeCounter(classItem?.[legacyField]) : 0;
}

function pickText(values, fallback) {
  const preferred = values.find((value) => typeof value === 'string' && value.trim() && value.trim() !== DEFAULT_TEACHER && value.trim() !== DEFAULT_ROOM);
  const any = values.find((value) => typeof value === 'string' && value.trim());
  return (preferred || any || fallback).trim();
}

function getSubjectColorSeed(schedule) {
  const map = new Map();
  (Array.isArray(schedule?.subjectColors) ? schedule.subjectColors : []).forEach((entry) => {
    const plain = toPlain(entry);
    const key = normalizeClassSubjectKey(plain.key, plain.name);
    if (!map.has(key)) map.set(key, plain);
  });
  return map;
}

/**
 * Builds the canonical subject registry from both the new registry and old
 * per-occurrence fields. It is deliberately idempotent and never sums old
 * occurrence counters; the maximum existing value is used during migration so
 * the same historical metric is not multiplied by the number of appearances.
 */
function ensureSubjectProfiles(schedule) {
  if (!schedule) return [];

  const classes = Array.isArray(schedule.classes) ? schedule.classes : [];
  const existingProfiles = new Map();
  (Array.isArray(schedule.subjectProfiles) ? schedule.subjectProfiles : []).forEach((entry) => {
    const plain = toPlain(entry);
    const key = normalizeClassSubjectKey(plain.key, plain.name);
    if (!existingProfiles.has(key)) existingProfiles.set(key, plain);
  });
  const colorSeeds = getSubjectColorSeed(schedule);
  const grouped = new Map();

  classes.forEach((classItem) => {
    const key = normalizeClassSubjectKey(classItem.subjectKey, classItem.subject);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(classItem);
    classItem.subjectKey = key;
  });

  const keys = new Set([...existingProfiles.keys(), ...colorSeeds.keys(), ...grouped.keys()]);
  const profiles = [];

  keys.forEach((key) => {
    const oldProfile = existingProfiles.get(key);
    const colorSeed = colorSeeds.get(key);
    const group = grouped.get(key) || [];
    const first = toPlain(group[0]);
    const profileHasColorMode = oldProfile && (oldProfile.colorMode === 'automatic' || oldProfile.colorMode === 'custom');

    let color = null;
    let colorMode = 'automatic';
    if (profileHasColorMode && oldProfile.colorMode === 'automatic') {
      color = null;
    } else if (isValidHexColor(oldProfile?.color)) {
      color = oldProfile.color.trim();
      colorMode = 'custom';
    } else if (colorSeed && isValidHexColor(colorSeed.color)) {
      color = colorSeed.color.trim();
      colorMode = 'custom';
    } else {
      const classColor = group.find((item) => item.colorMode !== 'automatic' && isValidHexColor(item.color));
      if (classColor) {
        color = classColor.color.trim();
        colorMode = 'custom';
      }
    }

    const profile = {
      key,
      name: String(oldProfile?.name || colorSeed?.name || first.subject || key).trim(),
      teacher: pickText([oldProfile?.teacher, ...group.map((item) => item.teacher)], DEFAULT_TEACHER),
      room: pickText([oldProfile?.room, ...group.map((item) => item.room)], DEFAULT_ROOM),
      color,
      colorMode,
    };

    ATTENDANCE_FIELDS.forEach((field) => {
      const profileValue = oldProfile?.[field];
      const classValues = group.map((item) => getClassAttendanceValue(item, field));
      profile[field] = hasCounter(profileValue)
        ? normalizeCounter(profileValue)
        : Math.max(0, ...classValues);
    });

    profiles.push(profile);
  });

  // Keep the profile registry authoritative. subjectColors is emitted as a
  // compatibility projection for older frontend builds, never as a second
  // source of truth.
  schedule.subjectProfiles = profiles;
  schedule.subjectColors = profiles.map((profile) => ({
    key: profile.key,
    name: profile.name,
    color: profile.color || null,
  }));
  return profiles;
}

function syncSubjectColors(schedule, profiles = ensureSubjectProfiles(schedule)) {
  schedule.subjectProfiles = profiles;
  schedule.subjectColors = profiles.map((profile) => ({
    key: profile.key,
    name: profile.name,
    color: profile.color || null,
  }));
}

function findSubjectProfile(schedule, subjectKey, subject) {
  const key = normalizeClassSubjectKey(subjectKey, subject);
  const profiles = ensureSubjectProfiles(schedule);
  return profiles.find((profile) => profile.key === key) || null;
}

function copyProfileAttendanceToClasses(schedule, key, profile) {
  (schedule.classes || []).forEach((classItem) => {
    if (normalizeClassSubjectKey(classItem.subjectKey, classItem.subject) !== key) return;
    classItem.subjectKey = key;
    ATTENDANCE_FIELDS.forEach((field) => {
      const value = normalizeCounter(profile[field]);
      classItem[field] = value;
      const legacyField = LEGACY_ATTENDANCE_FIELDS[field];
      if (legacyField) classItem[legacyField] = value;
    });
  });
}

function applySubjectAttendance(schedule, { subjectKey, subject, deltas = {}, values = {} } = {}) {
  const key = normalizeClassSubjectKey(subjectKey, subject);
  const profiles = ensureSubjectProfiles(schedule);
  const profile = profiles.find((item) => item.key === key);
  if (!profile) return null;

  ATTENDANCE_FIELDS.forEach((field) => {
    if (hasOwn(deltas, field)) {
      const delta = Number(deltas[field]);
      if (Number.isInteger(delta)) profile[field] = Math.max(0, normalizeCounter(profile[field]) + delta);
    } else if (hasOwn(values, field)) {
      profile[field] = normalizeCounter(values[field]);
    }
  });

  copyProfileAttendanceToClasses(schedule, key, profile);
  syncSubjectColors(schedule, profiles);
  return profile;
}

function applySharedSubjectUpdate(schedule, {
  subjectKey,
  subject,
  teacher,
  room,
  colorMode,
  color,
} = {}) {
  const key = normalizeClassSubjectKey(subjectKey, subject);
  const profiles = ensureSubjectProfiles(schedule);
  let profile = profiles.find((item) => item.key === key);
  if (!profile) {
    profile = {
      key,
      name: String(subject || key).trim(),
      teacher: DEFAULT_TEACHER,
      room: DEFAULT_ROOM,
      color: null,
      colorMode: 'automatic',
      attendances: 0,
      absences: 0,
      tardies: 0,
      participations: 0,
    };
    profiles.push(profile);
  }

  if (subject !== undefined) profile.name = String(subject).trim() || profile.name;
  if (teacher !== undefined) profile.teacher = String(teacher || '').trim() || DEFAULT_TEACHER;
  if (room !== undefined) profile.room = String(room || '').trim() || DEFAULT_ROOM;
  if (colorMode !== undefined || color !== undefined) {
    const hasCustomColor = colorMode !== 'automatic' && isValidHexColor(color);
    profile.colorMode = hasCustomColor ? 'custom' : 'automatic';
    profile.color = hasCustomColor ? color.trim() : null;
  }

  (schedule.classes || []).forEach((classItem) => {
    if (normalizeClassSubjectKey(classItem.subjectKey, classItem.subject) !== key) return;
    classItem.subjectKey = key;
    if (subject !== undefined) classItem.subject = profile.name;
    if (teacher !== undefined) classItem.teacher = profile.teacher;
    if (room !== undefined) classItem.room = profile.room;
    if (colorMode !== undefined || color !== undefined) {
      classItem.colorMode = profile.colorMode;
      classItem.color = profile.color;
    }
  });

  copyProfileAttendanceToClasses(schedule, key, profile);
  syncSubjectColors(schedule, profiles);
  return profile;
}

function applySubjectColor(schedule, payload = {}) {
  return applySharedSubjectUpdate(schedule, payload);
}

function removeUnusedSubjectProfile(schedule, subjectKey) {
  const key = normalizeClassSubjectKey(subjectKey);
  const profiles = ensureSubjectProfiles(schedule);
  const stillUsed = (schedule.classes || []).some((classItem) => (
    normalizeClassSubjectKey(classItem.subjectKey, classItem.subject) === key
  ));
  if (!stillUsed) {
    const next = profiles.filter((profile) => profile.key !== key);
    syncSubjectColors(schedule, next);
  }
  return stillUsed;
}

module.exports = {
  ATTENDANCE_FIELDS,
  DEFAULT_ROOM,
  DEFAULT_TEACHER,
  HEX_COLOR_PATTERN,
  TIME_PATTERN,
  normalizeSubjectName,
  timeToMinutes,
  isValidHexColor,
  isValidDaysCount,
  isValidDayIndex,
  validateClassInput,
  classesOverlap,
  findScheduleConflict,
  normalizeClassSubjectKey,
  ensureSubjectProfiles,
  findSubjectProfile,
  applySubjectAttendance,
  applySharedSubjectUpdate,
  applySubjectColor,
  removeUnusedSubjectProfile,
};
