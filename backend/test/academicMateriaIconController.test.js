const test = require('node:test');
const assert = require('node:assert/strict');
const Materia = require('../src/models/Materia');
const academicController = require('../src/controllers/academicController');
const { isValidMateriaIconId } = require('../src/utils/materiaIcons');

function createResponse() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
}

test('createMateria persists explicit and automatic icon ids', { concurrency: false }, async () => {
  const originalFindOne = Materia.findOne;
  const originalCreate = Materia.create;
  const createdPayloads = [];

  Materia.findOne = async () => null;
  Materia.create = async (payload) => {
    createdPayloads.push(payload);
    return { serialize: () => payload };
  };

  try {
    const explicitResponse = createResponse();
    await academicController.createMateria({
      body: { userId: 'user-1', name: 'Laboratorio clínico', icon: 'microscope', color: '#6366F1' },
    }, explicitResponse);

    const automaticResponse = createResponse();
    await academicController.createMateria({
      body: { userId: 'user-1', name: 'Química general', icon: null },
    }, automaticResponse);

    assert.equal(explicitResponse.statusCode, 201);
    assert.equal(createdPayloads[0].icon, 'microscope');
    assert.equal(createdPayloads[0].color, '#6366F1');
    assert.equal(automaticResponse.statusCode, 201);
    assert.equal(createdPayloads[1].icon, 'flask');
    assert.equal(isValidMateriaIconId(createdPayloads[1].icon), true);
  } finally {
    Materia.findOne = originalFindOne;
    Materia.create = originalCreate;
  }
});

test('updateMateria persists a valid icon and rejects an unknown id', { concurrency: false }, async () => {
  const originalFindById = Materia.findById;
  const materia = {
    name: 'Materia existente',
    userId: 'user-1',
    color: '#10B981',
    icon: null,
    saved: false,
    async save() { this.saved = true; },
    serialize() { return { name: this.name, color: this.color, icon: this.icon }; },
  };
  Materia.findById = async () => materia;

  try {
    const validResponse = createResponse();
    await academicController.updateMateria({
      params: { id: 'materia-1' },
      body: { icon: 'code' },
    }, validResponse);

    assert.equal(validResponse.statusCode, 200);
    assert.equal(materia.icon, 'code');
    assert.equal(materia.color, '#10B981');
    assert.equal(materia.saved, true);

    materia.saved = false;
    const invalidResponse = createResponse();
    await academicController.updateMateria({
      params: { id: 'materia-1' },
      body: { icon: 'UnknownComponentName' },
    }, invalidResponse);

    assert.equal(invalidResponse.statusCode, 400);
    assert.equal(materia.saved, false);
  } finally {
    Materia.findById = originalFindById;
  }
});
