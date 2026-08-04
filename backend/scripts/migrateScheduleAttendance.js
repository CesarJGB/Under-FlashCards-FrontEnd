require('dotenv').config();

const mongoose = require('mongoose');
const { ATTENDANCE_FIELDS, ensureSubjectProfiles } = require('../src/utils/scheduleUtils');

function normalizeCounter(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

/**
 * Backfills the shared subject registry and current attendance names without
 * deleting legacy fields. The operation is idempotent: a profile already
 * present remains authoritative and rerunning the command does not sum
 * occurrence counters.
 *
 * Use --dry-run to inspect how many documents would change before writing.
 */
async function migrate() {
  const mongoUri = process.env.MONGO_URL || process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || 'flashcards';
  const dryRun = process.argv.includes('--dry-run');

  if (!mongoUri) throw new Error('MONGO_URL o MONGO_URI es obligatorio.');

  await mongoose.connect(mongoUri, { dbName });
  const collection = mongoose.connection.db.collection('schedules');
  const cursor = collection.find({}, { projection: { classes: 1, subjectProfiles: 1, subjectColors: 1 } });
  let examined = 0;
  let changedDocuments = 0;
  let copiedTardies = 0;
  let copiedParticipations = 0;

  for await (const schedule of cursor) {
    examined += 1;
    const before = JSON.stringify({
      classes: schedule.classes || [],
      subjectProfiles: schedule.subjectProfiles || [],
      subjectColors: schedule.subjectColors || [],
    });

    const profiles = ensureSubjectProfiles(schedule);
    const profileMap = new Map(profiles.map((profile) => [profile.key, profile]));
    const classes = (schedule.classes || []).map((classItem) => {
      const profile = profileMap.get(classItem.subjectKey);
      const next = { ...classItem };
      if (!hasOwn(classItem, 'tardies')) copiedTardies += 1;
      if (!hasOwn(classItem, 'participations')) copiedParticipations += 1;
      ATTENDANCE_FIELDS.forEach((field) => {
        const value = normalizeCounter(profile?.[field] ?? classItem[field]);
        next[field] = value;
        if (field === 'tardies') next.partialAttendances = value;
        if (field === 'participations') next.canceledClasses = value;
      });
      return next;
    });

    const afterPayload = {
      classes,
      subjectProfiles: profiles,
      subjectColors: schedule.subjectColors || [],
    };
    const changed = before !== JSON.stringify(afterPayload);
    if (changed) {
      changedDocuments += 1;
      if (!dryRun) {
        await collection.updateOne({ _id: schedule._id }, { $set: afterPayload });
      }
    }
  }

  console.log(JSON.stringify({
    dryRun,
    examined,
    changedDocuments,
    copiedTardies,
    copiedParticipations,
  }, null, 2));
}

migrate()
  .catch((error) => {
    console.error('No se pudo migrar la asistencia de horarios:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
