import assert from 'node:assert/strict';
import test from 'node:test';

import {
  areGeometrySnapshotsEquivalent,
  compareGeometrySnapshots,
  createGeometryChangeSummary,
  createStabilityTracker,
  GEOMETRY_TOLERANCE_PX,
} from './viewportDebug.js';

const rect = (height = 812) => ({
  x: 0,
  y: 0,
  top: 0,
  right: 375,
  bottom: height,
  left: 0,
  width: 375,
  height,
});

const snapshot = (overrides = {}) => ({
  innerWidth: 375,
  innerHeight: 812,
  documentElementClientWidth: 375,
  documentElementClientHeight: 812,
  visualViewport: {
    width: 375,
    height: 812,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
  },
  safeArea: {
    safeTop: 53,
    safeBottom: 29,
    safeLeft: 0,
    safeRight: 0,
  },
  htmlRect: rect(),
  bodyRect: rect(),
  rootRect: rect(),
  loginSurfaceRect: rect(),
  ...overrides,
});

test('geometry comparison ignores changes up to the configured pixel tolerance', () => {
  const base = snapshot();
  const subpixel = snapshot({
    innerHeight: base.innerHeight + GEOMETRY_TOLERANCE_PX,
    visualViewport: { ...base.visualViewport, height: base.visualViewport.height + 0.49 },
  });
  const meaningful = snapshot({
    innerHeight: base.innerHeight + GEOMETRY_TOLERANCE_PX + 0.01,
  });

  assert.equal(compareGeometrySnapshots(base, subpixel).changed, false);
  assert.equal(compareGeometrySnapshots(base, meaningful).changed, true);
  assert.deepEqual(
    compareGeometrySnapshots(base, meaningful).changedFields,
    ['innerHeight'],
  );
});

test('comparison exposes viewport, safe-area and layout groups independently', () => {
  const result = compareGeometrySnapshots(snapshot(), snapshot({
    visualViewport: { width: 375, height: 759, offsetTop: 0, offsetLeft: 0, scale: 1 },
    safeArea: { safeTop: 0, safeBottom: 0, safeLeft: 0, safeRight: 0 },
    htmlRect: rect(759),
    bodyRect: rect(759),
  }));

  assert.equal(result.viewportChanged, true);
  assert.equal(result.visualViewportChanged, true);
  assert.equal(result.safeAreaChanged, true);
  assert.equal(result.htmlBodyChanged, true);
  assert.equal(result.rootChanged, false);
});

test('equivalent geometry can be used to deduplicate observer notifications', () => {
  const base = snapshot();
  const same = snapshot({ innerHeight: 812.4 });
  const changed = snapshot({ innerHeight: 811.4 });

  assert.equal(areGeometrySnapshotsEquivalent(base, same), true);
  assert.equal(areGeometrySnapshotsEquivalent(base, changed), false);

  const summary = createGeometryChangeSummary(changed, {
    elapsedMs: 56,
    reason: 'visualViewport.resize',
    comparison: compareGeometrySnapshots(base, changed),
    meaningful: true,
  });
  assert.equal(summary.reason, 'visualViewport.resize');
  assert.equal(summary.visualViewportHeight, 812);
  assert.deepEqual(summary.changedFields, ['innerHeight']);
});

test('stability does not confirm the initial quiet state before the minimum window', () => {
  const base = snapshot();
  const tracker = createStabilityTracker({
    initialSnapshot: base,
    minimumObservationMs: 100,
    observationWindowMs: 200,
    postConfirmationObservationMs: 0,
  });

  tracker.observe(base, { elapsedMs: 16, isFrame: true });
  tracker.observe(base, { elapsedMs: 32, isFrame: true });
  const early = tracker.observe(base, { elapsedMs: 48, isFrame: true });

  assert.equal(early.isStable, false);
  assert.equal(early.confirmationAtMs, null);

  tracker.observe(base, { elapsedMs: 100, isFrame: true });
  tracker.observe(base, { elapsedMs: 116, isFrame: true });
  const confirmed = tracker.observe(base, { elapsedMs: 132, isFrame: true });

  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.stableAtMs, 0);
  assert.equal(confirmed.unstableWindowMs, 0);
  assert.equal(confirmed.stableAfterFrames, 3);
  assert.equal(tracker.getState(199).isStable, false);
  assert.equal(tracker.getState(200).isStable, true);
});

test('a late geometry change invalidates a previous confirmation and restarts the frame count', () => {
  const base = snapshot();
  const tracker = createStabilityTracker({
    initialSnapshot: base,
    minimumObservationMs: 100,
    observationWindowMs: 200,
    postConfirmationObservationMs: 0,
  });

  tracker.observe(base, { elapsedMs: 100, isFrame: true });
  tracker.observe(base, { elapsedMs: 116, isFrame: true });
  const firstConfirmation = tracker.observe(base, { elapsedMs: 132, isFrame: true });
  assert.equal(firstConfirmation.status, 'confirmed');

  const changed = snapshot({
    innerHeight: 759,
    documentElementClientHeight: 759,
    visualViewport: { ...base.visualViewport, height: 759 },
  });
  const invalidated = tracker.observe(changed, { elapsedMs: 160, isFrame: true });
  assert.equal(invalidated.confirmationAtMs, null);
  assert.equal(invalidated.stableFrameCount, 0);

  tracker.observe(changed, { elapsedMs: 176, isFrame: true });
  tracker.observe(changed, { elapsedMs: 192, isFrame: true });
  const stable = tracker.observe(changed, { elapsedMs: 208, isFrame: true });

  assert.equal(stable.isStable, true);
  assert.equal(stable.stableAtMs, 160);
  assert.equal(stable.unstableWindowMs, 160);
  assert.equal(stable.stableFramesAtConfirmation, 3);
});

test('confirmation stays provisional during the post-confirmation hold window', () => {
  const base = snapshot();
  const tracker = createStabilityTracker({
    initialSnapshot: base,
    minimumObservationMs: 100,
    observationWindowMs: 100,
    postConfirmationObservationMs: 50,
  });

  tracker.observe(base, { elapsedMs: 100, isFrame: true });
  tracker.observe(base, { elapsedMs: 116, isFrame: true });
  const confirmed = tracker.observe(base, { elapsedMs: 132, isFrame: true });

  assert.equal(confirmed.status, 'confirmed');
  assert.equal(tracker.getState(181).isStable, false);
  assert.equal(tracker.getState(182).isStable, true);
});
