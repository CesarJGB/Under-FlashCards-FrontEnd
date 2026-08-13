// FILE: frontend/tests/image-delivery/cover-thumbnail.test.js
// Corte 2 — pruebas de las funciones puras de la utilidad de miniaturas de
// portada (frontend/src/lib/coverThumbnail.js). El pipeline de canvas depende
// de APIs del navegador y se valida con el build y el contrato de fallo
// (generateCoverThumbnail devuelve '' sin lanzar cuando no puede producir una
// miniatura); aquí se cubre la geometría, el plan de intentos y la validación
// de la Data URL.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  THUMB_BUDGET_CHARS,
  THUMBNAIL_ATTEMPT_PLAN,
  isReasonableImageDataUrl,
  targetThumbDimensions,
  planThumbnailAttempts,
} from '../../src/lib/coverThumbnail.js';

test('thumb: THUMB_BUDGET_CHARS is the ~24 KiB data URL target', () => {
  assert.equal(THUMB_BUDGET_CHARS, 24 * 1024);
});

test('thumb: the attempt plan starts at 320px/0.78 and ends with a legible floor', () => {
  assert.deepEqual(THUMBNAIL_ATTEMPT_PLAN[0], { maxSide: 320, quality: 0.78 });
  const last = THUMBNAIL_ATTEMPT_PLAN[THUMBNAIL_ATTEMPT_PLAN.length - 1];
  assert.ok(last.maxSide >= 96, 'el último intento nunca es ilegible');
  assert.ok(last.quality >= 0.3);
});

test('thumb: targetThumbDimensions preserves aspect ratio for the larger side', () => {
  assert.deepEqual(targetThumbDimensions(1600, 1200, 320), { width: 320, height: 240 });
  assert.deepEqual(targetThumbDimensions(1200, 1600, 320), { width: 240, height: 320 });
  assert.deepEqual(targetThumbDimensions(4000, 1000, 320), { width: 320, height: 80 });
  assert.deepEqual(targetThumbDimensions(1000, 4000, 320), { width: 80, height: 320 });
});

test('thumb: targetThumbDimensions never upscales small images', () => {
  assert.deepEqual(targetThumbDimensions(200, 150, 320), { width: 200, height: 150 });
  assert.deepEqual(targetThumbDimensions(100, 200, 320), { width: 100, height: 200 });
  assert.deepEqual(targetThumbDimensions(320, 320, 320), { width: 320, height: 320 });
  assert.deepEqual(targetThumbDimensions(100, 400, 320), { width: 80, height: 320 }, 'un lado mayor que el límite sí se reduce');
});

test('thumb: targetThumbDimensions returns zero dimensions for invalid inputs without throwing', () => {
  assert.deepEqual(targetThumbDimensions(0, 0), { width: 0, height: 0 });
  assert.deepEqual(targetThumbDimensions(-5, 100), { width: 0, height: 0 });
  assert.deepEqual(targetThumbDimensions(100, NaN), { width: 0, height: 0 });
  assert.deepEqual(targetThumbDimensions('a', 100), { width: 0, height: 0 });
  assert.deepEqual(targetThumbDimensions(undefined, undefined), { width: 0, height: 0 });
});

test('thumb: planThumbnailAttempts never upscales and respects the plan order', () => {
  const attempts = planThumbnailAttempts(800, 600);
  assert.equal(attempts.length, THUMBNAIL_ATTEMPT_PLAN.length);
  for (const [i, attempt] of attempts.entries()) {
    assert.equal(attempt.quality, THUMBNAIL_ATTEMPT_PLAN[i].quality);
    const { width, height } = targetThumbDimensions(800, 600, THUMBNAIL_ATTEMPT_PLAN[i].maxSide);
    assert.deepEqual({ width: attempt.width, height: attempt.height }, { width, height });
    assert.ok(attempt.width <= 800 && attempt.height <= 600, 'sin ampliar');
  }
  const small = planThumbnailAttempts(120, 90);
  for (const attempt of small) {
    assert.equal(attempt.width, 120);
    assert.equal(attempt.height, 90);
  }
  assert.deepEqual(planThumbnailAttempts(800, 600, []), []);
  assert.deepEqual(planThumbnailAttempts(800, 600, null), []);
});

test('thumb: isReasonableImageDataUrl accepts raster data URLs with payload', () => {
  assert.equal(isReasonableImageDataUrl(`data:image/webp;base64,${'A'.repeat(2000)}`), true);
  assert.equal(isReasonableImageDataUrl('data:image/jpeg;base64,AAAAAA=='), true);
  assert.equal(isReasonableImageDataUrl('data:image/png;base64,BBBBBBBB'), true);
});

test('thumb: isReasonableImageDataUrl rejects non-raster, empty or oversized values', () => {
  assert.equal(isReasonableImageDataUrl(''), false);
  assert.equal(isReasonableImageDataUrl(null), false);
  assert.equal(isReasonableImageDataUrl(undefined), false);
  assert.equal(isReasonableImageDataUrl(42), false);
  assert.equal(isReasonableImageDataUrl('https://example.com/img.png'), false);
  assert.equal(isReasonableImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isReasonableImageDataUrl('data:text/html;base64,AAAA'), false);
  assert.equal(isReasonableImageDataUrl('data:image/webp;base64,'), false);
  assert.equal(isReasonableImageDataUrl(`data:image/webp;base64,${'A'.repeat(300 * 1024)}`), false);
});
