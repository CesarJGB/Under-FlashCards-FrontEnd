import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAttendanceField,
  normalizeAttendanceClass,
  normalizeScheduleListAttendance,
} from './attendanceUtils.js';

test('normaliza campos heredados a las claves nuevas', () => {
  const normalized = normalizeAttendanceClass({
    partialAttendances: 3,
    canceledClasses: 2,
  });

  assert.equal(normalized.tardies, 3);
  assert.equal(normalized.participations, 2);
});

test('un valor nuevo presente, incluido cero, no es reemplazado por el legado', () => {
  const normalized = normalizeAttendanceClass({
    tardies: 0,
    participations: 5,
    partialAttendances: 8,
    canceledClasses: 9,
  });

  assert.equal(normalized.tardies, 0);
  assert.equal(normalized.participations, 5);
});

test('normaliza listas cacheadas y limita los campos actualizables', () => {
  const schedules = normalizeScheduleListAttendance([
    { id: 'schedule-1', classes: [{ partialAttendances: 1, canceledClasses: 4 }] },
  ]);

  assert.equal(schedules[0].classes[0].tardies, 1);
  assert.equal(schedules[0].classes[0].participations, 4);
  assert.equal(isAttendanceField('tardies'), true);
  assert.equal(isAttendanceField('participations'), true);
  assert.equal(isAttendanceField('partialAttendances'), false);
  assert.equal(isAttendanceField('canceledClasses'), false);
});
