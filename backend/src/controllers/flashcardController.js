// backend/src/controllers/flashcardController.js
const Flashcard = require('../models/Flashcard');
const Deck = require('../models/Deck');
const User = require('../models/User');
const aiService = require('../services/aiService');
const { acceptsEventStream, sendEvent, startEventStream } = require('../utils/sse');

const MAX_AI_CARDS = 100;
const MAX_RAW_AI_CARDS = 120;
const MAX_AI_SOURCE_TEXT_LENGTH = 60000;
const AI_DECK_BATCH_SIZE = Math.min(
  20,
  Math.max(1, parseInt(process.env.AI_DECK_BATCH_SIZE, 10) || 12)
);

function createRequestError(status, message) {
  const error = new Error(message);
  error.httpStatus = status;
  return error;
}

function getPaddingFactor() {
  const value = Number.parseFloat(process.env.AI_TARGET_PADDING_FACTOR);
  if (!Number.isFinite(value)) return 0.30;
  return Math.min(0.50, Math.max(0, value));
}

function normalizeCardKey(card) {
  return `${String(card.question).trim().replace(/\s+/g, ' ').toLocaleLowerCase()}\n${String(card.answer).trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`;
}

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
  const streamProgress = acceptsEventStream(req);
  let streamStarted = false;
  let stopEventStream = null;
  let runId = null;
  let currentBatch = 0;
  let generatedCount = 0;
  let auditedCount = 0;
  let acceptedCount = 0;

  try {
    const { userId, deckId, text, count, batchStyles } = req.body || {};
    if (!text?.trim()) {
      throw createRequestError(400, 'Proporciona anotaciones o apuntes para procesar.');
    }
    const sourceText = text.trim();
    if (sourceText.length > MAX_AI_SOURCE_TEXT_LENGTH) {
      throw createRequestError(400, `Los apuntes superan el límite de ${MAX_AI_SOURCE_TEXT_LENGTH.toLocaleString('es-MX')} caracteres para la generación con IA.`);
    }

    const user = await User.findById(userId).select('aiApiKey');
    if (!user || !user.aiApiKey) {
      throw createRequestError(400, 'No has configurado tu API Key en la sección de Ajustes.');
    }

    const currentDeck = await Deck.findOne({ _id: deckId, userId: user._id });
    if (!currentDeck) throw createRequestError(404, 'Mazo no encontrado en la base de datos.');

    const targetCount = Math.min(MAX_AI_CARDS, Math.max(1, parseInt(count, 10) || 5));
    const padding = Math.min(20, Math.ceil(targetCount * getPaddingFactor()));
    const phase1Target = Math.min(MAX_RAW_AI_CARDS, targetCount + padding);
    const totalBatches = Math.ceil(phase1Target / AI_DECK_BATCH_SIZE);
    const startedAt = Date.now();
    runId = aiService.createRunId('deck');

    const metrics = {
      generated: 0,
      audited: 0,
      accepted: 0,
      eliminated: 0,
      merged: 0,
      corrected: 0,
      duplicates: 0,
    };
    const documentsToInsert = [];
    const seenCards = new Set();
    const globalBg = batchStyles?.bgImage || '';
    const globalAlign = batchStyles?.textAlign || 'center';
    const globalSize = batchStyles?.fontSize || 'text-base';

    aiService.logAiEvent('run_started', {
      runId,
      flow: 'deck',
      deckId: String(currentDeck._id),
      targetCount,
      phase1Target,
      totalBatches,
    });

    if (streamProgress) {
      stopEventStream = startEventStream(res);
      streamStarted = true;
      sendEvent(res, 'progress', {
        runId,
        stage: 'preparing',
        generated: 0,
        audited: 0,
        accepted: 0,
        target: targetCount,
        total: phase1Target,
        message: 'Preparando la generación con IA...',
      });
    }

    for (let requestedCount = 0; requestedCount < phase1Target && documentsToInsert.length < targetCount; requestedCount += AI_DECK_BATCH_SIZE) {
      currentBatch += 1;
      const batchTarget = Math.min(AI_DECK_BATCH_SIZE, phase1Target - requestedCount);
      const reportProgress = (stage, message) => {
        if (!streamProgress) return;
        sendEvent(res, 'progress', {
          runId,
          stage,
          generated: generatedCount,
          audited: auditedCount,
          accepted: acceptedCount,
          target: targetCount,
          total: phase1Target,
          batch: currentBatch,
          totalBatches,
          message,
        });
      };
      const context = {
        runId,
        flow: 'deck',
        deckId: String(currentDeck._id),
        batch: currentBatch,
        totalBatches,
        onRetry: () => reportProgress('retrying', `La IA está ocupada. Reintentando el lote ${currentBatch}/${totalBatches}...`),
      };

      reportProgress('generating', `Generando tarjetas del lote ${currentBatch}/${totalBatches}...`);
      const rawCards = await aiService.generateRawCards(sourceText, batchTarget, user.aiApiKey, context);
      generatedCount += rawCards.length;
      metrics.generated = generatedCount;

      reportProgress('auditing', `Auditando tarjetas del lote ${currentBatch}/${totalBatches}...`);
      const auditedCards = await aiService.criticizeAndRefineCards(sourceText, rawCards, user.aiApiKey, context);
      auditedCount += auditedCards.length;
      metrics.audited = auditedCount;

      for (const card of auditedCards) {
        const status = card?.status;
        if (status === 'eliminada') {
          metrics.eliminated += 1;
          continue;
        }
        if (status === 'fusionada') {
          metrics.merged += 1;
          continue;
        }
        if (status === 'corregida') metrics.corrected += 1;
        if (!['sin_cambios', 'corregida'].includes(status) || !card.question?.trim() || !card.answer?.trim()) continue;

        const key = normalizeCardKey(card);
        if (seenCards.has(key)) {
          metrics.duplicates += 1;
          continue;
        }
        seenCards.add(key);
        documentsToInsert.push({
          userId,
          deckId,
          question: String(card.question).trim(),
          answer: String(card.answer).trim(),
          textAlign: ['left', 'center', 'right'].includes(globalAlign) ? globalAlign : 'center',
          fontSize: globalSize,
          contentImage: '',
          imageSide: '',
        });
      }
      acceptedCount = Math.min(targetCount, documentsToInsert.length);
      metrics.accepted = acceptedCount;
      reportProgress('completed_batch', `Lote ${currentBatch}/${totalBatches} completado.`);
    }

    if (documentsToInsert.length === 0) {
      throw createRequestError(422, 'La auditoría determinó que ninguna tarjeta generada cumplía con los estándares de veracidad del documento.');
    }

    let bgImageIndex = -1;
    if (globalBg) {
      let index = currentDeck.cardBackgrounds.indexOf(globalBg);
      if (index === -1) {
        currentDeck.cardBackgrounds.push(globalBg);
        index = currentDeck.cardBackgrounds.length - 1;
      }
      bgImageIndex = index;
    }
    const finalDocuments = documentsToInsert.slice(0, targetCount).map((document) => ({
      ...document,
      bgImageIndex,
    }));
    await currentDeck.save();
    const insertedFlashcards = await Flashcard.insertMany(finalDocuments);
    const backgrounds = currentDeck.cardBackgrounds || [];
    aiService.logAiEvent('run_completed', {
      runId,
      flow: 'deck',
      deckId: String(currentDeck._id),
      createdCount: insertedFlashcards.length,
      durationMs: Date.now() - startedAt,
      metrics,
    });

    if (streamProgress) {
      sendEvent(res, 'complete', {
        runId,
        createdCount: insertedFlashcards.length,
        target: targetCount,
      });
      stopEventStream?.();
      return res.end();
    }
    return res.status(201).json(insertedFlashcards.map((c) => c.serialize(backgrounds)));

  } catch (err) {
    if (runId) {
      aiService.logAiEvent('run_failed', {
        runId,
        flow: 'deck',
        batch: currentBatch || null,
        generated: generatedCount,
        audited: auditedCount,
        accepted: acceptedCount,
        code: err.code ?? null,
        providerStatus: err.status ?? null,
      });
    }
    const message = err.httpStatus ? err.message : aiService.getSafeErrorMessage(err);
    if (streamStarted) {
      sendEvent(res, 'error', { error: message, runId });
      stopEventStream?.();
      return res.end();
    }
    return res.status(err.httpStatus || 502).json({ message });
  }
};
