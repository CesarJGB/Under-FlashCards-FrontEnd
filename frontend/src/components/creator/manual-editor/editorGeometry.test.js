import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createUnavailableEditorGeometry,
  GEOMETRY_CSS_PX_TOLERANCE,
  geometrySamplesEqual,
  needsInitialEditorGeometryFallback,
  readEditorGeometry,
  reduceEditorGeometry,
} from './editorGeometry.js';
import { observeEditorGeometry } from './useEditorGeometry.js';

const createDocument = (width, height) => ({
  documentElement: { clientWidth: width, clientHeight: height },
});

const createWindow = ({
  innerWidth = 390,
  innerHeight = 844,
  visualViewport,
} = {}) => ({ innerWidth, innerHeight, visualViewport });

const stabilize = (state, sample) => {
  const settling = reduceEditorGeometry(state, { type: 'SAMPLE', sample });
  return reduceEditorGeometry(settling, { type: 'CONFIRM', sample });
};

test('UT-GEO-001 — fallback without VisualViewport uses the smallest valid layout rect', () => {
  const sample = readEditorGeometry(
    createWindow({ innerWidth: 400, innerHeight: 820 }),
    createDocument(390, 800),
  );

  assert.ok(sample);
  assert.equal(sample.source, 'layout-fallback');
  assert.deepEqual(sample.layout, { left: 0, top: 0, width: 390, height: 800 });
  assert.deepEqual(sample.visual, { left: 0, top: 0, width: 390, height: 800, scale: 1 });
  assert.deepEqual(sample.occlusion, { top: 0, right: 0, bottom: 0, left: 0 });
  assert.equal(Object.hasOwn(sample, 'keyboardOpen'), false);
});

test('UT-GEO-002 — an identical stable sample preserves reference and revision', () => {
  const sample = readEditorGeometry(createWindow(), createDocument(390, 844));
  const stable = stabilize(createUnavailableEditorGeometry(), sample);
  const repeated = reduceEditorGeometry(stable, { type: 'SAMPLE', sample: structuredClone(sample) });
  const confirmed = reduceEditorGeometry(repeated, { type: 'CONFIRM', sample: structuredClone(sample) });

  assert.equal(repeated, stable);
  assert.equal(confirmed, stable);
  assert.equal(confirmed.revision, stable.revision);
  assert.equal(geometrySamplesEqual(stable, sample), true);
});

test('UT-GEO-003 — orientation changes start new epochs without historical baselines', () => {
  const portrait = readEditorGeometry(createWindow(), createDocument(390, 844));
  const landscape = readEditorGeometry(
    createWindow({ innerWidth: 844, innerHeight: 390 }),
    createDocument(844, 390),
  );
  const portraitAgain = readEditorGeometry(createWindow(), createDocument(390, 844));

  const first = stabilize(createUnavailableEditorGeometry(), portrait);
  const second = stabilize(first, landscape);
  const third = stabilize(second, portraitAgain);

  assert.equal(first.orientation, 'portrait');
  assert.equal(second.orientation, 'landscape');
  assert.equal(third.orientation, 'portrait');
  assert.equal(second.epoch, first.epoch + 1);
  assert.equal(third.epoch, second.epoch + 1);
  assert.equal(second.layout.height, 390);
});

test('UT-GEO-004 — a late update returns stable geometry to settling and can stabilize again', () => {
  const initial = readEditorGeometry(createWindow({
    visualViewport: { width: 390, height: 700, offsetLeft: 0, offsetTop: 20, scale: 1 },
  }), createDocument(390, 844));
  const late = readEditorGeometry(createWindow({
    visualViewport: { width: 390, height: 680, offsetLeft: 0, offsetTop: 32, scale: 1 },
  }), createDocument(390, 844));
  const stable = stabilize(createUnavailableEditorGeometry(), initial);
  const settling = reduceEditorGeometry(stable, { type: 'SAMPLE', sample: late });
  const restabilized = reduceEditorGeometry(settling, { type: 'CONFIRM', sample: late });

  assert.equal(stable.phase, 'stable');
  assert.equal(settling.phase, 'settling');
  assert.equal(restabilized.phase, 'stable');
  assert.equal(restabilized.visual.top, 32);
  assert.ok(restabilized.revision > stable.revision);
});

test('UT-GEO-005 — snapshot keeps both axes, scale and all four occlusions', () => {
  const sample = readEditorGeometry(createWindow({
    innerWidth: 400,
    innerHeight: 800,
    visualViewport: {
      width: 370,
      height: 700,
      offsetLeft: 10,
      offsetTop: 20,
      scale: 1.5,
    },
  }), createDocument(400, 800));

  assert.deepEqual(sample.layout, { left: 0, top: 0, width: 400, height: 800 });
  assert.deepEqual(sample.visual, {
    left: 10,
    top: 20,
    width: 370,
    height: 700,
    scale: 1.5,
  });
  assert.deepEqual(sample.occlusion, { top: 20, right: 20, bottom: 80, left: 10 });
  assert.equal(sample.source, 'visual-viewport');
});

test('UT-GEO-006 — invalid viewport values fall back or preserve the last valid sample', () => {
  const fallback = readEditorGeometry(createWindow({
    visualViewport: {
      width: Number.NaN,
      height: 0,
      offsetLeft: Number.POSITIVE_INFINITY,
      offsetTop: 0,
      scale: -1,
    },
  }), createDocument(390, 844));
  assert.equal(fallback.source, 'layout-fallback');
  assert.ok(fallback.layout.width > 0 && fallback.layout.height > 0);

  const stable = stabilize(createUnavailableEditorGeometry(), fallback);
  const unavailable = reduceEditorGeometry(stable, {
    type: 'SAMPLE',
    sample: {
      ...fallback,
      visual: { ...fallback.visual, width: -20 },
    },
  });
  assert.equal(unavailable.phase, 'unavailable');
  assert.deepEqual(unavailable.layout, stable.layout);
  assert.deepEqual(unavailable.visual, stable.visual);

  const missing = readEditorGeometry(
    createWindow({ innerWidth: 0, innerHeight: Number.NaN }),
    createDocument(0, Number.POSITIVE_INFINITY),
  );
  assert.equal(missing, null);
});

test('UT-GEO-007 — subpixel jitter stabilizes and cumulative real change settles again', () => {
  const base = readEditorGeometry(createWindow({
    visualViewport: { width: 389.8, height: 699.8, offsetLeft: 0.2, offsetTop: 20.2, scale: 1 },
  }), createDocument(390, 844));
  const stable = stabilize(createUnavailableEditorGeometry(), base);
  let current = stable;

  for (const delta of [0.18, -0.16, 0.24, -0.21, 0.12]) {
    const jitter = {
      ...base,
      visual: {
        ...base.visual,
        left: base.visual.left + delta,
        top: base.visual.top - delta,
        width: base.visual.width + delta,
        height: base.visual.height - delta,
      },
      occlusion: {
        ...base.occlusion,
        top: base.occlusion.top - delta,
        right: base.occlusion.right - delta,
        bottom: base.occlusion.bottom + delta,
        left: base.occlusion.left + delta,
      },
    };
    current = reduceEditorGeometry(current, { type: 'SAMPLE', sample: jitter });
  }

  assert.equal(current, stable);
  assert.equal(current.phase, 'stable');
  assert.equal(current.revision, stable.revision);

  const realChange = {
    ...base,
    visual: {
      ...base.visual,
      height: base.visual.height - GEOMETRY_CSS_PX_TOLERANCE - 1,
    },
    occlusion: {
      ...base.occlusion,
      bottom: base.occlusion.bottom + GEOMETRY_CSS_PX_TOLERANCE + 1,
    },
  };
  const settling = reduceEditorGeometry(current, { type: 'SAMPLE', sample: realChange });
  assert.equal(settling.phase, 'settling');
  assert.ok(settling.revision > stable.revision);
});

test('initial geometry fallback applies only before the first valid sample', () => {
  const initial = createUnavailableEditorGeometry();
  assert.equal(needsInitialEditorGeometryFallback(initial), true);

  const sample = readEditorGeometry(createWindow(), createDocument(390, 844));
  const stable = stabilize(initial, sample);
  const unavailableAfterSample = reduceEditorGeometry(stable, { type: 'SOURCE_UNAVAILABLE' });
  assert.equal(needsInitialEditorGeometryFallback(unavailableAfterSample), false);
  assert.deepEqual(unavailableAfterSample.visual, stable.visual);
});

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
    this.added = 0;
    this.removed = 0;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    this.added += 1;
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
    this.removed += 1;
  }

  dispatch(type) {
    [...(this.listeners.get(type) || [])].forEach((listener) => listener({ type }));
  }

  count() {
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }
}

class FakeWindow extends FakeEventTarget {
  constructor() {
    super();
    this.innerWidth = 390;
    this.innerHeight = 844;
    this.visualViewport = Object.assign(new FakeEventTarget(), {
      width: 390,
      height: 700,
      offsetLeft: 0,
      offsetTop: 20,
      scale: 1,
    });
    this.frames = new Map();
    this.cancelled = [];
    this.nextFrameId = 1;
  }

  requestAnimationFrame(callback) {
    const id = this.nextFrameId;
    this.nextFrameId += 1;
    this.frames.set(id, callback);
    return id;
  }

  cancelAnimationFrame(id) {
    this.cancelled.push(id);
    this.frames.delete(id);
  }

  takeFrame() {
    const entry = this.frames.entries().next().value;
    if (!entry) return null;
    this.frames.delete(entry[0]);
    return entry[1];
  }
}

test('UT-LIFE-001 — geometry observation cleans listeners/rAF and ignores late callbacks', () => {
  const windowLike = new FakeWindow();
  const documentLike = createDocument(390, 844);
  let publications = 0;
  const cleanup = observeEditorGeometry({
    windowLike,
    documentLike,
    onSnapshot() { publications += 1; },
  });
  const lateCallback = windowLike.takeFrame();

  assert.equal(windowLike.count(), 1);
  assert.equal(windowLike.visualViewport.count(), 2);
  cleanup();
  cleanup();
  lateCallback?.(0);

  assert.equal(publications, 0);
  assert.equal(windowLike.count(), 0);
  assert.equal(windowLike.visualViewport.count(), 0);
  assert.equal(windowLike.removed, 1);
  assert.equal(windowLike.visualViewport.removed, 2);
});

test('UT-LIFE-001 / StrictMode — setup-cleanup cycles do not accumulate resources', () => {
  const windowLike = new FakeWindow();
  const documentLike = createDocument(390, 844);
  const first = observeEditorGeometry({ windowLike, documentLike });
  first();
  const second = observeEditorGeometry({ windowLike, documentLike });
  second();

  assert.equal(windowLike.count(), 0);
  assert.equal(windowLike.visualViewport.count(), 0);
  assert.equal(windowLike.added, windowLike.removed);
  assert.equal(windowLike.visualViewport.added, windowLike.visualViewport.removed);
  assert.equal(windowLike.frames.size, 0);
});
