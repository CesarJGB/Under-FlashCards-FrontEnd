const HEX_COLOR_PATTERN = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
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

  for (const field of ['attendances', 'absences', 'tardies', 'participations', 'partialAttendances', 'canceledClasses']) {
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

function applySubjectColor(schedule, { subjectKey, subject, colorMode, color }) {
  if (!Array.isArray(schedule.subjectColors)) schedule.subjectColors = [];
  if (colorMode === undefined && color === undefined) return;
  const key = normalizeClassSubjectKey(subjectKey, subject);
  const explicitColor = colorMode === 'automatic' ? null : (color || null);
  let entry = schedule.subjectColors.find((item) => item.key === key);
  if (!entry) {
    schedule.subjectColors.push({ key, name: String(subject || key).trim(), color: explicitColor });
    entry = schedule.subjectColors[schedule.subjectColors.length - 1];
  } else {
    entry.name = String(subject || entry.name || key).trim();
    entry.color = explicitColor;
  }

  schedule.classes.forEach((item) => {
    const itemKey = normalizeClassSubjectKey(item.subjectKey, item.subject);
    if (itemKey === key) {
      item.subjectKey = key;
      item.color = explicitColor;
      item.colorMode = explicitColor ? 'custom' : 'automatic';
    }
  });
}

module.exports = {
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
  applySubjectColor,
};
