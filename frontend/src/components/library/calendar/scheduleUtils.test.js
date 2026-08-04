import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getClassTemporalState,
  getDurationMinutes,
  getInitialDayIndex,
  getScheduleColorMode,
  getSubjectKey,
  normalizeSubjectName,
  resolveScheduleClassColor,
  timeToMinutes,
} from './scheduleUtils.js';

test('normaliza identidad de asignatura sin acentos ni espacios duplicados', () => {
  assert.equal(normalizeSubjectName('  Química   Orgánica '), 'quimica organica');
  assert.equal(getSubjectKey('Química Orgánica'), 'quimica organica');
});

test('convierte horas válidas y calcula duraciones cortas o largas', () => {
  assert.equal(timeToMinutes('08:30'), 510);
  assert.equal(timeToMinutes('25:00'), null);
  assert.equal(getDurationMinutes({ startTime: '08:30', endTime: '09:00' }), 30);
  assert.equal(getDurationMinutes({ startTime: '08:30', endTime: '12:30' }), 240);
});

test('abre hoy cuando es visible y recuerda otro día válido cuando no lo es', () => {
  const sunday = new Date(2026, 7, 2, 12, 0, 0);
  assert.equal(getInitialDayIndex(7, 1, sunday), 6);
  assert.equal(getInitialDayIndex(5, 3, sunday), 3);
  assert.equal(getInitialDayIndex(5, 8, sunday), 0);
});

test('el registro compartido prevalece y un override local conserva su alcance', () => {
  const classItem = { subject: 'Química', subjectKey: 'quimica', colorMode: null };
  const automatic = resolveScheduleClassColor({ ...classItem, colorMode: 'automatic' }, []);
  const registry = [{ key: 'quimica', name: 'Química', color: '#123456' }];
  const automaticRegistry = [{ key: 'quimica', name: 'Química', color: null }];
  assert.match(automatic, /^#[0-9A-F]{6}$/i);
  assert.equal(resolveScheduleClassColor(classItem, registry), '#123456');
  assert.equal(getScheduleColorMode(classItem, registry), 'custom');
  assert.equal(resolveScheduleClassColor({ ...classItem, color: '#ABCDEF', colorMode: 'custom' }, automaticRegistry), '#ABCDEF');
  assert.equal(getScheduleColorMode({ ...classItem, color: '#ABCDEF', colorMode: 'custom' }, automaticRegistry), 'custom');
});

test('detecta una clase actual solo en el día seleccionado correcto', () => {
  const now = new Date(2026, 7, 3, 9, 0, 0); // Lunes
  const item = { dayIndex: 0, startTime: '08:30', endTime: '10:00' };
  assert.equal(getClassTemporalState(item, 0, now), 'current');
  assert.equal(getClassTemporalState(item, 1, now), 'scheduled');
});
