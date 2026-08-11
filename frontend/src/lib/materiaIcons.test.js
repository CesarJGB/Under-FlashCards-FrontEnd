import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAutomaticMateriaIconId,
  getMateriaIconId,
  isValidMateriaIconId,
} from './materiaIcons.js';

test('a materia without an icon receives a valid deterministic fallback', () => {
  const materia = { _id: 'legacy-1', name: 'Seminario interdisciplinario' };
  const first = getMateriaIconId(materia);
  const second = getMateriaIconId(materia);

  assert.equal(isValidMateriaIconId(first), true);
  assert.equal(second, first);
});

test('an explicit valid icon is respected and an unknown id falls back safely', () => {
  assert.equal(getMateriaIconId({ name: 'Cualquier materia', icon: 'microscope' }), 'microscope');

  const fallback = getMateriaIconId({ name: 'Química', icon: 'ReactComponentFromClient' });
  assert.equal(fallback, 'flask');
  assert.equal(isValidMateriaIconId(fallback), true);
});

test('basic academic keywords resolve to their expected icon ids', () => {
  assert.equal(getAutomaticMateriaIconId('Química analítica'), 'flask');
  assert.equal(getAutomaticMateriaIconId('Cálculo diferencial'), 'calculator');
  assert.equal(getAutomaticMateriaIconId('Inglés básico'), 'languages');
  assert.equal(getAutomaticMateriaIconId('Programación orientada a objetos'), 'code');
  assert.equal(getAutomaticMateriaIconId('Física moderna'), 'atom');
});
