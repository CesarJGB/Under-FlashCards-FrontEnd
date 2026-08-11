import test from 'node:test';
import assert from 'node:assert/strict';
import { getMateriaColor, getMateriaPastelColor } from './materiaColors.js';

test('an existing valid materia color remains authoritative', () => {
  assert.equal(getMateriaColor({ name: 'Química', color: '#123ABC' }), '#123ABC');
});

test('the bottom strip pastel is derived from the materia accent', () => {
  assert.equal(getMateriaPastelColor({ color: '#3B82F6' }), 'rgb(177, 205, 251)');
  assert.equal(getMateriaPastelColor({ color: '#000000' }, 0.5), 'rgb(128, 128, 128)');
  assert.equal(getMateriaPastelColor({ color: '#FFFFFF' }, 0.5), 'rgb(255, 255, 255)');
});
