import assert from 'node:assert/strict';
import test from 'node:test';
import { hexToHsl, hslToHex, normalizeHexColor } from './colorUtils.js';

test('UT-COLOR-001 — hexadecimal válido se normaliza y el inválido se rechaza', () => {
  assert.equal(normalizeHexColor('ABC'), '#aabbcc');
  assert.equal(normalizeHexColor(' #13579B '), '#13579b');
  assert.equal(normalizeHexColor('#12'), null);
  assert.equal(normalizeHexColor('#gggggg'), null);
});

test('UT-COLOR-002 — conversiones HSL/HEX conservan colores representativos', () => {
  assert.deepEqual(hexToHsl('#ff0000'), { h: 0, s: 100, l: 50 });
  assert.deepEqual(hexToHsl('#00ff00'), { h: 120, s: 100, l: 50 });
  assert.equal(hslToHex(240, 100, 50), '#0000ff');
  assert.equal(hslToHex(0, 0, 100), '#ffffff');
});
