// FILE: backend/src/controllers/scheduleController.js
const Schedule = require('../models/Schedule');
const {
  applySubjectColor,
  findScheduleConflict,
  isValidDaysCount,
  normalizeClassSubjectKey,
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

// =========================================================================
// HORARIOS (Schedules)
// =========================================================================

exports.getSchedules = async (req, res) => {
  try {
    const { userId } = req.params;
    const schedules = await Schedule.find({ userId }).sort({ createdAt: 1 });
    return res.json(schedules.map((s) => s.serialize()));
  } catch (err) {
    console.error('[schedule:getSchedules] error:', err.message);
    return res.status(500).json({ error: 'Server error al obtener horarios.' });
  }
};

// =========================================================================
// OBTENER UN SOLO HORARIO POR ID
// =========================================================================
exports.getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedUserId = req.headers['x-user-id']; // Seguridad: comprobar dueÃ±o

    const schedule = await Schedule.findById(id);

    if (!schedule) {
      return res.status(404).json({ error: 'Horario no encontrado.' });
    }

    // Seguridad: Verificar que el horario pertenece al usuario que hace la peticiÃ³n
    if (schedule.userId.toString() !== requestedUserId) {
      return res.status(403).json({ error: 'No autorizado para ver este horario.' });
    }

    return res.json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:getScheduleById] error:', err.message);
    // Si el ID no tiene formato vÃ¡lido de MongoDB, Mongoose lanza un error de "Cast"
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Horario no encontrado.' });
    }
    return res.status(500).json({ error: 'Server error al obtener el horario.' });
  }
};

exports.createSchedule = async (req, res) => {
  try {
    const { userId, name, daysCount } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId es requerido.' });
    if (name !== undefined && typeof name !== 'string') return sendValidationError(res, 'El nombre del horario no es vÃ¡lido.');

    const normalizedDays = daysCount === undefined ? 5 : Number(daysCount);
    if (!isValidDaysCount(normalizedDays)) {
      return sendValidationError(res, 'daysCount debe ser un nÃºmero entero entre 5 y 7.');
    }

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
      if (typeof name !== 'string') return sendValidationError(res, 'El nombre del horario no es vÃ¡lido.');
      if (!name.trim()) return res.status(400).json({ error: 'El nombre del horario es requerido.' });
      schedule.name = name.trim();
    }
    if (daysCount !== undefined) {
      const normalizedDays = Number(daysCount);
      if (!isValidDaysCount(normalizedDays)) {
        return sendValidationError(res, 'daysCount debe ser un nÃºmero entero entre 5 y 7.');
      }
      schedule.daysCount = normalizedDays;
    }

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
// CLASES (dentro de un horario)
// =========================================================================

exports.addClass = async (req, res) => {
  try {
    const { id } = req.params; // scheduleId
    const { subject, teacher, room, dayIndex, startTime, endTime, subjectKey, color, colorMode } = req.body || {};

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });

    const classPayload = {
      subject,
      teacher,
      room,
      dayIndex: Number(dayIndex),
      startTime,
      endTime,
      subjectKey,
      color: color ?? null,
      colorMode,
    };
    const validationError = validateClassInput(classPayload, { daysCount: schedule.daysCount });
    if (validationError) return sendValidationError(res, validationError);

    const normalizedSubjectKey = normalizeClassSubjectKey(subjectKey, subject);
    const conflict = findScheduleConflict(schedule.classes, classPayload);
    if (conflict) return sendConflictError(res, conflict);

    schedule.classes.push({
      subject: subject.trim(),
      teacher: teacher?.trim() || 'Sin profesor',
      room: room?.trim() || 'Por definir',
      subjectKey: normalizedSubjectKey,
      color: colorMode === 'automatic' ? null : (color || null),
      dayIndex: Number(dayIndex),
      startTime,
      endTime,
    });

    if (colorMode !== undefined || color !== undefined) {
      applySubjectColor(schedule, {
        subjectKey: normalizedSubjectKey,
        subject: subject.trim(),
        colorMode,
        color,
      });
    }

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
    const updates = req.body || {};

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });

    const classItem = schedule.classes.id(classId);
    if (!classItem) return res.status(404).json({ error: 'Clase no encontrada.' });

    const nextSubject = updates.subject !== undefined ? updates.subject : classItem.subject;
    const nextDayIndex = updates.dayIndex !== undefined ? Number(updates.dayIndex) : classItem.dayIndex;
    const nextStartTime = updates.startTime !== undefined ? updates.startTime : classItem.startTime;
    const nextEndTime = updates.endTime !== undefined ? updates.endTime : classItem.endTime;
    const nextSubjectKey = normalizeClassSubjectKey(
      updates.subjectKey !== undefined ? updates.subjectKey : classItem.subjectKey,
      nextSubject
    );
    const validationError = validateClassInput({
      ...classItem.toObject(),
      ...updates,
      subject: nextSubject,
      dayIndex: nextDayIndex,
      startTime: nextStartTime,
      endTime: nextEndTime,
      subjectKey: nextSubjectKey,
      color: updates.color !== undefined ? updates.color : classItem.color,
    }, {
      daysCount: schedule.daysCount,
      // A class can remain stored on a hidden day after reducing a schedule
      // from seven to five days; only newly moved classes must be visible.
      requireVisibleDay: nextDayIndex < schedule.daysCount || nextDayIndex === classItem.dayIndex,
    });
    if (validationError) return sendValidationError(res, validationError);

    const candidate = {
      ...classItem.toObject(),
      ...updates,
      subject: nextSubject,
      dayIndex: nextDayIndex,
      startTime: nextStartTime,
      endTime: nextEndTime,
    };
    const conflict = findScheduleConflict(schedule.classes, candidate, classId);
    if (conflict) return sendConflictError(res, conflict);

    // Solo se actualizan los campos que vienen en el body (updates parciales)
    const allowedFields = [
      'subject', 'teacher', 'room', 'dayIndex', 'startTime', 'endTime', 'subjectKey', 'color',
      'attendances', 'absences', 'partialAttendances', 'canceledClasses',
    ];
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) classItem[field] = updates[field];
    });
    classItem.subjectKey = nextSubjectKey;
    if (updates.subject !== undefined) classItem.subject = nextSubject.trim();
    if (updates.dayIndex !== undefined) classItem.dayIndex = nextDayIndex;

    if (updates.colorMode !== undefined || updates.color !== undefined || updates.subjectKey !== undefined || updates.subject !== undefined) {
      applySubjectColor(schedule, {
        subjectKey: nextSubjectKey,
        subject: nextSubject,
        colorMode: updates.colorMode,
        color: updates.color,
      });
    }

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

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });

    schedule.classes.pull(classId);
    await schedule.save();

    return res.json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:deleteClass] error:', err.message);
    return res.status(500).json({ error: 'Server error al eliminar clase.' });
  }
};
