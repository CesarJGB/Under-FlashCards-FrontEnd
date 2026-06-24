const Flashcard = require('../models/Flashcard');
const Deck = require('../models/Deck');
const User = require('../models/User');

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

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.aiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', 
        response_format: { type: "json_object" }, 
        messages: [
          {
            role: 'system',
            content: `Eres un procesador educativo de alta precisión. Tu tarea es generar exactamente ${targetCount} flashcards en español basadas exclusivamente en el texto y las directrices provistas por el usuario. 
            Debes responder ÚNICAMENTE con un objeto JSON válido que contenga la propiedad "cards" mapeada a un arreglo de objetos. Cada objeto debe contener de manera obligatoria y exclusiva las llaves "question" y "answer" en formato string de texto plano. No inyectes bloques markdown ni texto explicativo adicional.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.4
      })
    });

    if (!openAiResponse.ok) {
      return res.status(502).json({ message: 'El motor de IA rechazó la solicitud. Revisa la vigencia y saldo de tu clave.' });
    }

    const aiResponseData = await openAiResponse.json();
    let rawJsonString = aiResponseData.choices?.[0]?.message?.content?.trim() || "{}";

    if (rawJsonString.startsWith('```')) {
      rawJsonString = rawJsonString.replace(/```json|```/g, '').trim();
    }

    const parsedAiResult = JSON.parse(rawJsonString);
    const generatedCardsArray = parsedAiResult.cards;

    if (!Array.isArray(generatedCardsArray) || generatedCardsArray.length === 0) {
      return res.status(422).json({ message: 'La IA no devolvió un lote de tarjetas con la estructura esperada.' });
    }

    const globalBg = batchStyles?.bgImage || '';
    const globalAlign = batchStyles?.textAlign || 'center';
    const globalSize = batchStyles?.fontSize || 'text-base';

    const documentsToInsert = [];
    for (const cardData of generatedCardsArray) {
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
      return res.status(400).json({ message: 'Las tarjetas devueltas por la IA no contenían datos válidos para guardar.' });
    }

    await currentDeck.save();
    const insertedFlashcards = await Flashcard.insertMany(documentsToInsert);
    const backgrounds = currentDeck.cardBackgrounds || [];

    return res.status(201).json(insertedFlashcards.map((c) => c.serialize(backgrounds)));

  } catch (err) {
    console.error('[flashcards:generate-ai] fatal error:', err.message);
    return res.status(500).json({ message: 'Ocurrió un error al fabricar las tarjetas artificiales.' });
  }
};
