// backend/src/controllers/scheduleController.js
const Schedule = require('../models/Schedule');

// =========================================================================
// HORARIOS (Schedules)
// =========================================================================

exports.getSchedules = async (req, res) => {
  try {
    const { userId } = req.params;
    const authUserId = req.user?.id || req.user?._id;
    if (String(userId) !== String(authUserId)) {
      return res.status(403).json({ error: 'No tienes permisos para ver estos horarios.' });
    }

    const schedules = await Schedule.find({ userId }).sort({ createdAt: 1 });
    return res.json(schedules.map((s) => s.serialize()));
  } catch (err) {
    console.error('[schedule:getSchedules] error:', err.message);
    return res.status(500).json({ error: 'Server error al obtener horarios.' });
  }
};

exports.createSchedule = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { name, daysCount } = req.body || {};

    const schedule = await Schedule.create({
      userId,
      name: name?.trim() || 'Horario Principal',
      daysCount: daysCount || 5,
    });

    return res.status(201).json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:createSchedule] error:', err.message);
    return res.status(500).json({ error: 'Server error al crear horario.' });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const { name, daysCount } = req.body || {};

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });
    if (String(schedule.userId) !== String(userId)) {
      return res.status(403).json({ error: 'No tienes permisos para editar este horario.' });
    }

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'El nombre del horario es requerido.' });
      schedule.name = name.trim();
    }
    if (daysCount !== undefined) {
      schedule.daysCount = daysCount;
    }

    await schedule.save();
    return res.json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:updateSchedule] error:', err.message);
    return res.status(500).json({ error: 'Server error al actualizar horario.' });
  }
};

exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });
    if (String(schedule.userId) !== String(userId)) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar este horario.' });
    }

    await Schedule.findByIdAndDelete(id);
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
    const userId = req.user?.id || req.user?._id;
    const { subject, teacher, room, dayIndex, startTime, endTime } = req.body || {};

    if (!subject?.trim()) return res.status(400).json({ error: 'La asignatura es requerida.' });
    if (dayIndex === undefined) return res.status(400).json({ error: 'El día es requerido.' });

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });
    if (String(schedule.userId) !== String(userId)) {
      return res.status(403).json({ error: 'No tienes permisos para editar este horario.' });
    }

    schedule.classes.push({
      subject: subject.trim(),
      teacher: teacher?.trim() || 'Sin profesor',
      room: room?.trim() || 'Por definir',
      dayIndex,
      startTime: startTime || '08:00',
      endTime: endTime || '09:30',
    });

    await schedule.save();
    return res.status(201).json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:addClass] error:', err.message);
    return res.status(500).json({ error: 'Server error al agregar clase.' });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const { id, classId } = req.params;
    const userId = req.user?.id || req.user?._id;
    const updates = req.body || {};

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });
    if (String(schedule.userId) !== String(userId)) {
      return res.status(403).json({ error: 'No tienes permisos para editar este horario.' });
    }

    const classItem = schedule.classes.id(classId);
    if (!classItem) return res.status(404).json({ error: 'Clase no encontrada.' });

    // Solo se actualizan los campos que vienen en el body (updates parciales)
    const allowedFields = [
      'subject', 'teacher', 'room', 'dayIndex', 'startTime', 'endTime',
      'attendances', 'absences', 'partialAttendances', 'canceledClasses',
    ];
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) classItem[field] = updates[field];
    });

    await schedule.save();
    return res.json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:updateClass] error:', err.message);
    return res.status(500).json({ error: 'Server error al actualizar clase.' });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { id, classId } = req.params;
    const userId = req.user?.id || req.user?._id;

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: 'Horario no encontrado.' });
    if (String(schedule.userId) !== String(userId)) {
      return res.status(403).json({ error: 'No tienes permisos para editar este horario.' });
    }

    schedule.classes.pull(classId);
    await schedule.save();

    return res.json(schedule.serialize());
  } catch (err) {
    console.error('[schedule:deleteClass] error:', err.message);
    return res.status(500).json({ error: 'Server error al eliminar clase.' });
  }
};
