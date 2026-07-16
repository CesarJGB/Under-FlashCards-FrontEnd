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
