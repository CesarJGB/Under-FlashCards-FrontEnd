import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getClassTemporalState,
  getDurationMinutes,
  getInitialDayIndex,
  getSubjectKey,
  normalizeSubjectName,
  resolveScheduleClassColor,
  timeToMinutes,
} from './scheduleUtils.js';
import { createSchedulePdfLayout } from '../../../utils/pdf/schedule/schedulePdfLayout.js';

test('normalizes subject identity without accents or duplicate spaces', () => {
  assert.equal(normalizeSubjectName('  QuÃ­mica   OrgÃ¡nica '), 'quimica organica');
  assert.equal(getSubjectKey('QuÃ­mica OrgÃ¡nica'), 'quimica organica');
});

test('converts valid times and calculates duration', () => {
  assert.equal(timeToMinutes('08:30'), 510);
  assert.equal(timeToMinutes('25:00'), null);
  assert.equal(getDurationMinutes({ startTime: '08:30', endTime: '10:00' }), 90);
});

test('opens today when visible and remembers a valid day otherwise', () => {
  const sunday = new Date(2026, 7, 2, 12, 0, 0);
  assert.equal(getInitialDayIndex(7, 1, sunday), 6);
  assert.equal(getInitialDayIndex(5, 3, sunday), 3);
  assert.equal(getInitialDayIndex(5, 8, sunday), 0);
});

test('resolves custom schedule colors before deterministic fallback', () => {
  const classItem = { subject: 'QuÃ­mica', subjectKey: 'quimica' };
  const automatic = resolveScheduleClassColor(classItem, []);
  const custom = resolveScheduleClassColor(classItem, [{ key: 'quimica', name: 'QuÃ­mica', color: '#123456' }]);
  assert.match(automatic, /^#[0-9A-F]{6}$/i);
  assert.equal(custom, '#123456');
});

test('detects current class only on the selected current day', () => {
  const now = new Date(2026, 7, 3, 9, 0, 0); // Monday
  const item = { dayIndex: 0, startTime: '08:30', endTime: '10:00' };
  assert.equal(getClassTemporalState(item, 0, now), 'current');
  assert.equal(getClassTemporalState(item, 1, now), 'scheduled');
});

test('creates readable PDF layouts for both orientations and empty schedules', () => {
  const classes = [
    { dayIndex: 0, subject: 'QuÃ­mica', startTime: '07:00', endTime: '08:30' },
    { dayIndex: 4, subject: 'MatemÃ¡ticas', startTime: '19:00', endTime: '20:00' },
  ];
  const horizontal = createSchedulePdfLayout({ classes, daysCount: 5, orientation: 'landscape' });
  const vertical = createSchedulePdfLayout({ classes, daysCount: 5, orientation: 'portrait' });
  const empty = createSchedulePdfLayout({ classes: [], daysCount: 7, orientation: 'portrait' });
  assert.equal(horizontal.pages[0].type, 'week');
  assert.equal(horizontal.pages[0].days.length, 5);
  assert.equal(vertical.pages.length, 5);
  assert.equal(empty.pages[0].type, 'empty');
});