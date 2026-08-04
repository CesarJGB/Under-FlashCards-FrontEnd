const Schedule = require('../models/Schedule');
const {
  ATTENDANCE_FIELDS,
  applySharedSubjectUpdate,
  applySubjectAttendance,
  ensureSubjectProfiles,
  findScheduleConflict,
  findSubjectProfile,
  isValidDaysCount,
  normalizeClassSubjectKey,
  removeUnusedSubjectProfile,
  validateClassInput,
} = require('../utils/scheduleUtils');

function sendValidationError(res, message, code = 'SCHEDULE_VALIDATION_ERROR') {
  return res.status(400).json({ error: message, code });
}

function sendConflictError(res, conflict) {
  return res.status(409).json({
    error: `La clase se superpone con ${conflict.subject || 'otra clase'} (${conflict.startTime} - ${conflict.endTime}).`,
    code: 'SCHEDULE_CONFLICT',
    conflictClassId: conflict._id || conflict.id,
  });
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function normalizeScope(value) {
  if (value === undefined || value === null || value === 'occurrence' || value === 'day') return 'occurrence';
  if (value === 'all' || value === 'subject') return 'all';
  return null;
}

function trimOrDefault(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getMetricValues(body, profile = null) {
  return Object.fromEntries(ATTENDANCE_FIELDS.map((field) => [
    field,
    profile?.[field] ?? body?.[field] ?? (field === 'tardies' ? body?.partialAttendances : field === 'participations' ? body?.canceledClasses : 0),
  ]));
}

function getAttendanceUpdate(body) {
  const deltas = body?.attendanceDelta;
  if (deltas !== undefined && (!deltas || typeof deltas !== 'object' || Array.isArray(deltas))) {
    return { error: 'attendanceDelta debe ser un objeto válido.' };
  }
  if (deltas) {
    for (const field of Object.keys(deltas)) {
      if (!ATTENDANCE_FIELDS.includes(field) || !Number.isInteger(Number(deltas[field]))) {
        return { error: `El incremento de ${field} no es válido.` };
      }
    }
    return { deltas: Object.fromEntries(Object.entries(deltas).map(([field, value]) => [field, Number(value)])) };
  }

  const values = {};
  ATTENDANCE_FIELDS.forEach((field) => {
    if (hasOwn(body, field)) values[field] = Number(body[field]);
  });
  return { values: Object.keys(values).length > 0 ? values : null };
}

// =========================================================================
// HORARIOS
// =========================================================================

exports.getSchedules = async (req, res) => {
  try {
    const { userId } = req.params;
    const schedules = await Schedule.find({ userId }).sort({ createdAt: 1 });
    return res.json(schedules.map((schedule) => schedule.serialize()));
  } catch (err) {
    console.error('[schedule:getSchedules] error:', err.message);
    return res.status(500).json({ error: 'Server error al obtener horarios.' });
  }
};

exports.getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedUserId = req.headers['x-user-id'];
    const schedule = await Schedule.findById(id);

    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });
    if (schedule.userId.toString() !== requestedUserId) {
      return res.status(403).json({ error: 'No autorizado para ver este horario.' });
    }
    return res.json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:getScheduleById] error:', err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ error: 'Horario no encontrado.' });
    return res.status(500).json({ error: 'Server error al obtener el horario.' });
  }
};

exports.createSchedule = async (req, res) => {
  try {
    const { userId, name, daysCount } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId es requerido.' });
    if (name !== undefined && typeof name !== 'string') return sendValidationError(res, 'El nombre del horario no es válido.');

    const normalizedDays = daysCount === undefined ? 5 : Number(daysCount);
    if (!isValidDaysCount(normalizedDays)) return sendValidationError(res, 'daysCount debe ser un número entero entre 5 y 7.');

    const schedule = await Schedule.create({
      userId,
      name: name?.trim() || 'Horario Principal',
      daysCount: normalizedDays,
    });
    return res.status(201).json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:createSchedule] error:', err.message);
    if (err.name === 'ValidationError') return sendValidationError(res, err.message);
    return res.status(500).json({ error: 'Server error al crear horario.' });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, daysCount } = req.body || {};
    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });

    if (name !== undefined) {
      if (typeof name !== 'string') return sendValidationError(res, 'El nombre del horario no es válido.');
      if (!name.trim()) return res.status(400).json({ error: 'El nombre del horario es requerido.' });
      schedule.name = name.trim();
    }
    if (daysCount !== undefined) {
      const normalizedDays = Number(daysCount);
      if (!isValidDaysCount(normalizedDays)) return sendValidationError(res, 'daysCount debe ser un número entero entre 5 y 7.');
      schedule.daysCount = normalizedDays;
    }

    ensureSubjectProfiles(schedule);
    await schedule.save();
    return res.json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:updateSchedule] error:', err.message);
    if (err.name === 'ValidationError') return sendValidationError(res, err.message);
    return res.status(500).json({ error: 'Server error al actualizar horario.' });
  }
};

exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findByIdAndDelete(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });
    return res.json({ success: true, message: 'Horario eliminado.' });
  } catch (err) {
    console.error('[schedule:deleteSchedule] error:', err.message);
    return res.status(500).json({ error: 'Server error al eliminar horario.' });
  }
};

// =========================================================================
// CLASES / OCURRENCIAS
// =========================================================================

exports.addClass = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { subject, teacher, room, dayIndex, startTime, endTime, subjectKey, color, colorMode } = body;
    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });

    const profiles = ensureSubjectProfiles(schedule);
    const normalizedSubjectKey = normalizeClassSubjectKey(subjectKey, subject);
    const existingProfile = profiles.find((profile) => profile.key === normalizedSubjectKey) || null;
    const resolvedSubject = existingProfile?.name || String(subject || '').trim();
    const resolvedTeacher = existingProfile?.teacher || trimOrDefault(teacher, 'Sin profesor');
    const resolvedRoom = existingProfile?.room || trimOrDefault(room, 'Por definir');
    const colorOverrideRequested = hasOwn(body, 'colorMode') || hasOwn(body, 'color');
    const occurrenceColorMode = colorOverrideRequested ? (colorMode === 'custom' ? 'custom' : 'automatic') : null;
    const occurrenceColor = occurrenceColorMode === 'custom' ? color : null;

    const classPayload = {
      subject: resolvedSubject,
      teacher: resolvedTeacher,
      room: resolvedRoom,
      dayIndex: Number(dayIndex),
      startTime,
      endTime,
      subjectKey: normalizedSubjectKey,
      color: occurrenceColor,
      colorMode: occurrenceColorMode,
      ...getMetricValues(body, existingProfile),
    };
    const validationError = validateClassInput(classPayload, { daysCount: schedule.daysCount });
    if (validationError) return sendValidationError(res, validationError);

    const conflict = findScheduleConflict(schedule.classes, classPayload);
    if (conflict) return sendConflictError(res, conflict);

    schedule.classes.push({
      subject: resolvedSubject,
      teacher: resolvedTeacher,
      room: resolvedRoom,
      subjectKey: normalizedSubjectKey,
      color: occurrenceColor,
      colorMode: occurrenceColorMode,
      dayIndex: Number(dayIndex),
      startTime,
      endTime,
      ...getMetricValues(body, existingProfile),
    });

    // For a new subject the first occurrence seeds the shared profile. For an
    // existing subject its profile remains authoritative and the occurrence
    // inherits it without changing other days.
    ensureSubjectProfiles(schedule);
    await schedule.save();
    return res.status(201).json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:addClass] error:', err.message);
    if (err.name === 'ValidationError') return sendValidationError(res, err.message);
    return res.status(500).json({ error: 'Server error al agregar clase.' });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const { id, classId } = req.params;
    const body = { ...(req.body || {}) };
    const scope = normalizeScope(body.scope);
    if (!scope) return sendValidationError(res, 'El alcance de actualización no es válido.');
    delete body.scope;

    if (body.tardies === undefined && body.partialAttendances !== undefined) body.tardies = body.partialAttendances;
    if (body.participations === undefined && body.canceledClasses !== undefined) body.participations = body.canceledClasses;

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });
    ensureSubjectProfiles(schedule);

    const classItem = schedule.classes.id(classId);
    if (!classItem) return res.status(404).json({ error: 'Clase no encontrada.' });
    const originalSubjectKey = normalizeClassSubjectKey(classItem.subjectKey, classItem.subject);

    const nextSubject = body.subject !== undefined ? body.subject : classItem.subject;
    const nextDayIndex = body.dayIndex !== undefined ? Number(body.dayIndex) : classItem.dayIndex;
    const nextStartTime = body.startTime !== undefined ? body.startTime : classItem.startTime;
    const nextEndTime = body.endTime !== undefined ? body.endTime : classItem.endTime;
    const validationError = validateClassInput({
      ...classItem.toObject(),
      ...body,
      subject: nextSubject,
      dayIndex: nextDayIndex,
      startTime: nextStartTime,
      endTime: nextEndTime,
      subjectKey: originalSubjectKey,
      color: body.color !== undefined ? body.color : classItem.color,
    }, {
      daysCount: schedule.daysCount,
      requireVisibleDay: nextDayIndex < schedule.daysCount || nextDayIndex === classItem.dayIndex,
    });
    if (validationError) return sendValidationError(res, validationError);

    const candidate = {
      ...classItem.toObject(),
      ...body,
      subject: nextSubject,
      dayIndex: nextDayIndex,
      startTime: nextStartTime,
      endTime: nextEndTime,
    };
    const conflict = findScheduleConflict(schedule.classes, candidate, classId);
    if (conflict) return sendConflictError(res, conflict);

    const attendanceUpdate = getAttendanceUpdate(body);
    if (attendanceUpdate.error) return sendValidationError(res, attendanceUpdate.error);
    const hasAttendanceUpdate = Boolean(attendanceUpdate.deltas || attendanceUpdate.values);
    if (hasAttendanceUpdate) {
      const profile = applySubjectAttendance(schedule, {
        subjectKey: originalSubjectKey,
        deltas: attendanceUpdate.deltas || {},
        values: attendanceUpdate.values || {},
      });
      if (!profile) return res.status(404).json({ error: 'Materia compartida no encontrada.' });
    }

    // Day and time are always occurrence-specific, regardless of scope.
    ['dayIndex', 'startTime', 'endTime'].forEach((field) => {
      if (hasOwn(body, field)) classItem[field] = field === 'dayIndex' ? nextDayIndex : body[field];
    });

    const metadataFields = ['subject', 'teacher', 'room', 'color', 'colorMode'];
    const hasMetadataUpdate = metadataFields.some((field) => hasOwn(body, field));
    if (hasMetadataUpdate) {
      const profile = findSubjectProfile(schedule, originalSubjectKey, classItem.subject);
      const profilePayload = {
        subjectKey: originalSubjectKey,
        subject: nextSubject,
        teacher: body.teacher !== undefined ? body.teacher : profile?.teacher,
        room: body.room !== undefined ? body.room : profile?.room,
      };
      if (hasOwn(body, 'colorMode')) profilePayload.colorMode = body.colorMode;
      if (hasOwn(body, 'color')) profilePayload.color = body.color;

      if (scope === 'all') {
        // The existing key is retained when a subject is renamed. This keeps
        // the shared identity stable and prevents a duplicate logical subject.
        applySharedSubjectUpdate(schedule, profilePayload);
      } else {
        classItem.subjectKey = originalSubjectKey;
        if (hasOwn(body, 'subject')) classItem.subject = String(nextSubject).trim();
        if (hasOwn(body, 'teacher')) classItem.teacher = trimOrDefault(body.teacher, 'Sin profesor');
        if (hasOwn(body, 'room')) classItem.room = trimOrDefault(body.room, 'Por definir');
        if (hasOwn(body, 'colorMode')) {
          classItem.colorMode = body.colorMode;
          classItem.color = body.colorMode === 'custom' ? body.color : null;
        } else if (hasOwn(body, 'color')) {
          classItem.color = body.color;
          classItem.colorMode = body.color ? 'custom' : 'automatic';
        }
      }
    }

    ensureSubjectProfiles(schedule);
    await schedule.save();
    return res.json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:updateClass] error:', err.message);
    if (err.name === 'ValidationError') return sendValidationError(res, err.message);
    return res.status(500).json({ error: 'Server error al actualizar clase.' });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { id, classId } = req.params;
    const scope = normalizeScope(req.body?.scope);
    if (!scope) return sendValidationError(res, 'El alcance de eliminación no es válido.');

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });
    ensureSubjectProfiles(schedule);

    const classItem = schedule.classes.id(classId);
    if (!classItem) return res.status(404).json({ error: 'Clase no encontrada.' });
    const subjectKey = normalizeClassSubjectKey(classItem.subjectKey, classItem.subject);

    if (scope === 'all') {
      schedule.classes = schedule.classes.filter((item) => normalizeClassSubjectKey(item.subjectKey, item.subject) !== subjectKey);
    } else {
      schedule.classes.pull(classId);
    }
    removeUnusedSubjectProfile(schedule, subjectKey);
    await schedule.save();
    return res.json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:deleteClass] error:', err.message);
    if (err.name === 'ValidationError') return sendValidationError(res, err.message);
    return res.status(500).json({ error: 'Server error al eliminar clase.' });
  }
};
