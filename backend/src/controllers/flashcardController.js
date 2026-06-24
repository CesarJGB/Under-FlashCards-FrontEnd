const Flashcard = require('../models/Flashcard');
const Deck = require('../models/Deck');
const User = require('../models/User');
const aiService = require('../services/aiService');

// Helper interno para resolver índices de fondo
async function getOrCreateBgIndex(deckId, bgImageString) {
  if (!bgImageString) return -1;
  const deck = await Deck.findById(deckId);
  if (!deck) return -1;

  let index = deck.cardBackgrounds.indexOf(bgImageString);
  if (index === -1) {
    deck.cardBackgrounds.push(bgImageString);
    await deck.save();
    index = deck.cardBackgrounds.length - 1;
  }
  return index;
}

exports.getCardsByDeck = async (req, res) => {
  try {
    const { deckId } = req.params;
    const deck = await Deck.findById(deckId);
    const backgrounds = deck ? deck.cardBackgrounds : [];

    const cards = await Flashcard.find({ deckId }).sort({ createdAt: -1 });
    return res.json(cards.map((c) => c.serialize(backgrounds)));
  } catch (err) {
    console.error('[flashcards:get-deck] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.createCard = async (req, res) => {
  try {
    const { userId, deckId, question, answer, bgImage, textAlign, fontSize, contentImage, imageSide } = req.body || {};
    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({ error: 'Question and answer are required.' });
    }

    const bgImageIndex = await getOrCreateBgIndex(deckId, bgImage);

    const card = await Flashcard.create({
      userId,
      deckId,
      question: question.trim(),
      answer: answer.trim(),
      bgImageIndex,
      contentImage: contentImage || '', 
      imageSide: imageSide || '',       
      ...(['left', 'center', 'right'].includes(textAlign) ? { textAlign } : {}),
      ...(typeof fontSize === 'string' ? { fontSize } : {}),
    });

    const deck = await Deck.findById(deckId);
    return res.status(201).json(card.serialize(deck ? deck.cardBackgrounds : []));
  } catch (err) {
    console.error('[flashcards:post] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.updateCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, bgImage, textAlign, fontSize, contentImage, imageSide } = req.body || {};
    const update = {};
    if (typeof question === 'string') update.question = question.trim();
    if (typeof answer === 'string') update.answer = answer.trim();
    if (['left', 'center', 'right'].includes(textAlign)) update.textAlign = textAlign;
    if (typeof fontSize === 'string') update.fontSize = fontSize;
    if (typeof contentImage === 'string') update.contentImage = contentImage;
    if (typeof imageSide === 'string') update.imageSide = imageSide;

    const currentCard = await Flashcard.findById(id);
    if (!currentCard) return res.status(404).json({ error: 'Flashcard not found.' });

    if (typeof bgImage === 'string') {
      update.bgImageIndex = await getOrCreateBgIndex(currentCard.deckId, bgImage);
    }

    const card = await Flashcard.findByIdAndUpdate(id, { $set: update }, { new: true });
    const deck = await Deck.findById(card.deckId);
    return res.json(card.serialize(deck ? deck.cardBackgrounds : []));
  } catch (err) {
    console.error('[flashcards:put] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.deleteCard = async (req, res) => {
  try {
    const { id } = req.params;
    // ✨ BUG CORREGIDO: Se removió la línea duplicada rota del archivo original
    const cardDeleted = await Flashcard.findByIdAndDelete(id);
    if (!cardDeleted) return res.status(404).json({ error: 'Flashcard not found.' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[flashcards:delete] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.createBulkCards = async (req, res) => {
  try {
    const { userId, deckId, batchStyles, cards } = req.body || {};
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron tarjetas.' });
    }

    const globalBg = batchStyles?.bgImage || '';
    const globalAlign = batchStyles?.textAlign || 'center';
    const globalSize = batchStyles?.fontSize || 'text-base';

    const currentDeck = await Deck.findById(deckId);
    if (!currentDeck) return res.status(404).json({ error: 'Mazo no encontrado.' });

    const docs = [];
    for (const c of cards) {
      if (!c || !c.question?.trim() || !c.answer?.trim()) continue;

      const currentBg = c.bgImage || globalBg;
      let bgImageIndex = -1;

      if (currentBg) {
        let idx = currentDeck.cardBackgrounds.indexOf(currentBg);
        if (idx === -1) {
          currentDeck.cardBackgrounds.push(currentBg);
          idx = currentDeck.cardBackgrounds.length - 1;
        }
        bgImageIndex = idx;
      }

      docs.push({
        userId,
        deckId,
        question: String(c.question).trim(),
        answer: String(c.answer).trim(),
        bgImageIndex,
        textAlign: ['left', 'center', 'right'].includes(c.textAlign || globalAlign) ? (c.textAlign || globalAlign) : 'center',
        fontSize: c.fontSize || globalSize,
        contentImage: '', 
        imageSide: ''
      });
    }

    if (docs.length === 0) {
      return res.status(400).json({ error: 'Ninguna tarjeta tiene formato válido.' });
    }

    await currentDeck.save();
    const inserted = await Flashcard.insertMany(docs);
    const backgrounds = currentDeck.cardBackgrounds || [];

    return res.status(201).json(inserted.map((c) => c.serialize(backgrounds)));
  } catch (err) {
    console.error('[flashcards:bulk] error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor al crear lote.' });
  }
};

exports.generateAiCards = async (req, res) => {
  try {
    const { userId, deckId, text, count, batchStyles } = req.body || {};
    if (!text?.trim()) {
      return res.status(400).json({ message: 'Proporciona anotaciones o apuntes para procesar.' });
    }

    const user = await User.findById(userId);
    if (!user || !user.aiApiKey) {
      return res.status(400).json({ message: 'No has configurado tu API Key en la sección de Ajustes.' });
    }

    const currentDeck = await Deck.findById(deckId);
    if (!currentDeck) return res.status(404).json({ message: 'Mazo no encontrado en la base de datos.' });

    const targetCount = parseInt(count, 10) || 5;

    // ─── PIPELINE GENERATOR-CRITIC (DEEPSEEK) ───
    console.log(`[AI Pipeline] Iniciando Fase 1 para usuario ${userId} (Target: ${targetCount})`);
    const rawCards = await aiService.generateRawCards(text, targetCount, user.aiApiKey);
    
    console.log(`[AI Pipeline] Fase 1 Completa (${rawCards.length} crudas). Iniciando Fase 2 de Auditoría...`);
    const refinedCards = await aiService.criticizeAndRefineCards(text, rawCards, user.aiApiKey);
    
    console.log(`[AI Pipeline] Fase 2 Completa (${refinedCards.length} refinadas y listas)`);

    // ─── MAPEO E INSERCIÓN EN BASE DE DATOS ───
    const globalBg = batchStyles?.bgImage || '';
    const globalAlign = batchStyles?.textAlign || 'center';
    const globalSize = batchStyles?.fontSize || 'text-base';

    const documentsToInsert = [];
    for (const cardData of refinedCards) {
      if (!cardData || !cardData.question?.trim() || !cardData.answer?.trim()) continue;

      let bgImageIndex = -1;
      if (globalBg) {
        let idx = currentDeck.cardBackgrounds.indexOf(globalBg);
        if (idx === -1) {
          currentDeck.cardBackgrounds.push(globalBg);
          idx = currentDeck.cardBackgrounds.length - 1;
        }
        bgImageIndex = idx;
      }

      documentsToInsert.push({
        userId,
        deckId,
        question: String(cardData.question).trim(),
        answer: String(cardData.answer).trim(),
        bgImageIndex,
        textAlign: ['left', 'center', 'right'].includes(globalAlign) ? globalAlign : 'center',
        fontSize: globalSize,
        contentImage: '',
        imageSide: ''
      });
    }

    if (documentsToInsert.length === 0) {
      return res.status(422).json({ message: 'La auditoría de la IA determinó que ninguna tarjeta cumplía con los estándares mínimos.' });
    }

    await currentDeck.save();
    const insertedFlashcards = await Flashcard.insertMany(documentsToInsert);
    const backgrounds = currentDeck.cardBackgrounds || [];

    return res.status(201).json(insertedFlashcards.map((c) => c.serialize(backgrounds)));

  } catch (err) {
    console.error('[flashcards:generate-ai] fatal error:', err.message);
    if (err.message.includes('DeepSeek')) {
      return res.status(502).json({ message: 'El motor de DeepSeek rechazó la solicitud. Revisa el saldo o vigencia de tu clave.' });
    }
    return res.status(500).json({ message: 'Ocurrió un error al fabricar y auditar las tarjetas artificiales.' });
  }
};
