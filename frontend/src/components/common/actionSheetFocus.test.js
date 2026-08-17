import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTION_SHEET_SNAP_COMPACT,
  ACTION_SHEET_SNAP_EXPANDED,
} from './actionSheetDrag.js';
import {
  createActionSheetInputFocusState,
  endActionSheetInputFocus,
  enterActionSheetInputFocus,
  observeActionSheetInputFocusGeometry,
  shouldKeepActionSheetInputFocus,
} from './actionSheetFocus.js';

const geometry = (height, bottom = 0) => ({
  phase: 'stable',
  source: 'visual-viewport',
  orientation: 'portrait',
  layout: { left: 0, top: 0, width: 390, height: 844 },
  visual: { left: 0, top: 0, width: 390, height, scale: 1 },
  occlusion: { top: 0, right: 0, bottom, left: 0 },
});

test('UT-AS-FOCUS-001 — compact se restaura al terminar la edición', () => {
  const entered = enterActionSheetInputFocus(createActionSheetInputFocusState(), {
    currentSnap: ACTION_SHEET_SNAP_COMPACT,
    controlId: 'invite-code',
    geometry: geometry(844),
  });
  assert.equal(entered.shouldExpand, true);
  assert.equal(entered.state.previousSnap, ACTION_SHEET_SNAP_COMPACT);

  const keyboardOpen = observeActionSheetInputFocusGeometry(entered.state, geometry(480, 364));
  assert.equal(keyboardOpen.shouldExpand, true);
  const keyboardClosed = observeActionSheetInputFocusGeometry(keyboardOpen.state, geometry(844));
  assert.equal(keyboardClosed.restoreSnap, ACTION_SHEET_SNAP_COMPACT);

  const ended = endActionSheetInputFocus(keyboardClosed.state);
  assert.equal(ended.restoreSnap, ACTION_SHEET_SNAP_COMPACT);
  assert.equal(ended.state.active, false);
});

test('UT-AS-FOCUS-002 — un sheet expandido manualmente conserva expanded', () => {
  const entered = enterActionSheetInputFocus(createActionSheetInputFocusState(), {
    currentSnap: ACTION_SHEET_SNAP_EXPANDED,
    controlId: 'invite-code',
    geometry: geometry(844),
  });
  assert.equal(entered.shouldExpand, false);
  assert.equal(entered.state.previousSnap, ACTION_SHEET_SNAP_EXPANDED);

  const ended = endActionSheetInputFocus(entered.state);
  assert.equal(ended.restoreSnap, ACTION_SHEET_SNAP_EXPANDED);
});

test('UT-AS-FOCUS-003 — cambiar de input mantiene una única sesión de foco', () => {
  const first = enterActionSheetInputFocus(createActionSheetInputFocusState(), {
    currentSnap: ACTION_SHEET_SNAP_COMPACT,
    controlId: 'input-a',
    geometry: geometry(844),
  });
  const second = enterActionSheetInputFocus(first.state, {
    currentSnap: ACTION_SHEET_SNAP_EXPANDED,
    controlId: 'input-b',
    geometry: geometry(844),
  });

  assert.equal(second.shouldExpand, false);
  assert.equal(second.state.previousSnap, ACTION_SHEET_SNAP_COMPACT);
  assert.equal(second.state.controlId, 'input-b');
  assert.equal(endActionSheetInputFocus(second.state).restoreSnap, ACTION_SHEET_SNAP_COMPACT);
});

test('UT-AS-FOCUS-004 — un estado inesperado y el desmontaje no dejan snap temporal', () => {
  const idle = createActionSheetInputFocusState();
  assert.equal(endActionSheetInputFocus(idle).restoreSnap, null);

  const invalid = enterActionSheetInputFocus(idle, {
    currentSnap: 'unexpected',
    controlId: 'input',
  });
  assert.equal(endActionSheetInputFocus(invalid.state).restoreSnap, null);
  assert.deepEqual(endActionSheetInputFocus(invalid.state).state, idle);
});

test('UT-AS-FOCUS-005 — relatedTarget y activeElement solo conservan foco entre controles del sheet', () => {
  const inputA = { matches: (selector) => selector === 'input, textarea, select' };
  const inputB = { matches: (selector) => selector === 'input, textarea, select' };
  const button = { matches: () => false };
  const container = { contains: (target) => target === inputA || target === inputB };

  assert.equal(shouldKeepActionSheetInputFocus({ relatedTarget: inputB, container }), true);
  assert.equal(shouldKeepActionSheetInputFocus({ activeElement: inputB, container }), true);
  assert.equal(shouldKeepActionSheetInputFocus({ relatedTarget: button, container }), false);
});

test('UT-AS-FOCUS-006 — zoom y cambio de orientación no se confunden con cierre del teclado', () => {
  const entered = enterActionSheetInputFocus(createActionSheetInputFocusState(), {
    currentSnap: ACTION_SHEET_SNAP_COMPACT,
    controlId: 'invite-code',
    geometry: geometry(844),
  });
  const zoomed = observeActionSheetInputFocusGeometry(entered.state, {
    ...geometry(480, 364),
    orientation: 'portrait',
    visual: { ...geometry(480, 364).visual, scale: 1.1 },
  });
  assert.equal(zoomed.state.occlusionObserved, false);
  assert.equal(zoomed.restoreSnap, null);

  const rotated = observeActionSheetInputFocusGeometry(entered.state, {
    ...geometry(844),
    orientation: 'landscape',
    layout: { left: 0, top: 0, width: 844, height: 390 },
    visual: { left: 0, top: 0, width: 844, height: 390, scale: 1 },
  });
  assert.equal(rotated.state.occlusionObserved, false);
  assert.equal(rotated.restoreSnap, null);
});
