// backend/src/controllers/flashcardController.js
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

    // 🎯 PUNTO 3: Ajuste inflado dinámico (Padding factor configurable)
    // Lee desde las variables de entorno (.env). Por ejemplo: AI_TARGET_PADDING_FACTOR=0.30
    const paddingFactor = parseFloat(process.env.AI_TARGET_PADDING_FACTOR) || 0.30;
    const phase1Target = Math.ceil(targetCount * (1 + paddingFactor));

    // ─── PIPELINE FASE 1: GENERACIÓN CRUDA ───
    const startTimePhase1 = Date.now();
    console.log(`[AI Pipeline] Iniciando Fase 1 para usuario ${userId} (Target Solicitado: ${targetCount} | Inflado a: ${phase1Target})`);
    
    const rawCards = await aiService.generateRawCards(text, phase1Target, user.aiApiKey);
    const durationPhase1 = Date.now() - startTimePhase1;
    console.log(`[AI Pipeline] Fase 1 Terminar. Recibidas ${rawCards.length} tarjetas crudas en ${durationPhase1}ms.`);

    // ─── PIPELINE FASE 2: AUDITORÍA ESTRICTA (BATCH) ───
    const startTimePhase2 = Date.now();
    console.log(`[AI Pipeline] Iniciando Fase 2 de Auditoría Conceptual y Factual...`);
    
    const auditedCards = await aiService.criticizeAndRefineCards(text, rawCards, user.aiApiKey);
    const durationPhase2 = Date.now() - startTimePhase2;

    // 📊 PUNTOS 4 Y 5: Métricas avanzadas de Logging y análisis de motivos
    const metrics = {
      fase: 2,
      recibidas: rawCards.length,
      eliminadas: 0,
      fusionadas: 0,
      corregidas: 0,
      sin_cambios: 0,
      tiempo_ms: durationPhase2
    };

    const documentsToInsert = [];
    const globalBg = batchStyles?.bgImage || '';
    const globalAlign = batchStyles?.textAlign || 'center';
    const globalSize = batchStyles?.fontSize || 'text-base';

    for (const card of auditedCards) {
      if (!card || !card.status) continue;

      // Acumular contadores de métricas según la respuesta estructurada de DeepSeek
      if (metrics[`${card.status}s`] !== undefined) {
        metrics[`${card.status}s`]++;
      } else if (card.status === 'sin_cambios') {
        metrics.sin_cambios++;
      }

      // Loggear en consola los motivos específicos de depuración (Solo visualización interna)
      if (['corregida', 'fusionada', 'eliminada'].includes(card.status)) {
        console.log(`   [Quality Alert] Tarjeta marcada como [${card.status.toUpperCase()}]. Motivo: "${card.reason || 'No especificado'}"`);
        console.log(`   └─ Q: "${card.question}"`);
      }

      // Filtrar: Solo guardamos las tarjetas que pasaron limpias o que fueron optimizadas estéticamente
      if (card.status === 'eliminada' || card.status === 'fusionada') {
        continue; 
      }

      if (!card.question?.trim() || !card.answer?.trim()) continue;

      let bgImageIndex = -1;
      if (globalBg) {
        let idx = currentDeck.cardBackgrounds.indexOf(globalBg);
        if (idx === -1) {
          currentDeck.cardBackgrounds.push(globalBg);
          idx = currentDeck.cardBackgrounds.length - 1;
        }
        bgImageIndex = idx;
      }

      // Empaquetar para MongoDB limpia de metadatos de IA
      documentsToInsert.push({
        userId,
        deckId,
        question: String(card.question).trim(),
        answer: String(card.answer).trim(),
        bgImageIndex,
        textAlign: ['left', 'center', 'right'].includes(globalAlign) ? globalAlign : 'center',
        fontSize: globalSize,
        contentImage: '',
        imageSide: ''
      });
    }

    // Imprimir el objeto de log estructurado final requerido
    console.log(`[AI Pipeline Metrics]:`, JSON.stringify(metrics));

    if (documentsToInsert.length === 0) {
      return res.status(422).json({ message: 'La auditoría determinó que ninguna tarjeta generada cumplía con los estándares de veracidad del documento.' });
    }

    // Persistir mazo refinado
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
