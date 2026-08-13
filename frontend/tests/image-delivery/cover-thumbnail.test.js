// FILE: frontend/tests/image-delivery/cover-thumbnail.test.js
// Corte 2 — pruebas de las funciones puras de la utilidad de miniaturas de
// portada (frontend/src/lib/coverThumbnail.js). El pipeline de canvas depende
// de APIs del navegador y se valida con el build y el contrato de fallo
// (generateCoverThumbnail devuelve '' sin lanzar cuando no puede producir una
// miniatura); aquí se cubre la geometría, el plan de intentos y la validación
// de la Data URL.
//
// Corrección puntual post-cierre — pruebas deterministas del rastreador de
// generaciones (frontend/src/lib/coverThumbnailTracker.js): cancelación segura
// al eliminar la portada e intercalación de selecciones A/B.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  THUMB_BUDGET_CHARS,
  THUMBNAIL_ATTEMPT_PLAN,
  isReasonableImageDataUrl,
  targetThumbDimensions,
  planThumbnailAttempts,
} from '../../src/lib/coverThumbnail.js';
import {
  createCoverThumbnailTracker,
  beginThumbnailGeneration,
  trackThumbnailPromise,
  isCurrentThumbnailToken,
  cancelThumbnailGeneration,
  getPendingThumbnail,
  isCoverProcessing,
  releaseCoverProcessing,
  resolveSubmitThumbnail,
} from '../../src/lib/coverThumbnailTracker.js';
import { buildDeckCoverPayload } from '../../src/lib/imageDelivery.js';

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

// ===========================================================================
// CORRECCIÓN PUNTUAL POST-CORTE 2 — cancelación segura de miniaturas pendientes
// ===========================================================================

const THUMB_A = `data:image/webp;base64,${'A'.repeat(2000)}`;
const THUMB_B = `data:image/webp;base64,${'B'.repeat(2000)}`;

// Espejo determinista del guard del componente: sólo el token vigente puede
// escribir coverThumb (misma condición que DeckModal usa en el .then).
function applyThumbResult(tracker, token, thumb) {
  return isCurrentThumbnailToken(tracker, token) ? thumb : '';
}

test('tracker: select then remove before finishing — the late completion never restores the thumbnail', async () => {
  const tracker = createCoverThumbnailTracker();
  const token = beginThumbnailGeneration(tracker);
  const late = Promise.resolve(THUMB_A);
  assert.equal(trackThumbnailPromise(tracker, token, late), true);
  assert.equal(getPendingThumbnail(tracker), late, 'la generación vigente está pendiente');

  cancelThumbnailGeneration(tracker); // usuario pulsa "Quitar imagen"
  assert.equal(isCurrentThumbnailToken(tracker, token), false, 'el token quedó invalidado');

  const finished = await late; // la generación termina DESPUÉS de eliminar
  const coverThumb = applyThumbResult(tracker, token, finished);
  assert.equal(coverThumb, '', 'la finalización tardía no restaura la miniatura');
  assert.equal(getPendingThumbnail(tracker), null, 'la promesa vieja no puede ser esperada por el guardado');

  const payload = buildDeckCoverPayload({ isEditing: true, coverChanged: true, coverImage: '', coverThumb });
  assert.deepEqual(payload, { coverImage: '', coverImageThumb: '' }, 'eliminar → guardar envía ambos campos vacíos');
});

test('tracker: select A then select B before A finishes — A is ignored and only B can update or be saved', async () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker);
  let resolveA;
  const promiseA = new Promise((resolve) => { resolveA = resolve; });
  assert.equal(trackThumbnailPromise(tracker, tokenA, promiseA), true);

  const tokenB = beginThumbnailGeneration(tracker); // B se selecciona antes de terminar A
  assert.equal(isCurrentThumbnailToken(tracker, tokenA), false);
  assert.equal(getPendingThumbnail(tracker), null, 'comenzar B neutraliza la pendiente de A');
  assert.equal(trackThumbnailPromise(tracker, tokenA, Promise.resolve(THUMB_A)), false, 'A ya no puede registrar su promesa');

  resolveA(THUMB_A);
  await promiseA; // A termina después
  let coverThumb = applyThumbResult(tracker, tokenA, THUMB_A);
  assert.equal(coverThumb, '', 'A termina después y se ignora');

  const promiseB = Promise.resolve(THUMB_B);
  assert.equal(trackThumbnailPromise(tracker, tokenB, promiseB), true);
  assert.equal(getPendingThumbnail(tracker), promiseB, 'sólo la generación vigente puede ser esperada');

  await promiseB;
  coverThumb = applyThumbResult(tracker, tokenB, THUMB_B);
  assert.equal(coverThumb, THUMB_B, 'sólo B actualiza el estado');

  const payload = buildDeckCoverPayload({ isEditing: true, coverChanged: true, coverImage: 'full', coverThumb });
  assert.deepEqual(payload, { coverImage: 'full', coverImageThumb: THUMB_B }, 'sólo B puede guardarse');
});

test('tracker: remove then save sends the exact payload with both image fields empty', () => {
  const tracker = createCoverThumbnailTracker();
  beginThumbnailGeneration(tracker);
  cancelThumbnailGeneration(tracker);
  assert.equal(getPendingThumbnail(tracker), null);

  // El componente conserva coverChanged = true tras cancelar.
  const payload = buildDeckCoverPayload({ isEditing: true, coverChanged: true, coverImage: '', coverThumb: '' });
  assert.deepEqual(payload, { coverImage: '', coverImageThumb: '' });
});

test('tracker: editing metadata only still omits both image fields after the fix', () => {
  const tracker = createCoverThumbnailTracker();
  beginThumbnailGeneration(tracker);
  const payload = buildDeckCoverPayload({ isEditing: true, coverChanged: false, coverImage: '', coverThumb: THUMB_A });
  assert.deepEqual(payload, {}, 'la miniatura nunca sustituye a la portada completa en escrituras');
  assert.equal(getPendingThumbnail(tracker), null, 'sin cambio de portada no hay promesa que esperar');
});

test('tracker: a fresh tracker starts with no token activity and no pending promise', () => {
  const tracker = createCoverThumbnailTracker();
  assert.equal(tracker.token, 0);
  assert.equal(getPendingThumbnail(tracker), null);
  assert.equal(isCurrentThumbnailToken(tracker, 0), true);
});

// ===========================================================================
// CORRECCIÓN FINAL POST-CORTE 2 — abortar guardados obsoletos durante la espera
// ===========================================================================

// Espejo determinista del handleSubmit del componente: si resolveSubmitThumbnail
// aborta, no se construye payload ni se llama a onSave (el componente hace
// setSaving(false) y retorna antes de onSave).
async function simulateSubmit(tracker, submitToken, fallbackThumb, coverImage, coverChanged = true) {
  const result = await resolveSubmitThumbnail(tracker, submitToken, fallbackThumb);
  if (result.aborted) return { aborted: true };
  return {
    aborted: false,
    payload: buildDeckCoverPayload({ isEditing: true, coverChanged, coverImage, coverThumb: result.thumb }),
  };
}

test('submit: select A, save, remove while waiting — onSave is never executed', async () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker);
  let resolveA;
  const promiseA = new Promise((resolve) => { resolveA = resolve; });
  trackThumbnailPromise(tracker, tokenA, promiseA);

  const savePromise = simulateSubmit(tracker, tokenA, '', 'full-A');
  cancelThumbnailGeneration(tracker); // el usuario elimina la portada durante la espera
  resolveA(THUMB_A);

  const outcome = await savePromise;
  assert.equal(outcome.aborted, true, 'el guardado de A se aborta: no hay payload ni onSave');
});

test('submit: select A, save, select B while waiting — the A save is aborted', async () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker);
  let resolveA;
  const promiseA = new Promise((resolve) => { resolveA = resolve; });
  trackThumbnailPromise(tracker, tokenA, promiseA);

  const savePromise = simulateSubmit(tracker, tokenA, '', 'full-A');
  beginThumbnailGeneration(tracker); // el usuario selecciona B durante la espera
  resolveA(THUMB_A);

  const outcome = await savePromise;
  assert.equal(outcome.aborted, true, 'el token cambió: el guardado de A queda obsoleto');
});

test('submit: after an abort, a new save can send B correctly', async () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker);
  let resolveA;
  const promiseA = new Promise((resolve) => { resolveA = resolve; });
  trackThumbnailPromise(tracker, tokenA, promiseA);
  const first = simulateSubmit(tracker, tokenA, '', 'full-A');

  const tokenB = beginThumbnailGeneration(tracker);
  const promiseB = Promise.resolve(THUMB_B);
  trackThumbnailPromise(tracker, tokenB, promiseB);
  resolveA(THUMB_A);
  assert.equal((await first).aborted, true, 'el intento de A quedó abortado');

  const second = await simulateSubmit(tracker, tokenB, '', 'full-B');
  assert.equal(second.aborted, false, 'el nuevo guardado continúa');
  assert.deepEqual(second.payload, { coverImage: 'full-B', coverImageThumb: THUMB_B }, 'envía B correctamente');
});

test('submit: no token change during the wait — the normal save continues', async () => {
  const tracker = createCoverThumbnailTracker();
  const token = beginThumbnailGeneration(tracker);
  const promise = Promise.resolve(THUMB_A);
  trackThumbnailPromise(tracker, token, promise);

  const outcome = await simulateSubmit(tracker, token, '', 'full-A');
  assert.equal(outcome.aborted, false);
  assert.deepEqual(outcome.payload, { coverImage: 'full-A', coverImageThumb: THUMB_A });
});

test('submit: remove before saving still sends both image fields empty', async () => {
  const tracker = createCoverThumbnailTracker();
  beginThumbnailGeneration(tracker);
  cancelThumbnailGeneration(tracker); // eliminar antes de guardar

  const outcome = await simulateSubmit(tracker, tracker.token, '', '');
  assert.equal(outcome.aborted, false);
  assert.deepEqual(outcome.payload, { coverImage: '', coverImageThumb: '' });
});

test('submit: A then B before saving still ignores A for state and payload', async () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker);
  let resolveA;
  const promiseA = new Promise((resolve) => { resolveA = resolve; });
  trackThumbnailPromise(tracker, tokenA, promiseA);

  const tokenB = beginThumbnailGeneration(tracker);
  const promiseB = Promise.resolve(THUMB_B);
  trackThumbnailPromise(tracker, tokenB, promiseB);
  resolveA(THUMB_A);
  await promiseA;

  const stateThumb = isCurrentThumbnailToken(tracker, tokenA) ? THUMB_A : '';
  assert.equal(stateThumb, '', 'A sigue ignorado en el estado');

  const outcome = await simulateSubmit(tracker, tokenB, '', 'full-B');
  assert.equal(outcome.aborted, false);
  assert.deepEqual(outcome.payload, { coverImage: 'full-B', coverImageThumb: THUMB_B }, 'sólo B puede guardarse');
});

// ===========================================================================
// CIERRE FINAL DEL CORTE 2 — proteger la lectura inicial de la portada
// ===========================================================================

// Espejo determinista del handleSubmit definitivo: el guardado queda bloqueado
// si hay una lectura/generación de portada en curso (sin payload y sin onSave);
// si no, se resuelve la miniatura y se construye el payload como el componente.
async function simulateSaveAttempt(tracker, submitToken, fallbackThumb, coverImage, coverChanged = true) {
  if (isCoverProcessing(tracker)) return { blocked: true };
  const result = await resolveSubmitThumbnail(tracker, submitToken, fallbackThumb);
  if (result.aborted) return { aborted: true };
  return {
    aborted: false,
    payload: buildDeckCoverPayload({ isEditing: true, coverChanged, coverImage, coverThumb: result.thumb }),
  };
}

test('processing: select file, FileReader pending — a save attempt is blocked', async () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker); // handleFile inicia la lectura
  assert.equal(isCoverProcessing(tracker), true, 'el procesamiento comienza antes de la lectura');

  const attempt = await simulateSaveAttempt(tracker, tokenA, '', 'full-A');
  assert.equal(attempt.blocked, true, 'Guardar queda bloqueado: sin payload ni onSave');
  assert.equal('payload' in attempt, false, 'no se construye payload durante la lectura');
});

test('processing: the current read finishes — saving is allowed again', async () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker);
  trackThumbnailPromise(tracker, tokenA, Promise.resolve(THUMB_A));

  assert.equal(releaseCoverProcessing(tracker, tokenA), true, 'la operación vigente libera el procesamiento');
  assert.equal(isCoverProcessing(tracker), false);

  const attempt = await simulateSaveAttempt(tracker, tokenA, '', 'full-A');
  assert.equal(attempt.aborted, false, 'el guardado vuelve a estar permitido');
  assert.deepEqual(attempt.payload, { coverImage: 'full-A', coverImageThumb: THUMB_A });
});

test('processing: pending read A, select B, A finishes — A does not release B processing', () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker);
  const tokenB = beginThumbnailGeneration(tracker); // B se selecciona (intercalación extrema)
  assert.equal(isCoverProcessing(tracker), true, 'B sigue en procesamiento');

  assert.equal(isCurrentThumbnailToken(tracker, tokenA), false, 'A quedó obsoleto');
  assert.equal(releaseCoverProcessing(tracker, tokenA), false, 'A no puede liberar el procesamiento de B');
  assert.equal(isCoverProcessing(tracker), true, 'el procesamiento de B permanece activo');

  assert.equal(releaseCoverProcessing(tracker, tokenB), true, 'sólo B libera su propio procesamiento');
  assert.equal(isCoverProcessing(tracker), false);
});

test('processing: a current error releases the processing state', () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker);

  assert.equal(isCurrentThumbnailToken(tracker, tokenA), true, 'el error es vigente');
  assert.equal(releaseCoverProcessing(tracker, tokenA), true, 'el error vigente libera el procesamiento');
  assert.equal(isCoverProcessing(tracker), false, 'Guardar vuelve a estar disponible');
});

test('processing: a stale error does not alter the newer operation state', () => {
  const tracker = createCoverThumbnailTracker();
  const tokenA = beginThumbnailGeneration(tracker);
  const tokenB = beginThumbnailGeneration(tracker);

  assert.equal(isCurrentThumbnailToken(tracker, tokenA), false, 'el error de A es obsoleto');
  assert.equal(releaseCoverProcessing(tracker, tokenA), false, 'un error obsoleto no altera el estado de B');
  assert.equal(isCoverProcessing(tracker), true, 'B sigue procesando');
});

test('processing: a fresh tracker starts without processing and cancel clears it', () => {
  const tracker = createCoverThumbnailTracker();
  assert.equal(isCoverProcessing(tracker), false);

  beginThumbnailGeneration(tracker);
  assert.equal(isCoverProcessing(tracker), true);
  cancelThumbnailGeneration(tracker);
  assert.equal(isCoverProcessing(tracker), false, 'cancelar libera el procesamiento');
});
