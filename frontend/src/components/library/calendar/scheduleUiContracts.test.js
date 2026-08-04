import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const BASE = new URL('.', import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, BASE), 'utf8');
}

test('selector Día/Semana y vista semanal conservan targets táctiles y dark mode', async () => {
  const [switcher, weekView] = await Promise.all([
    source('./ScheduleViewSwitcher.jsx'),
    source('./ScheduleWeekView.jsx'),
  ]);
  assert.match(switcher, /min-h-11/);
  assert.match(switcher, /dark:/);
  assert.match(switcher, /aria-pressed/);
  assert.match(weekView, /overflow-x-auto/);
  assert.match(weekView, /dark:/);
  assert.match(weekView, /aria-label/);
});

test('modales del calendario conservan safe areas, bloqueo de guardado y confirmación visible', async () => {
  const [form, detail, settings] = await Promise.all([
    source('./modals/ClassFormModal.jsx'),
    source('./modals/ClassDetailModal.jsx'),
    source('./modals/ScheduleSettingsModal.jsx'),
  ]);
  assert.match(form, /safe-area-inset-bottom/);
  assert.match(form, /disabled=\{saving\}/);
  assert.match(detail, /ActionSheet/);
  assert.match(detail, /showConfirmDelete/);
  assert.match(detail, /disabled=\{updatingAttendance\}/);
  assert.match(settings, /safe-area-inset/);
  assert.match(settings, /min-h-11/);
  assert.match(settings, /dark:/);
});

test('el hook publica el contrato que consume el calendario y bloquea envíos repetidos', async () => {
  const hook = await source('./useScheduleCalendar.js');
  const publicContract = hook.slice(hook.lastIndexOf('return {'));
  assert.match(publicContract, /subjectColors:/);
  assert.match(publicContract, /savingClass,/);
  assert.match(publicContract, /savingSettings,/);
  assert.match(publicContract, /updatingAttendance,/);
  assert.match(publicContract, /reload: loadSchedule/);
  assert.match(hook, /savingClassRef\.current/);
  assert.match(hook, /attendanceRef\.current/);
});
