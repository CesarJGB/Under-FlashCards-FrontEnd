import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PUBLIC_HOME_AUTOPLAY_MS,
  canAutoplayPublicHome,
  getNextPublicHomeSlide,
  splitPublicHomeEmphasis,
} from './publicHomeCarousel.js';
import {
  ACTION_SHEET_SNAP_CLOSED,
  ACTION_SHEET_SNAP_COMPACT,
  ACTION_SHEET_SNAP_EXPANDED,
  canActivateActionSheetDrag,
  getActionSheetSnapGeometry,
  isActionSheetDragControl,
  resolveActionSheetRelease,
} from './common/actionSheetDrag.js';

const readComponent = (name) => readFile(new URL(name, import.meta.url), 'utf8');

const EXPECTED_SLIDES = [
  ['Crea flashcards en segundos con IA.', 'Convierte tus apuntes en material listo para estudiar.'],
  ['Estudia justo antes de olvidar.', 'Usa repetición espaciada para recordar por más tiempo.'],
  ['Practica como si ya fuera el examen.', 'Genera quizzes y exámenes para poner a prueba lo que sabes.'],
  ['Todo tu semestre, bajo control.', 'Organiza clases, horarios, materias y sesiones de estudio en un solo lugar.'],
];

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

test('los cuatro slides usan solo WebP v2 transparentes y conservan textos y énfasis', async () => {
  const carousel = await readComponent('./PublicHomeCarousel.jsx');
  for (const asset of [
    'slide-ai-flashcards.webp',
    'slide-spaced-repetition.webp',
    'slide-exams.webp',
    'slide-semester.webp',
  ]) assert.match(carousel, new RegExp(asset));
  assert.doesNotMatch(carousel, /\.PNG|Imagen [1-4]/);
  assert.doesNotMatch(carousel, /\baccent:\s*['"]/);
  assert.doesNotMatch(carousel, /bg-\[#/);
  assert.match(carousel, /bg-transparent/);

  for (const [title, description] of EXPECTED_SLIDES) {
    assert.ok(carousel.includes(`title: '${title}'`));
    assert.ok(carousel.includes(`description: '${description}'`));
  }
  for (const emphasis of [
    'en segundos con IA.', 'tus apuntes',
    'antes de olvidar.', 'repetición espaciada',
    'como si ya fuera el examen.', 'quizzes y exámenes',
    'bajo control.', 'en un solo lugar',
  ]) assert.ok(carousel.includes(`: '${emphasis}'`));

  assert.deepEqual(splitPublicHomeEmphasis('Crea flashcards en segundos con IA.', 'en segundos con IA.'), [
    { text: 'Crea flashcards ', emphasized: false },
    { text: 'en segundos con IA.', emphasized: true },
  ]);
});

test('la pantalla pública es fija, bloquea scroll y abre el ActionSheet draggable', async () => {
  const login = await readComponent('./LoginScreen.jsx');
  assert.match(login, /className="fixed inset-0 grid h-\[100dvh\]/);
  assert.match(login, /overflow-hidden overscroll-none/);
  assert.doesNotMatch(login, /overflow-y-auto|sticky bottom-0/);
  assert.match(login, /lockBodyScroll\(LOGIN_SCROLL_OWNER\)/);
  assert.match(login, /unlockBodyScroll\(LOGIN_SCROLL_OWNER\)/);
  assert.match(login, /document\.body\.style\.paddingTop = '0px'/);
  assert.match(login, /document\.body\.style\.paddingBottom = '0px'/);
  assert.match(login, /<ActionSheet/);
  assert.match(login, /draggable/);
  assert.match(login, /dragDisabled=\{authenticating\}/);
  assert.match(login, /Iniciar sesión/);
});

test('Google conserva un solo componente/callback y precede al bloque de invitación', async () => {
  const login = await readComponent('./LoginScreen.jsx');
  assert.equal((login.match(/<GoogleLogin/g) || []).length, 1);
  assert.equal((login.match(/<ActionSheet/g) || []).length, 1);
  assert.match(login, /onSuccess=\{handleGoogleSuccess\}/);
  assert.match(login, /if \(authenticating\) return/);
  assert.match(login, /onError\?\.\(\)/);
  assert.match(login, /autoComplete="one-time-code"/);
  assert.match(login, /autoCapitalize="characters"/);
  assert.ok(login.indexOf('<GoogleLogin') < login.indexOf('id="invite-code"'));
  assert.match(login, /restoreSnapAfterInput/);
  assert.match(login, /useLayoutEffect/);
  assert.match(login, /useState\(null\)/);
  assert.match(login, /googleButtonWidth !== null/);
  assert.match(login, /luaInviteCard/);
  assert.match(login, /pointer-events-none/);
  assert.match(login, /aria-hidden="true"/);
  assert.doesNotMatch(login, /border.*data-testid="google-login-button"/);
});

test('ActionSheet mantiene draggable desactivado por defecto y limpia recursos', async () => {
  const [actionSheet, carousel] = await Promise.all([
    readComponent('./common/ActionSheet.jsx'),
    readComponent('./PublicHomeCarousel.jsx'),
  ]);
  assert.match(actionSheet, /draggable = false/);
  assert.match(actionSheet, /restoreSnapAfterInput = false/);
  assert.match(actionSheet, /installActionSheetGestureGuard\(frameRef\.current\)/);
  assert.match(actionSheet, /cancelAnimationFrame\(frameId\)/);
  assert.match(actionSheet, /data-action-sheet-draggable=\{draggable \? 'true' : 'false'\}/);
  assert.match(actionSheet, /prefers-reduced-motion: reduce/);
  assert.match(carousel, /window\.clearTimeout\(timeoutId\)/);
  assert.match(carousel, /removeEventListener\?\.\('change'/);
  assert.match(carousel, /removeEventListener\('visibilitychange'/);
});

test('la geometría define snaps compacta y expandida dentro del viewport', () => {
  assert.deepEqual(getActionSheetSnapGeometry(720), {
    expandedHeight: 720,
    compactHeight: 520,
    expandedOffset: 0,
    compactOffset: 200,
    closedOffset: 744,
  });
  const shortViewport = getActionSheetSnapGeometry(320);
  assert.equal(shortViewport.expandedHeight, 320);
  assert.equal(shortViewport.compactHeight, 320);
  assert.equal(shortViewport.compactOffset, 0);
});

test('swipe arriba expande, swipe abajo contrae o cierra y el drag corto vuelve', () => {
  assert.equal(resolveActionSheetRelease({ originSnap: ACTION_SHEET_SNAP_COMPACT, deltaY: -60, velocityY: -0.1 }), ACTION_SHEET_SNAP_EXPANDED);
  assert.equal(resolveActionSheetRelease({ originSnap: ACTION_SHEET_SNAP_EXPANDED, deltaY: 60, velocityY: 0.1 }), ACTION_SHEET_SNAP_COMPACT);
  assert.equal(resolveActionSheetRelease({ originSnap: ACTION_SHEET_SNAP_COMPACT, deltaY: 96, velocityY: 0.2 }), ACTION_SHEET_SNAP_CLOSED);
  assert.equal(resolveActionSheetRelease({ originSnap: ACTION_SHEET_SNAP_COMPACT, deltaY: 20, velocityY: 0.1 }), ACTION_SHEET_SNAP_COMPACT);
  assert.equal(resolveActionSheetRelease({ originSnap: ACTION_SHEET_SNAP_EXPANDED, deltaY: 20, velocityY: 0.1 }), ACTION_SHEET_SNAP_EXPANDED);
});

test('scroll interno y controles nativos impiden comenzar un drag accidental', () => {
  assert.equal(canActivateActionSheetDrag({ fromHandle: true, scrollTop: 20, deltaY: -20, blockedControl: false }), true);
  assert.equal(canActivateActionSheetDrag({ fromHandle: false, scrollTop: 20, deltaY: 30, blockedControl: false }), false);
  assert.equal(canActivateActionSheetDrag({ fromHandle: false, scrollTop: 0, deltaY: 30, blockedControl: false }), true);
  assert.equal(canActivateActionSheetDrag({ fromHandle: false, scrollTop: 0, deltaY: -30, blockedControl: false }), false);
  assert.equal(canActivateActionSheetDrag({ fromHandle: false, scrollTop: 0, deltaY: 30, blockedControl: true }), false);

  const control = { closest: (selector) => (selector.includes('input') ? control : null) };
  const plain = { closest: () => null };
  assert.equal(isActionSheetDragControl(control), true);
  assert.equal(isActionSheetDragControl(plain), false);
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
