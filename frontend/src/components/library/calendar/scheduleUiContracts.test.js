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
  assert.match(detail, /Actualizando materia/);
  assert.match(detail, /Eliminar sólo esta aparición/);
  assert.match(detail, /Eliminar la materia de todo el horario/);
  assert.match(settings, /safe-area-inset/);
  assert.match(settings, /min-h-11/);
  assert.match(settings, /dark:/);
});

test('el hook publica el contrato que consume el calendario y serializa la asistencia', async () => {
  const hook = await source('./useScheduleCalendar.js');
  const publicContract = hook.slice(hook.lastIndexOf('return {'));
  assert.match(publicContract, /subjectColors:/);
  assert.match(publicContract, /subjectProfiles:/);
  assert.match(publicContract, /savingClass,/);
  assert.match(publicContract, /savingSettings,/);
  assert.match(publicContract, /updatingAttendance,/);
  assert.match(publicContract, /reload: loadSchedule/);
  assert.match(hook, /savingClassRef\.current/);
  assert.match(hook, /attendanceQueueRef/);
  assert.match(hook, /attendanceDelta/);
});


test('el footer móvil conserva safe area, targets táctiles y concentra las acciones del horario', async () => {
  const [footer, calendar] = await Promise.all([
    source('./ScheduleMobileFooter.jsx'),
    source('../ScheduleCalendar.jsx'),
  ]);
  assert.match(footer, /data-testid="schedule-mobile-footer"/);
  assert.match(footer, /safe-area-inset-bottom/);
  assert.match(footer, /min-h-11/);
  assert.match(footer, /data-view-mode/);
  assert.match(footer, /onOpenScheduleActions/);
  assert.match(footer, /toca para más opciones/);
  assert.doesNotMatch(footer, /ChevronLeft|ChevronRight|onViewChange/);
  assert.match(footer, /grid-cols-\[44px_44px_minmax\(0,1fr\)_52px\]/);
  assert.doesNotMatch(calendar, /CalendarFAB/);
  assert.match(calendar, /hidden md:block/);
  assert.match(calendar, /isSwitcherOpen/);
  assert.match(calendar, /Opciones del horario/);
  assert.match(calendar, /Cambiar modo/);
  assert.match(calendar, /showModeSheet/);
});

test('la navegación global se controla con estado contextual y se limpia al salir del calendario', async () => {
  const [app, general, library] = await Promise.all([
    source('../../../App.jsx'),
    source('../GeneralSection.jsx'),
    source('../../LibrarySection.jsx'),
  ]);
  assert.match(app, /isCalendarImmersive/);
  assert.match(app, /onCalendarImmersiveChange/);
  assert.match(app, /pb-0/);
  assert.match(app, /!isCalendarImmersive/);
  assert.match(app, /tab === ['"]general['"]/);
  assert.match(app, /<GeneralSection\b/);
  assert.match(app, /userId=\{user\.id\}/);
  assert.match(app, /dashboardShell=\{dashboardShell\}/);
  assert.match(app, /onCalendarImmersiveChange=\{handleCalendarImmersiveChange\}/);
  assert.doesNotMatch(app, /ChatSection|MessageSquare|['"]chat['"]|['"]Chat['"]/);

  assert.match(general, /ScheduleListScreen/);
  assert.match(general, /view === ['"]calendar['"]/);
  assert.match(general, /onCalendarImmersiveChange\?\.\(view === ['"]calendar['"]\)/);
  assert.match(general, /setView\(['"]tools['"]\)/);
  assert.match(general, /return \(\) => \{[\s\S]*onCalendarImmersiveChange\?\.\(false\)/);

  assert.doesNotMatch(library, /sectionMode|GeneralSection|ScheduleListScreen|onCalendarImmersiveChange/);
});

test('la asistencia usa Retardos y Participaciones con claves nuevas', async () => {
  const [detail, hook, api, attendance] = await Promise.all([
    source('./modals/ClassDetailModal.jsx'),
    source('./useScheduleCalendar.js'),
    source('./scheduleApi.js'),
    source('./attendanceUtils.js'),
  ]);
  assert.match(detail, /tardies/);
  assert.match(detail, /Retardos/);
  assert.match(detail, /participations/);
  assert.match(detail, /Participaciones/);
  assert.match(hook, /isAttendanceField/);
  assert.match(api, /normalizeScheduleAttendance/);
  assert.match(attendance, /partialAttendances/);
  assert.match(attendance, /canceledClasses/);
  assert.match(attendance, /current value, including zero|present new value/i);
  assert.match(attendance, /subjectProfiles/);
});
