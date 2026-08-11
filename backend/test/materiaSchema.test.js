const test = require('node:test');
const assert = require('node:assert/strict');
const Materia = require('../src/models/Materia');

test('shareId is unique only for public profiles with a string identifier', () => {
  const shareIdIndex = Materia.schema.indexes().find(([key]) => key['publicProfile.shareId'] === 1);

  assert.ok(shareIdIndex);
  assert.deepEqual(shareIdIndex[1], {
    unique: true,
    partialFilterExpression: { 'publicProfile.shareId': { $type: 'string' } }
  });
});

test('serialize returns icon and keeps existing color behavior', () => {
  const materia = new Materia({
    name: 'Cálculo',
    userId: new Materia.base.Types.ObjectId(),
    color: '#6366F1',
    icon: 'calculator',
  });
  const serialized = materia.serialize();

  assert.equal(serialized.color, '#6366F1');
  assert.equal(serialized.icon, 'calculator');
});

test('legacy materias serialize a missing icon as null', () => {
  const materia = new Materia({
    name: 'Materia legacy',
    userId: new Materia.base.Types.ObjectId(),
  });

  assert.equal(materia.serialize().icon, null);
});
