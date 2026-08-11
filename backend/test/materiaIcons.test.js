const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MATERIA_ICON_IDS,
  getAutomaticMateriaIconId,
  isValidMateriaIconId,
} = require('../src/utils/materiaIcons');

test('automatic materia icons are valid, deterministic and keyword-aware', () => {
  const fallback = getAutomaticMateriaIconId('Seminario interdisciplinario');

  assert.equal(MATERIA_ICON_IDS.includes(fallback), true);
  assert.equal(getAutomaticMateriaIconId('Seminario interdisciplinario'), fallback);
  assert.equal(getAutomaticMateriaIconId('Química general'), 'flask');
  assert.equal(getAutomaticMateriaIconId('Cálculo integral'), 'calculator');
  assert.equal(getAutomaticMateriaIconId('Inglés básico'), 'languages');
  assert.equal(getAutomaticMateriaIconId('Programación web'), 'code');
  assert.equal(getAutomaticMateriaIconId('Física'), 'atom');
});

test('only closed-catalog icon ids are accepted', () => {
  assert.equal(isValidMateriaIconId('calculator'), true);
  assert.equal(isValidMateriaIconId('ArbitraryReactComponent'), false);
  assert.equal(isValidMateriaIconId(null), false);
});
