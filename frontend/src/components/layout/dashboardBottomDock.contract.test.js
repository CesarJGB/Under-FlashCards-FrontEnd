import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const FRONTEND_ROOT = new URL('../../../', import.meta.url);

function source(relativePath) {
  return readFile(new URL(relativePath, FRONTEND_ROOT), 'utf8');
}

test('el navbar y su host flotante comparten un único dock de layout', async () => {
  const [app, dock, libraryFab, examFab, selector, creator, pdfExtractor] = await Promise.all([
    source('src/App.jsx'),
    source('src/components/layout/DashboardBottomDock.jsx'),
    source('src/components/library/LibraryFAB.jsx'),
    source('src/components/study/ExamFAB.jsx'),
    source('src/components/study/StudyDeckSelector.jsx'),
    source('src/components/FlashcardCreator.jsx'),
    source('src/components/creator/PdfExtractor.jsx'),
  ]);

  assert.match(app, /<DashboardBottomDock ref=\{mobileNavRef\}/);
  assert.doesNotMatch(app, /100dvh - env\(safe-area-inset-bottom\) - 9\.5rem/);
  assert.match(dock, /flex flex-col gap-4/);
  assert.match(dock, /safe-area-inset-bottom,0px/);
  assert.match(dock, /data-testid="dashboard-floating-controls-host"/);
  assert.match(dock, /data-testid="dashboard-mobile-nav"/);

  for (const consumer of [libraryFab, examFab, selector]) {
    assert.match(consumer, /createPortal/);
    assert.match(consumer, /floatingControlsHost/);
  }

  assert.doesNotMatch(libraryFab, /100dvh|100vh|safe-area-inset-bottom|9\.5rem/);
  assert.doesNotMatch(examFab, /safe-area-inset-bottom|6rem/);
  assert.doesNotMatch(selector, /safe-area-inset-bottom\)\+5rem/);
  assert.match(creator, /data-testid="creator-floating-controls-host"/);
  assert.match(pdfExtractor, /createPortal/);
  assert.match(pdfExtractor, /floatingControlsHost/);
  assert.doesNotMatch(pdfExtractor, /safe-area-inset-bottom|6rem/);
});

test('el calendario inmersivo conserva su geometría separada y no mantiene FABs duplicados', async () => {
  const [general, scheduleList, calendar, footer] = await Promise.all([
    source('src/components/library/GeneralSection.jsx'),
    source('src/components/library/calendar/ScheduleListScreen.jsx'),
    source('src/components/library/ScheduleCalendar.jsx'),
    source('src/components/library/calendar/ScheduleMobileFooter.jsx'),
  ]);

  assert.match(general, /onCalendarImmersiveChange\?\.\(view === ['"]calendar['"]\)/);
  assert.match(scheduleList, /safe-area-inset-bottom\) \+ 1rem/);
  assert.match(calendar, /ScheduleMobileFooter/);
  assert.doesNotMatch(calendar, /CalendarFAB/);
  assert.match(footer, /safe-area-inset-bottom/);

  await assert.rejects(access(new URL('src/components/library/CalendarFAB.jsx', FRONTEND_ROOT)));
  await assert.rejects(access(new URL('src/components/library/calendar/CalendarFAB.jsx', FRONTEND_ROOT)));
});
