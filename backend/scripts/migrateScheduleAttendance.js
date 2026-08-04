require('dotenv').config();

const mongoose = require('mongoose');

function normalizeCounter(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Copies legacy attendance counters once, without deleting the legacy keys.
 * A present current key always wins, including a value of zero, so rerunning
 * this command is idempotent and cannot overwrite newer user data.
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
  const cursor = collection.find({}, { projection: { classes: 1 } });
  let examined = 0;
  let changedDocuments = 0;
  let copiedTardies = 0;
  let copiedParticipations = 0;

  for await (const schedule of cursor) {
    examined += 1;
    let changed = false;
    const classes = (schedule.classes || []).map((classItem) => {
      const next = { ...classItem };

      if (!hasOwn(classItem, 'tardies')) {
        next.tardies = normalizeCounter(classItem.partialAttendances);
        copiedTardies += 1;
        changed = true;
      }
      if (!hasOwn(classItem, 'participations')) {
        next.participations = normalizeCounter(classItem.canceledClasses);
        copiedParticipations += 1;
        changed = true;
      }

      return next;
    });

    if (changed) {
      changedDocuments += 1;
      if (!dryRun) {
        await collection.updateOne({ _id: schedule._id }, { $set: { classes } });
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
