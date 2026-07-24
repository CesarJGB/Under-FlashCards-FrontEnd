// backend/src/models/Schedule.js
const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    teacher: { type: String, trim: true, default: 'Sin profesor' },
    room: { type: String, trim: true, default: 'Por definir' },
    dayIndex: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    attendances: { type: Number, default: 0, min: 0 },
    absences: { type: Number, default: 0, min: 0 },
    partialAttendances: { type: Number, default: 0, min: 0 },
    canceledClasses: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const scheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, default: 'Horario Principal' },
    daysCount: { type: Number, default: 5, min: 5, max: 7 },
    classes: { type: [classSchema], default: [] },
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
    classes: this.classes.map((c) => ({
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
