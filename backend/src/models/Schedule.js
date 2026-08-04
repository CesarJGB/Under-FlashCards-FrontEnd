const mongoose = require('mongoose');
const {
  ATTENDANCE_FIELDS,
  normalizeClassSubjectKey,
  ensureSubjectProfiles,
  TIME_PATTERN,
  timeToMinutes,
  isValidHexColor,
} = require('../utils/scheduleUtils');

function normalizeAttendanceCounter(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

const subjectProfileSchema = new mongoose.Schema(
  {
    // Stable identity inside one schedule. It intentionally survives a rename
    // of the visible subject name.
    key: { type: String, required: true, trim: true, maxlength: 160 },
    name: { type: String, required: true, trim: true },
    teacher: { type: String, trim: true, default: 'Sin profesor' },
    room: { type: String, trim: true, default: 'Por definir' },
    color: { type: String, default: null, match: /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i },
    colorMode: { type: String, enum: ['automatic', 'custom'], default: 'automatic' },
    attendances: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    absences: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    tardies: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    participations: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  },
  { _id: false }
);

// Kept for compatibility with clients that only understand the old color
// registry. The canonical data lives in subjectProfiles.
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
    // The occurrence keeps its own subjectKey so its time remains independent
    // while shared identity and metrics live in subjectProfiles.
    subjectKey: { type: String, trim: true, default: null, maxlength: 160 },
    // null means the occurrence follows the shared profile. An explicit mode
    // represents a deliberate per-day color override.
    color: { type: String, default: null, match: /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i },
    colorMode: { type: String, enum: ['automatic', 'custom'], default: null },
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
    // These fields remain in the occurrence schema so old documents and old
    // clients can still be read. New serialized values come from the profile.
    attendances: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    absences: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    tardies: { type: Number, min: 0, validate: Number.isInteger },
    participations: { type: Number, min: 0, validate: Number.isInteger },
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
    subjectProfiles: { type: [subjectProfileSchema], default: [] },
    subjectColors: { type: [subjectColorSchema], default: [] },
  },
  { timestamps: true }
);

scheduleSchema.methods.serialize = function serialize() {
  const profiles = ensureSubjectProfiles(this);
  const profileMap = new Map(profiles.map((profile) => [profile.key, profile]));

  return {
    id: this._id,
    _id: this._id,
    userId: this.userId,
    name: this.name,
    daysCount: this.daysCount,
    subjectProfiles: profiles.map((profile) => ({
      key: profile.key,
      name: profile.name,
      teacher: profile.teacher,
      room: profile.room,
      color: profile.color || null,
      colorMode: profile.colorMode || (profile.color ? 'custom' : 'automatic'),
      ...Object.fromEntries(ATTENDANCE_FIELDS.map((field) => [field, normalizeAttendanceCounter(profile[field])])),
    })),
    subjectColors: profiles.map((profile) => ({
      key: profile.key,
      name: profile.name,
      color: profile.color || null,
    })),
    classes: this.classes.map((classItem) => {
      const subjectKey = normalizeClassSubjectKey(classItem.subjectKey, classItem.subject);
      const profile = profileMap.get(subjectKey);
      const explicitColor = classItem.colorMode === 'automatic'
        ? null
        : classItem.colorMode === 'custom'
          ? (isValidHexColor(classItem.color) ? classItem.color : null)
          : (profile?.color || (isValidHexColor(classItem.color) ? classItem.color : null));
      const colorMode = classItem.colorMode === 'custom'
        ? 'custom'
        : classItem.colorMode === 'automatic'
          ? 'automatic'
          : (profile?.color ? 'custom' : 'automatic');

      const serialized = {
        id: classItem._id,
        _id: classItem._id,
        subject: classItem.subject,
        teacher: classItem.teacher,
        room: classItem.room,
        subjectKey,
        color: explicitColor,
        colorMode,
        dayIndex: classItem.dayIndex,
        startTime: classItem.startTime,
        endTime: classItem.endTime,
      };

      ATTENDANCE_FIELDS.forEach((field) => {
        const profileValue = profile?.[field];
        const legacyValue = field === 'tardies' ? classItem.partialAttendances : field === 'participations' ? classItem.canceledClasses : classItem[field];
        serialized[field] = normalizeAttendanceCounter(profile ? profileValue : (classItem[field] ?? legacyValue));
      });

      // Legacy keys stay in API responses during the transition.
      serialized.partialAttendances = normalizeAttendanceCounter(serialized.tardies);
      serialized.canceledClasses = normalizeAttendanceCounter(serialized.participations);
      return serialized;
    }),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Schedule', scheduleSchema);
