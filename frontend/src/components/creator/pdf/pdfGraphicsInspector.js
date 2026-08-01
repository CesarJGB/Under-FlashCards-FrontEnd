import { isAbortError, throwIfAborted } from './pdfExtractionPrimitives.js';

const IMAGE_OPERATOR_NAMES = Object.freeze([
  'paintImageMaskXObject',
  'paintImageMaskXObjectRepeat',
  'paintImageXObject',
  'paintInlineImageXObject',
  'paintSolidColorImageMask',
  'paintJpegXObject',
]);

function getImageOperatorValues(pdfjsLib) {
  const ops = pdfjsLib?.OPS;
  if (!ops) return new Set();

  return new Set(
    IMAGE_OPERATOR_NAMES
      .map((name) => ops[name])
      .filter((value) => typeof value === 'number'),
  );
}

export function makeGraphicsState(inspection, extras = {}) {
  return {
    hasImages: null,
    imageCount: 0,
    operatorCount: 0,
    inspection,
    failed: false,
    ...extras,
  };
}

export async function inspectPageGraphics(page, pdfjsLib, signal) {
  throwIfAborted(signal);
  if (typeof page.getOperatorList !== 'function') return makeGraphicsState('unavailable');

  try {
    const operatorList = await page.getOperatorList();
    throwIfAborted(signal);
    const imageOps = getImageOperatorValues(pdfjsLib);
    if (!imageOps.size) {
      return makeGraphicsState('inspected', {
        operatorCount: operatorList.fnArray?.length ?? 0,
      });
    }

    const fnArray = Array.isArray(operatorList.fnArray) ? operatorList.fnArray : [];
    const imageCount = fnArray.reduce((count, fn) => count + (imageOps.has(fn) ? 1 : 0), 0);
    return makeGraphicsState('inspected', {
      hasImages: imageCount > 0,
      imageCount,
      operatorCount: fnArray.length,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    return makeGraphicsState('failed', { failed: true });
  }
}

export function resolveGraphicsInspection(inspectGraphics, profile) {
  if (inspectGraphics === false) return { shouldInspect: false, reason: 'disabled' };
  if (inspectGraphics === true || inspectGraphics === 'always') {
    return { shouldInspect: true, reason: 'forced' };
  }
  if (inspectGraphics === 'adaptive' || inspectGraphics == null) {
    return profile.shouldInspectGraphics
      ? { shouldInspect: true, reason: 'adaptive-suspicion' }
      : { shouldInspect: false, reason: 'skipped-simple' };
  }

  // Preserve the old opt-in behaviour for unknown truthy values instead of
  // silently weakening diagnostics because of a typo in a consumer.
  return { shouldInspect: Boolean(inspectGraphics), reason: 'forced' };
}
