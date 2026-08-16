import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PUBLIC_HOME_AUTOPLAY_MS,
  canAutoplayPublicHome,
  getNextPublicHomeSlide,
} from './publicHomeCarousel.js';

const readComponent = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('el carrusel avanza, vuelve al inicio y pausa el autoplay cuando corresponde', () => {
  assert.equal(PUBLIC_HOME_AUTOPLAY_MS, 4800);
  assert.equal(getNextPublicHomeSlide(0), 1);
  assert.equal(getNextPublicHomeSlide(3), 0);
  assert.equal(getNextPublicHomeSlide(0, -1), 3);
  assert.equal(canAutoplayPublicHome({ reducedMotion: false, documentVisible: true, interacting: false }), true);
  assert.equal(canAutoplayPublicHome({ reducedMotion: true, documentVisible: true, interacting: false }), false);
  assert.equal(canAutoplayPublicHome({ reducedMotion: false, documentVisible: false, interacting: false }), false);
  assert.equal(canAutoplayPublicHome({ reducedMotion: false, documentVisible: true, interacting: true }), false);
});

test('la pantalla pública contiene cuatro slides, indicadores accesibles y swipe con limpieza', async () => {
  const carousel = await readComponent('./PublicHomeCarousel.jsx');
  assert.equal((carousel.match(/title: '/g) || []).length, 4);
  assert.match(carousel, /Ir al slide \$\{index \+ 1\} de 4/);
  assert.match(carousel, /onPointerDown=\{handlePointerDown\}/);
  assert.match(carousel, /visibilitychange/);
  assert.match(carousel, /prefers-reduced-motion: reduce/);
  assert.match(carousel, /window\.clearTimeout\(timeoutId\)/);
});

test('el CTA abre el ActionSheet existente y Google conserva un único callback', async () => {
  const login = await readComponent('./LoginScreen.jsx');
  assert.match(login, /<ActionSheet/);
  assert.match(login, /Iniciar sesión/);
  assert.match(login, /<GoogleLogin/);
  assert.match(login, /onSuccess=\{handleGoogleSuccess\}/);
  assert.match(login, /¿Eres nuevo\? Agrega tu código de invitación/);
  assert.match(login, /name="code"/);
  assert.doesNotMatch(login, /<BottomSheet/);
});

test('la invitación usa el contrato existente solo después de needsInvite', async () => {
  const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
  const needsInvitePosition = app.indexOf('if (data.needsInvite)');
  const redeemPosition = app.indexOf('/api/auth/redeem-invite', needsInvitePosition);
  assert.ok(needsInvitePosition >= 0);
  assert.ok(redeemPosition > needsInvitePosition);
  assert.match(app, /JSON\.stringify\(\{ credential, code: normalizedInviteCode \}\)/);
  assert.match(app, /setPendingInvite\(\{ credential, user: data\.user \}\)/);
  assert.doesNotMatch(app.slice(0, needsInvitePosition), /normalizedInviteCode/);
});
