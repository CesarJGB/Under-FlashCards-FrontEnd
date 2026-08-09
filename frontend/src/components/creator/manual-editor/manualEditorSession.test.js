import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canRestoreSelection,
  clampSelection,
  createManualEditorSession,
  manualEditorSessionReducer,
  requestColorPickerFromClick,
} from './manualEditorSession.js';

const reduce = (state, ...events) => events.reduce(manualEditorSessionReducer, state);

const createOpenSession = (side = 'question') => createManualEditorSession({
  initialSide: side,
  valueMeta: {
    question: { valueLength: 12, valueRevision: 1 },
    answer: { valueLength: 20, valueRevision: 1 },
  },
});

test('UT-SES-001 — opening owns one idempotent initial focus attempt without OSK state', () => {
  const initial = createOpenSession();
  const attempted = manualEditorSessionReducer(initial, {
    type: 'FOCUS_ATTEMPTED',
    requestId: initial.focusRequestId,
    reason: 'initial',
  });
  const repeatedAttempt = manualEditorSessionReducer(attempted, {
    type: 'FOCUS_ATTEMPTED',
    requestId: initial.focusRequestId,
    reason: 'initial',
  });
  const focused = manualEditorSessionReducer(repeatedAttempt, {
    type: 'FOCUS_OBSERVED',
    side: 'question',
  });
  const repeatedFocus = manualEditorSessionReducer(focused, {
    type: 'FOCUS_OBSERVED',
    side: 'question',
  });

  assert.equal(attempted.initialFocusAttempted, true);
  assert.strictEqual(repeatedAttempt, attempted);
  assert.strictEqual(repeatedFocus, focused);
  assert.equal(focused.phase, 'editing');
  assert.equal('keyboardOpen' in focused, false);
  assert.equal('osk' in focused, false);
});

test('UT-SES-002 — question and answer keep independent ranges and directions', () => {
  const initial = createOpenSession();
  const questionSelection = {
    start: 2,
    end: 7,
    direction: 'forward',
    valueLength: 12,
    valueRevision: 1,
  };
  const answerSelection = {
    start: 5,
    end: 14,
    direction: 'backward',
    valueLength: 20,
    valueRevision: 1,
  };
  const state = reduce(
    initial,
    { type: 'SELECTION_CAPTURED', side: 'question', selection: questionSelection },
    { type: 'SIDE_REQUESTED', side: 'answer' },
    { type: 'SELECTION_CAPTURED', side: 'answer', selection: answerSelection },
    { type: 'SIDE_REQUESTED', side: 'question' },
  );

  assert.equal(state.activeSide, 'question');
  assert.deepEqual(
    { start: state.selections.question.start, end: state.selections.question.end, direction: state.selections.question.direction },
    { start: 2, end: 7, direction: 'forward' },
  );
  assert.deepEqual(
    { start: state.selections.answer.start, end: state.selections.answer.end, direction: state.selections.answer.direction },
    { start: 5, end: 14, direction: 'backward' },
  );
  assert.notStrictEqual(state.selections.question, state.selections.answer);
});

test('UT-SES-003 — ranges clamp safely and revisions invalidate blind restoration', () => {
  const oversized = {
    start: 4,
    end: 99,
    direction: 'forward',
    valueLength: 12,
    valueRevision: 1,
  };
  assert.deepEqual(
    (({ start, end, direction }) => ({ start, end, direction }))(clampSelection(oversized, 12)),
    { start: 4, end: 12, direction: 'forward' },
  );
  assert.equal(canRestoreSelection(oversized, { valueLength: 12, valueRevision: 1 }), true);
  assert.equal(canRestoreSelection(oversized, { valueLength: 12, valueRevision: 2 }), false);
  assert.equal(canRestoreSelection(oversized, { valueLength: 8, valueRevision: 1 }), false);

  const initial = manualEditorSessionReducer(createOpenSession(), {
    type: 'SELECTION_CAPTURED',
    side: 'question',
    selection: oversized,
  });
  const changed = manualEditorSessionReducer(initial, {
    type: 'VALUE_CHANGED',
    side: 'question',
    valueLength: 12,
    valueRevision: 2,
  });
  assert.equal(canRestoreSelection(changed.selections.question, changed.valueMeta.question), false);
  assert.equal(changed.focusRequestId, initial.focusRequestId);
});

test('UT-SES-004 — presets are a session no-op and never create picker or resume state', () => {
  const initial = createOpenSession();
  const afterPreset = manualEditorSessionReducer(initial, {
    type: 'PRESET_APPLIED',
    side: 'question',
    value: '#3b82f6',
  });

  assert.strictEqual(afterPreset, initial);
  assert.equal(afterPreset.picker.status, 'idle');
  assert.equal(afterPreset.resume.available, false);
});

test('UT-SES-005 — resume affordance is non-authoritative and input removes it', () => {
  const initial = createOpenSession();
  const attempted = manualEditorSessionReducer(initial, {
    type: 'FOCUS_ATTEMPTED',
    requestId: initial.focusRequestId,
    reason: 'initial',
  });
  const failed = manualEditorSessionReducer(attempted, {
    type: 'FOCUS_FAILED',
    requestId: initial.focusRequestId,
  });
  assert.deepEqual(failed.resume, { available: true, reason: 'initial-focus-failed' });

  const resumed = manualEditorSessionReducer(failed, { type: 'RESUME_ACTIVATED' });
  assert.equal(resumed.resume.available, false);
  const offeredAgain = manualEditorSessionReducer(resumed, {
    type: 'RESUME_OFFERED',
    reason: 'picker-returned',
  });
  const typing = manualEditorSessionReducer(offeredAgain, { type: 'INPUT_OBSERVED' });
  assert.equal(typing.resume.available, false);
  assert.equal(typing.phase, 'editing');
  assert.equal('touchDevice' in typing, false);
});

test('UT-SES-006 — side switching waits for compositionend and uses the final side range', () => {
  const initial = createOpenSession();
  const composing = reduce(
    initial,
    { type: 'COMPOSITION_STARTED', side: 'question' },
    { type: 'SIDE_REQUESTED', side: 'answer' },
  );
  assert.equal(composing.activeSide, 'question');
  assert.equal(composing.pendingSide, 'answer');

  const ended = manualEditorSessionReducer(composing, {
    type: 'COMPOSITION_ENDED',
    side: 'question',
    selection: {
      start: 9,
      end: 9,
      direction: 'none',
      valueLength: 12,
      valueRevision: 1,
    },
  });
  assert.equal(ended.composition.active, false);
  assert.equal(ended.pendingSide, null);
  assert.equal(ended.activeSide, 'answer');
  assert.equal(ended.selections.question.start, 9);
});

test('UT-PICK-001 — color request, draft and commit are idempotent', () => {
  const initial = createOpenSession();
  const requested = manualEditorSessionReducer(initial, {
    type: 'PICKER_REQUESTED',
    transactionId: 1,
    kind: 'color',
    side: 'question',
  });
  const external = manualEditorSessionReducer(requested, {
    type: 'PICKER_EXTERNAL',
    transactionId: 1,
  });
  const drafted = manualEditorSessionReducer(external, {
    type: 'PICKER_INPUT',
    transactionId: 1,
    value: '#123456',
  });
  const repeatedDraft = manualEditorSessionReducer(drafted, {
    type: 'PICKER_INPUT',
    transactionId: 1,
    value: '#123456',
  });
  const committed = manualEditorSessionReducer(repeatedDraft, {
    type: 'PICKER_COMMITTED',
    transactionId: 1,
    value: '#123456',
  });
  const repeatedCommit = manualEditorSessionReducer(committed, {
    type: 'PICKER_COMMITTED',
    transactionId: 1,
    value: '#123456',
  });
  const resolved = manualEditorSessionReducer(repeatedCommit, {
    type: 'PICKER_RESOLVED',
    transactionId: 1,
  });

  assert.strictEqual(repeatedDraft, drafted);
  assert.equal(committed.picker.status, 'committed');
  assert.equal(committed.picker.committedValue, '#123456');
  assert.strictEqual(repeatedCommit, committed);
  assert.equal(resolved.picker.status, 'idle');
});

test('UT-PICK-002 — unknown and cancel do not mutate a color; stale events are ignored', () => {
  const requested = reduce(
    createOpenSession(),
    { type: 'PICKER_REQUESTED', transactionId: 2, kind: 'color', side: 'question' },
    { type: 'PICKER_EXTERNAL', transactionId: 2 },
    { type: 'PICKER_RETURN_SIGNAL', transactionId: 2 },
  );
  assert.equal(requested.picker.status, 'returned-unknown');
  assert.equal(requested.picker.committedValue, null);

  const stale = manualEditorSessionReducer(requested, {
    type: 'PICKER_COMMITTED',
    transactionId: 1,
    value: '#ffffff',
  });
  assert.strictEqual(stale, requested);

  const cancelled = manualEditorSessionReducer(requested, {
    type: 'PICKER_CANCELLED',
    transactionId: 2,
  });
  assert.equal(cancelled.picker.status, 'cancelled');
  assert.equal(cancelled.picker.committedValue, null);
  assert.equal(cancelled.picker.changed, false);
});

test('UT-PICK-003 — image commit, cancel and unknown preserve side and selection metadata', () => {
  const initial = manualEditorSessionReducer(createOpenSession('answer'), {
    type: 'SELECTION_CAPTURED',
    side: 'answer',
    selection: {
      start: 3,
      end: 11,
      direction: 'backward',
      valueLength: 20,
      valueRevision: 1,
    },
  });
  const request = (id) => reduce(
    initial,
    { type: 'PICKER_REQUESTED', transactionId: id, kind: 'image', side: 'answer' },
    { type: 'PICKER_EXTERNAL', transactionId: id },
  );

  const committed = manualEditorSessionReducer(request(3), {
    type: 'PICKER_COMMITTED', transactionId: 3, value: { type: 'image/png' },
  });
  const cancelled = manualEditorSessionReducer(request(4), {
    type: 'PICKER_CANCELLED', transactionId: 4,
  });
  const unknown = manualEditorSessionReducer(request(5), {
    type: 'PICKER_RETURN_SIGNAL', transactionId: 5,
  });

  for (const state of [committed, cancelled, unknown]) {
    assert.equal(state.picker.kind, 'image');
    assert.equal(state.picker.side, 'answer');
    assert.equal(state.picker.selectionAtOpen.start, 3);
    assert.equal(state.picker.selectionAtOpen.direction, 'backward');
    assert.deepEqual(state.selections.answer, initial.selections.answer);
  }
  assert.equal(committed.picker.status, 'committed');
  assert.equal(cancelled.picker.status, 'cancelled');
  assert.equal(unknown.picker.status, 'returned-unknown');
});

test('UT-PICK-004 — semantic click uses showPicker or one immediate click fallback', () => {
  let pickerCalls = 0;
  let clickCalls = 0;
  const success = requestColorPickerFromClick({
    showPicker() { pickerCalls += 1; },
    click() { clickCalls += 1; },
  });
  assert.deepEqual(success, { requested: true, method: 'showPicker' });
  assert.equal(pickerCalls, 1);
  assert.equal(clickCalls, 0);

  const absent = requestColorPickerFromClick({
    click() { clickCalls += 1; },
  });
  assert.deepEqual(absent, { requested: true, method: 'click' });
  assert.equal(clickCalls, 1);

  const throwing = requestColorPickerFromClick({
    showPicker() {
      pickerCalls += 1;
      throw new DOMException('not allowed', 'NotAllowedError');
    },
    click() { clickCalls += 1; },
  });
  assert.deepEqual(throwing, { requested: true, method: 'click' });
  assert.equal(pickerCalls, 2);
  assert.equal(clickCalls, 2);
});

