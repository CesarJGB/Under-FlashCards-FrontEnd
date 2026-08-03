// backend/src/models/Schedule.js
const mongoose = require('mongoose');
const { normalizeClassSubjectKey, TIME_PATTERN, timeToMinutes } = require('../utils/scheduleUtils');

const subjectColorSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: null, match: /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i },
  },
  { _id: false }
);

const classSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    teacher: { type: String, trim: true, default: 'Sin profesor' },
    room: { type: String, trim: true, default: 'Por definir' },
    // Stable identity within this schedule. Old documents may not contain it;
    // serialize() derives it from the normalized subject until the class is saved.
    subjectKey: { type: String, trim: true, default: null, maxlength: 160 },
    // null means automatic deterministic color; an explicit value is a user override.
    color: { type: String, default: null, match: /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i },
    dayIndex: { type: Number, required: true, min: 0, max: 6, validate: Number.isInteger },
    startTime: { type: String, required: true, match: TIME_PATTERN },
    endTime: {
      type: String,
      required: true,
      match: TIME_PATTERN,
      validate: {
        validator(value) {
          const start = timeToMinutes(this.startTime);
          const end = timeToMinutes(value);
          return start === null || end === null || end > start;
        },
        message: 'La hora final debe ser posterior a la hora inicial.',
      },
    },
    attendances: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    absences: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    partialAttendances: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    canceledClasses: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  },
  { timestamps: true }
);

const scheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, default: 'Horario Principal' },
    daysCount: { type: Number, default: 5, min: 5, max: 7, validate: Number.isInteger },
    classes: { type: [classSchema], default: [] },
    // Small per-schedule registry keeps the same subject coherent without
    // coupling schedules to the academic library's Materia collection.
    subjectColors: { type: [subjectColorSchema], default: [] },
  },
  { timestamps: true }
);

scheduleSchema.methods.serialize = function () {
  return {
    id: this._id,
    _id: this._id,
    userId: this.userId,
    name: this.name,
    daysCount: this.daysCount,
    subjectColors: (this.subjectColors || []).map((entry) => ({
      key: entry.key,
      name: entry.name,
      color: entry.color || null,
    })),
    classes: this.classes.map((c) => ({
      ...(() => {
        const subjectKey = normalizeClassSubjectKey(c.subjectKey, c.subject);
        const registryEntry = (this.subjectColors || []).find((entry) => entry.key === subjectKey);
        const explicitColor = c.color || registryEntry?.color || null;
        return {
          subjectKey,
          color: explicitColor,
          colorMode: explicitColor ? 'custom' : 'automatic',
        };
      })(),
      id: c._id,
      subject: c.subject,
      teacher: c.teacher,
      room: c.room,
      dayIndex: c.dayIndex,
      startTime: c.startTime,
      endTime: c.endTime,
      attendances: c.attendances,
      absences: c.absences,
      partialAttendances: c.partialAttendances,
      canceledClasses: c.canceledClasses,
    })),
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Schedule', scheduleSchema);
