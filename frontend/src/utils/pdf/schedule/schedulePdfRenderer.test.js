import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSchedulePdf, sanitizeSchedulePdfText } from './schedulePdfRenderer.js';

function sevenDaySchedule(eventsPerDay = 2) {
  return Array.from({ length: 7 }, (_, dayIndex) => Array.from({ length: eventsPerDay }, (__, index) => ({
    id: `${dayIndex}-${index}`,
    subject: index === 0 ? 'Termodinámica y equilibrio químico con nombre largo' : 'Cálculo diferencial',
    teacher: 'Profesora María de los Ángeles Rodríguez',
    room: 'Laboratorio de Operaciones Unitarias 204-B',
    dayIndex,
    startTime: `${String(8 + (index * 3)).padStart(2, '0')}:00`,
    endTime: `${String(9 + (index * 3)).padStart(2, '0')}:30`,
  }))).flat();
}

test('sanitiza guiones y caracteres fuera del repertorio PDF seguro', () => {
  assert.equal(sanitizeSchedulePdfText('Química — aula 2 … 🧪'), 'Química - aula 2 ...');
});

test('render portrait de siete días produce un solo buffer PDF y no siete páginas', async () => {
  const result = await renderSchedulePdf({
    scheduleName: 'Semestre Agosto 2026',
    classes: sevenDaySchedule(),
    daysCount: 7,
    orientation: 'portrait',
  });
  assert.equal(result.singleFile, true);
  assert.equal(result.pagesProcessed, 1);
  assert.match(result.fileName, /vertical\.pdf$/);
  assert.ok(result.buffer.byteLength > 1_000);
});

test('render landscape incluye toda la semana normal en una página', async () => {
  const result = await renderSchedulePdf({
    scheduleName: 'Horario: Química / Cálculo',
    classes: sevenDaySchedule(),
    daysCount: 7,
    orientation: 'landscape',
  });
  assert.equal(result.pagesProcessed, 1);
  assert.equal(result.fileName, 'Horario Química Cálculo-horizontal.pdf');
});

test('cancela durante un render multipágina', async () => {
  const controller = new AbortController();
  const promise = renderSchedulePdf({
    scheduleName: 'Horario extendido',
    classes: [
      { id: 'a', subject: 'A', dayIndex: 0, startTime: '04:00', endTime: '05:00' },
      { id: 'b', subject: 'B', dayIndex: 6, startTime: '22:30', endTime: '23:30' },
    ],
    daysCount: 7,
    orientation: 'landscape',
    signal: controller.signal,
    onProgress: ({ current }) => {
      if (current === 1) controller.abort();
    },
  });
  await assert.rejects(promise, (error) => error.name === 'AbortError');
});
