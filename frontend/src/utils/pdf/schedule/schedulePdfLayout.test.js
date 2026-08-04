import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchedulePdfLayout } from './schedulePdfLayout.js';

function buildWeek(daysCount, eventsPerDay = 2) {
  return Array.from({ length: daysCount }, (_, dayIndex) => (
    Array.from({ length: eventsPerDay }, (__, index) => ({
      id: `${dayIndex}-${index}`,
      subject: `Materia ${dayIndex + 1}`,
      dayIndex,
      startTime: `${String(8 + (index * 2)).padStart(2, '0')}:00`,
      endTime: `${String(9 + (index * 2)).padStart(2, '0')}:00`,
    }))
  )).flat();
}

test('crea semanas de 5, 6 y 7 días sin perder columnas visibles', () => {
  for (const daysCount of [5, 6, 7]) {
    const layout = createSchedulePdfLayout({ classes: buildWeek(daysCount), daysCount, orientation: 'landscape' });
    assert.equal(layout.pages[0].days.length, daysCount);
    assert.equal(layout.classes.length, daysCount * 2);
  }
});

test('portrait de siete días normales es una composición semanal de una página', () => {
  const layout = createSchedulePdfLayout({ classes: buildWeek(7, 2), daysCount: 7, orientation: 'portrait' });
  assert.equal(layout.pages.length, 1);
  assert.equal(layout.pages[0].type, 'portrait-week');
  assert.equal(layout.pages[0].columns.flat().length, 7);
  assert.notEqual(layout.pages.length, 7);
});

test('horario vacío mantiene los siete días en un único documento portrait', () => {
  const layout = createSchedulePdfLayout({ classes: [], daysCount: 7, orientation: 'portrait' });
  assert.equal(layout.pages.length, 1);
  assert.equal(layout.pages[0].columns.flat().length, 7);
  assert.ok(layout.pages[0].columns.every((column) => column.length > 0));
});

test('día libre intermedio se conserva dentro de la semana', () => {
  const classes = buildWeek(5, 1).filter((item) => item.dayIndex !== 2);
  const layout = createSchedulePdfLayout({ classes, daysCount: 5, orientation: 'portrait' });
  const wednesday = layout.pages.flatMap((page) => page.columns.flat()).find((section) => section.dayIndex === 2);
  assert.ok(wednesday);
  assert.equal(wednesday.items.length, 0);
});

test('landscape conserva todos los días en rango normal y divide rangos extremos por bandas', () => {
  const normal = createSchedulePdfLayout({ classes: buildWeek(7), daysCount: 7, orientation: 'landscape' });
  assert.equal(normal.pages.length, 1);
  assert.equal(normal.pages[0].days.length, 7);

  const extreme = createSchedulePdfLayout({
    classes: [
      { id: 'early', subject: 'Temprano', dayIndex: 0, startTime: '05:00', endTime: '06:00' },
      { id: 'late', subject: 'Tarde', dayIndex: 6, startTime: '22:00', endTime: '23:30' },
    ],
    daysCount: 7,
    orientation: 'landscape',
  });
  assert.equal(extreme.pages.length, 2);
  assert.ok(extreme.pages.every((page) => page.days.length === 7));
  assert.equal(extreme.pages[0].timeRange.end, extreme.pages[1].timeRange.start);
});

test('overflow portrait es controlado y no aplica una página fija por día', () => {
  const dense = buildWeek(7, 8).map((item, index) => ({
    ...item,
    startTime: `${String(6 + Math.floor((index % 8) * 1.5)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
    endTime: `${String(7 + Math.floor((index % 8) * 1.5)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
  }));
  const layout = createSchedulePdfLayout({ classes: dense, daysCount: 7, orientation: 'portrait' });
  assert.ok(layout.pages.length > 1);
  assert.notEqual(layout.pages.length, 7);
  assert.ok(layout.pages.every((page) => page.type === 'portrait-week'));
});

test('clases de días ocultos se conservan fuera de la exportación y se contabilizan', () => {
  const layout = createSchedulePdfLayout({ classes: buildWeek(7, 1), daysCount: 5, orientation: 'portrait' });
  assert.equal(layout.hiddenEventCount, 2);
  assert.equal(layout.classes.length, 5);
});
