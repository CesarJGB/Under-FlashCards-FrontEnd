import { isValidHexColor, normalizeMateriaName } from '../../../lib/materiaColors.js';

const LEGACY_TO_CURRENT = {
  tardies: 'partialAttendances',
  participations: 'canceledClasses',
};
const ATTENDANCE_FIELDS = ['attendances', 'absences', 'tardies', 'participations'];

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function normalizeSubjectKey(subjectKey, subject) {
  return normalizeMateriaName(subjectKey || subject) || 'materia';
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

function profileValue(profile, field, classItems) {
  if (profile && hasOwn(profile, field) && profile[field] !== null && profile[field] !== undefined) {
    return normalizeAttendanceValue(profile[field]);
  }
  return Math.max(0, ...classItems.map((item) => normalizeAttendanceValue(item[field])));
}

/**
 * Normalizes API and cache payloads into the shared-subject representation.
 * This also makes old schedules usable before the backend migration has been
 * persisted: one legacy counter is chosen per subject (the maximum, never a
 * sum) and projected to all its occurrences.
 */
export function normalizeScheduleAttendance(schedule) {
  if (!schedule || typeof schedule !== 'object' || !Array.isArray(schedule.classes)) return schedule;

  const classes = schedule.classes.map(normalizeAttendanceClass);
  const profileMap = new Map();
  const profileInputs = Array.isArray(schedule.subjectProfiles) ? schedule.subjectProfiles : [];
  const colorInputs = Array.isArray(schedule.subjectColors) ? schedule.subjectColors : [];

  profileInputs.forEach((profile) => {
    const key = normalizeSubjectKey(profile?.key, profile?.name);
    if (!profileMap.has(key)) profileMap.set(key, { ...profile, key });
  });
  colorInputs.forEach((entry) => {
    const key = normalizeSubjectKey(entry?.key, entry?.name);
    const current = profileMap.get(key) || { key };
    if (current.color === undefined) current.color = entry?.color || null;
    if (!current.name) current.name = entry?.name || key;
    profileMap.set(key, current);
  });

  const groups = new Map();
  classes.forEach((classItem) => {
    const key = normalizeSubjectKey(classItem.subjectKey, classItem.subject);
    classItem.subjectKey = key;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(classItem);
  });

  const keys = new Set([...profileMap.keys(), ...groups.keys()]);
  const subjectProfiles = Array.from(keys).map((key) => {
    const group = groups.get(key) || [];
    const existing = profileMap.get(key) || {};
    const first = group[0] || {};
    const color = isValidHexColor(existing.color)
      ? existing.color
      : (isValidHexColor(first.color) && first.colorMode !== 'automatic' ? first.color : null);
    return {
      ...existing,
      key,
      name: String(existing.name || first.subject || key).trim(),
      teacher: existing.teacher || first.teacher || 'Sin profesor',
      room: existing.room || first.room || 'Por definir',
      color,
      colorMode: existing.colorMode || (color ? 'custom' : 'automatic'),
      ...Object.fromEntries(ATTENDANCE_FIELDS.map((field) => [field, profileValue(existing, field, group)])),
    };
  });

  const subjectProfileMap = new Map(subjectProfiles.map((profile) => [profile.key, profile]));
  const normalizedClasses = classes.map((classItem) => {
    const profile = subjectProfileMap.get(classItem.subjectKey);
    const sharedColor = profile?.color || null;
    const color = classItem.colorMode === 'custom'
      ? (isValidHexColor(classItem.color) ? classItem.color : null)
      : classItem.colorMode === 'automatic'
        ? null
        : (sharedColor || (isValidHexColor(classItem.color) ? classItem.color : null));

    return {
      ...classItem,
      ...Object.fromEntries(ATTENDANCE_FIELDS.map((field) => [field, normalizeAttendanceValue(profile?.[field] ?? classItem[field])])),
      color,
      colorMode: classItem.colorMode || (sharedColor ? 'custom' : 'automatic'),
      subjectKey: classItem.subjectKey,
    };
  });

  return {
    ...schedule,
    subjectProfiles,
    // Compatibility projection consumed by the existing color UI/PDF code.
    subjectColors: subjectProfiles.map((profile) => ({
      key: profile.key,
      name: profile.name,
      color: profile.color || null,
    })),
    classes: normalizedClasses,
  };
}

export function normalizeScheduleListAttendance(schedules) {
  return Array.isArray(schedules) ? schedules.map(normalizeScheduleAttendance) : schedules;
}

export function isAttendanceField(field) {
  return ATTENDANCE_FIELDS.includes(field);
}
