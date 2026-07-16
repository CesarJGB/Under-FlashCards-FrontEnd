const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const Flashcard = require('../src/models/Flashcard');
const Deck = require('../src/models/Deck');
const aiService = require('../src/services/aiService');
const { generateAiCards, generateAIV2 } = require('../src/controllers/flashcardController');

function createRequest() {
  const req = new EventEmitter();
  req.body = {
    deckId: 'deck-1',
    text: 'Una fuente breve con contenido academico verificable.',
    count: 2,
  };
  req.user = { _id: 'user-1', aiApiKey: 'test-key' };
  req.get = () => '';
  return req;
}

function createResponse() {
  const res = new EventEmitter();
  res.writableEnded = false;
  res.destroyed = false;
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (payload) => {
    res.payload = payload;
    res.writableEnded = true;
    return res;
  };
  return res;
}

function installFakes(t, { generate, generateCombined }) {
  const originals = {
    findOne: Deck.findOne,
    findOneAndUpdate: Deck.findOneAndUpdate,
    updateOne: Deck.updateOne,
    insertMany: Flashcard.insertMany,
    deleteMany: Flashcard.deleteMany,
    generateRawCards: aiService.generateRawCards,
    generateAndAuditBatch: aiService.generateAndAuditBatch,
    criticizeAndRefineCards: aiService.criticizeAndRefineCards,
    createRunId: aiService.createRunId,
    logAiEvent: aiService.logAiEvent,
  };
  const deck = { _id: 'deck-1', cardBackgrounds: [] };
  const inserted = [];

  Deck.findOne = async () => deck;
  Deck.findOneAndUpdate = async () => deck;
  Deck.updateOne = async () => ({ matchedCount: 1 });
  Flashcard.insertMany = async (documents) => {
    inserted.push(...documents);
    return documents.map((document, index) => ({
      ...document,
      _id: `card-${index}`,
      serialize: () => document,
    }));
  };
  Flashcard.deleteMany = async () => ({ deletedCount: 0 });
  aiService.generateRawCards = generate;
  aiService.generateAndAuditBatch = generateCombined || originals.generateAndAuditBatch;
  aiService.criticizeAndRefineCards = async (_text, rawCards) => rawCards.map((card) => ({
    ...card,
    status: 'sin_cambios',
  }));
  aiService.createRunId = () => 'deck-test-run';
  aiService.logAiEvent = () => {};

  t.after(() => {
    Deck.findOne = originals.findOne;
    Deck.findOneAndUpdate = originals.findOneAndUpdate;
    Deck.updateOne = originals.updateOne;
    Flashcard.insertMany = originals.insertMany;
    Flashcard.deleteMany = originals.deleteMany;
    aiService.generateRawCards = originals.generateRawCards;
    aiService.generateAndAuditBatch = originals.generateAndAuditBatch;
    aiService.criticizeAndRefineCards = originals.criticizeAndRefineCards;
    aiService.createRunId = originals.createRunId;
    aiService.logAiEvent = originals.logAiEvent;
  });

  return { inserted };
}

test('recovers a temporarily invalid batch and persists exactly the requested cards', async (t) => {
  let attempts = 0;
  const { inserted } = installFakes(t, {
    generate: async (_text, targetCount) => {
      attempts += 1;
      if (attempts === 1) {
        throw new aiService.AiServiceError('invalid_model_output', 'Formato inválido.', { retryable: true });
      }
      return Array.from({ length: targetCount }, (_, index) => ({
        question: `Pregunta ${index + 1}`,
        answer: `Respuesta ${index + 1}`,
      }));
    },
  });
  const req = createRequest();
  const res = createResponse();

  await generateAiCards(req, res);

  assert.equal(attempts, 2);
  assert.equal(res.statusCode, 201);
  assert.equal(inserted.length, 2);
  assert.equal(res.payload.length, 2);
});

test('does not persist cards when recovered batches still cannot meet the target', async (t) => {
  let attempts = 0;
  const { inserted } = installFakes(t, {
    generate: async () => {
      attempts += 1;
      throw new aiService.AiServiceError('invalid_provider_response', 'Proveedor inválido.', { retryable: true });
    },
  });
  const req = createRequest();
  const res = createResponse();

  await generateAiCards(req, res);

  assert.equal(attempts, 2);
  assert.equal(res.statusCode, 422);
  assert.equal(inserted.length, 0);
  assert.match(res.payload.message, /La IA aceptó/i);
});

test('V2 uses the combined generation and audit call once per batch', async (t) => {
  let combinedCalls = 0;
  let legacyCalls = 0;
  const { inserted } = installFakes(t, {
    generate: async () => {
      legacyCalls += 1;
      throw new Error('El pipeline V2 no debe llamar al generador legado.');
    },
    generateCombined: async (_text, targetCount) => {
      combinedCalls += 1;
      return Array.from({ length: targetCount }, (_, index) => ({
        question: `Pregunta combinada ${index + 1}`,
        answer: `Respuesta combinada ${index + 1}`,
      }));
    },
  });
  const req = createRequest();
  const res = createResponse();

  await generateAIV2(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(inserted.length, 2);
  assert.equal(combinedCalls, 1);
  assert.equal(legacyCalls, 0);
});
