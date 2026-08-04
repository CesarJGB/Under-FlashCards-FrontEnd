const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Schedule = require('../src/models/Schedule');
const {
  applySubjectColor,
  classesOverlap,
  findScheduleConflict,
  validateClassInput,
} = require('../src/utils/scheduleUtils');

function classItem(overrides = {}) {
  return {
    _id: overrides._id || 'class-a',
    subject: 'Química',
    subjectKey: 'quimica',
    dayIndex: 0,
    startTime: '08:00',
    endTime: '09:00',
    ...overrides,
  };
}

test('detecta conflicto de mismo horario pero permite clases adyacentes', () => {
  const existing = classItem();
  assert.equal(classesOverlap(existing, classItem({ _id: 'b' })), true);
  assert.equal(classesOverlap(existing, classItem({ _id: 'c', startTime: '09:00', endTime: '10:00' })), false);
  assert.equal(findScheduleConflict([existing], classItem({ _id: 'b' }))._id, 'class-a');
  assert.equal(findScheduleConflict([existing], classItem({ _id: 'b' }), 'class-a'), null);
});

test('valida horas, días ocultos y colores personalizados', () => {
  assert.match(validateClassInput(classItem({ endTime: '07:00' })), /posterior/);
  assert.match(validateClassInput(classItem({ dayIndex: 6 }), { daysCount: 5 }), /no pertenece/);
  assert.equal(validateClassInput(classItem({ dayIndex: 6 }), { daysCount: 5, requireVisibleDay: false }), null);
  assert.equal(validateClassInput(classItem({ colorMode: null, color: null })), null);
  assert.match(validateClassInput(classItem({ colorMode: 'custom', color: 'rojo' })), /hexadecimal/);
});

test('aplica color personalizado o automático a todas las clases de una asignatura', () => {
  const schedule = {
    subjectColors: [],
    classes: [classItem(), classItem({ _id: 'b', dayIndex: 1 }), classItem({ _id: 'c', subject: 'Cálculo', subjectKey: 'calculo' })],
  };
  applySubjectColor(schedule, { subjectKey: 'quimica', subject: 'Química', colorMode: 'custom', color: '#123456' });
  assert.equal(schedule.subjectColors[0].color, '#123456');
  assert.deepEqual(schedule.classes.slice(0, 2).map((item) => [item.color, item.colorMode]), [['#123456', 'custom'], ['#123456', 'custom']]);
  assert.equal(schedule.classes[2].color, undefined);

  applySubjectColor(schedule, { subjectKey: 'quimica', subject: 'Química', colorMode: 'automatic', color: null });
  assert.equal(schedule.subjectColors[0].color, null);
  assert.deepEqual(schedule.classes.slice(0, 2).map((item) => [item.color, item.colorMode]), [[null, 'automatic'], [null, 'automatic']]);
});

test('serializa documentos existentes y usa el registro como fuente de color coherente', () => {
  const schedule = new Schedule({
    userId: new mongoose.Types.ObjectId(),
    name: 'Horario compatible',
    daysCount: 5,
    subjectColors: [
      { key: 'quimica', name: 'Química', color: '#123456' },
      { key: 'calculo', name: 'Cálculo', color: null },
    ],
    classes: [
      classItem({ _id: new mongoose.Types.ObjectId(), color: null, colorMode: null }),
      classItem({ _id: new mongoose.Types.ObjectId(), subject: 'Física', subjectKey: 'fisica', color: '#ABCDEF', colorMode: null, dayIndex: 1 }),
      classItem({ _id: new mongoose.Types.ObjectId(), subject: 'Cálculo', subjectKey: 'calculo', color: '#AA0000', colorMode: 'custom', dayIndex: 2 }),
    ],
  });
  const serialized = schedule.serialize();
  assert.deepEqual(serialized.classes.map((item) => [item.subjectKey, item.color, item.colorMode]), [
    ['quimica', '#123456', 'custom'],
    ['fisica', '#ABCDEF', 'custom'],
    ['calculo', null, 'automatic'],
  ]);
});


test('valida y serializa las métricas nuevas sin perder compatibilidad heredada', () => {
  assert.equal(validateClassInput(classItem({ tardies: 2, participations: 4 })), null);
  assert.match(validateClassInput(classItem({ tardies: -1 })), /tardies/);
  assert.match(validateClassInput(classItem({ participations: -1 })), /participations/);

  const legacy = new Schedule({
    userId: new mongoose.Types.ObjectId(),
    classes: [classItem({
      _id: new mongoose.Types.ObjectId(),
      partialAttendances: 3,
      canceledClasses: 2,
    })],
  });
  assert.equal(legacy.serialize().classes[0].tardies, 3);
  assert.equal(legacy.serialize().classes[0].participations, 2);

  const current = new Schedule({
    userId: new mongoose.Types.ObjectId(),
    classes: [classItem({
      _id: new mongoose.Types.ObjectId(),
      tardies: 0,
      participations: 5,
      partialAttendances: 8,
      canceledClasses: 9,
    })],
  });
  assert.equal(current.serialize().classes[0].tardies, 0);
  assert.equal(current.serialize().classes[0].participations, 5);
});
