const test = require('node:test');
const assert = require('node:assert/strict');
const Deck = require('../src/models/Deck');
const Flashcard = require('../src/models/Flashcard');
const deckController = require('../src/controllers/deckController');
const {
  DECK_AUTO_COLOR_PALETTE,
  getRandomDeckColor,
  resolveDeckCoverColor,
} = require('../src/utils/deckColors');

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function installDeckCreateFake(t) {
  const originalCreate = Deck.create;
  let createdPayload;

  Deck.create = async (payload) => {
    createdPayload = payload;
    return {
      _id: 'deck-1',
      serialize: (cardCount) => ({ id: 'deck-1', ...payload, cardCount }),
    };
  };

  t.after(() => {
    Deck.create = originalCreate;
  });

  return () => createdPayload;
}

test('automatic deck colors come from the existing non-white swatches', () => {
  assert.equal(DECK_AUTO_COLOR_PALETTE.includes('#ffffff'), false);
  assert.equal(getRandomDeckColor(() => 0), DECK_AUTO_COLOR_PALETTE[0]);
  assert.equal(getRandomDeckColor(() => 0.999999), DECK_AUTO_COLOR_PALETTE.at(-1));
});

test('missing deck colors resolve once while explicit colors are preserved', () => {
  assert.equal(resolveDeckCoverColor(undefined, () => 0), DECK_AUTO_COLOR_PALETTE[0]);
  assert.equal(resolveDeckCoverColor('', () => 0.999999), DECK_AUTO_COLOR_PALETTE.at(-1));
  assert.equal(resolveDeckCoverColor('#ffffff', () => 0), '#ffffff');
  assert.equal(resolveDeckCoverColor('#123456', () => 0), '#123456');
});

test('the Deck model assigns an automatic color only when coverColor is absent', () => {
  const userId = new Deck.base.Types.ObjectId();
  const automaticDeck = new Deck({ userId, title: 'Automático' });
  const whiteDeck = new Deck({ userId, title: 'Blanco', coverColor: '#ffffff' });

  assert.ok(DECK_AUTO_COLOR_PALETTE.includes(automaticDeck.coverColor));
  assert.equal(whiteDeck.coverColor, '#ffffff');
});

test('normal creation persists an automatic color when the client omits it', async (t) => {
  const getCreatedPayload = installDeckCreateFake(t);
  const res = createResponse();

  await deckController.createDeck({ body: { userId: 'user-1', title: 'Sin color' } }, res);

  assert.equal(res.statusCode, 201);
  assert.ok(DECK_AUTO_COLOR_PALETTE.includes(getCreatedPayload().coverColor));
  assert.equal(res.payload.coverColor, getCreatedPayload().coverColor);
});

test('normal creation preserves explicitly selected white', async (t) => {
  const getCreatedPayload = installDeckCreateFake(t);
  const res = createResponse();

  await deckController.createDeck({
    body: { userId: 'user-1', title: 'Blanco', coverColor: '#ffffff' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(getCreatedPayload().coverColor, '#ffffff');
});

test('imports receive an automatic color only when their backup omits one', async (t) => {
  const getCreatedPayload = installDeckCreateFake(t);
  const res = createResponse();

  await deckController.importDeck({
    body: { userId: 'user-1', deck: { title: 'Importado' }, cards: [] },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.ok(DECK_AUTO_COLOR_PALETTE.includes(getCreatedPayload().coverColor));
});

test('editing without a coverColor leaves the existing color untouched', async (t) => {
  const originalFindByIdAndUpdate = Deck.findByIdAndUpdate;
  const originalCountDocuments = Flashcard.countDocuments;
  let persistedUpdate;

  Deck.findByIdAndUpdate = async (_id, update) => {
    persistedUpdate = update;
    return {
      _id: 'deck-1',
      serialize: (cardCount) => ({ id: 'deck-1', cardCount }),
    };
  };
  Flashcard.countDocuments = async () => 0;
  t.after(() => {
    Deck.findByIdAndUpdate = originalFindByIdAndUpdate;
    Flashcard.countDocuments = originalCountDocuments;
  });

  const res = createResponse();
  await deckController.updateDeck({ params: { id: 'deck-1' }, body: { title: 'Renombrado' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Object.hasOwn(persistedUpdate.$set, 'coverColor'), false);
});
