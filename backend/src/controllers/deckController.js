// FILE: backend/src/controllers/deckController.js

const Deck = require('../models/Deck');
const Flashcard = require('../models/Flashcard');

exports.getDecks = async (req, res) => {
  try {
    const { userId } = req.params;
    // Captura de filtros de la nueva jerarquía académica desde la query string
    const { materiaId, parcialNumber, temaId, subtemaId } = req.query;
    
    // Condición base de visibilidad
    const query = {
      $or: [
        { userId },
        { isDefault: true },
        { isPublicReadOnly: true }
      ]
    };

    // Filtros dinámicos condicionales (Soporta 'null' string para capturar mazos huérfanos/antiguos)
    if (materiaId) query.materiaId = materiaId === 'null' ? null : materiaId;
    if (parcialNumber) query.parcialNumber = parcialNumber === 'null' ? null : Number(parcialNumber);
    if (temaId) query.temaId = temaId === 'null' ? null : temaId;
    if (subtemaId) query.subtemaId = subtemaId === 'null' ? null : subtemaId;

    const decks = await Deck.find(query).sort({ createdAt: -1 });

    const deckIds = decks.map((d) => d._id);
    const counts = await Flashcard.aggregate([
      { $match: { deckId: { $in: deckIds } } },
      { $group: { _id: '$deckId', count: { $sum: 1 } } },
    ]);
    
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    return res.json(decks.map((d) => d.serialize(countMap[String(d._id)] || 0)));
  } catch (err) {
    console.error('[decks:get] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.createDeck = async (req, res) => {
  try {
    const { 
      userId, title, coverColor, coverImage, 
      materiaId, parcialNumber, temaId, subtemaId 
    } = req.body || {};

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    if (parcialNumber && ![1, 2, 3].includes(Number(parcialNumber))) {
      return res.status(400).json({ error: 'Invalid parcial number. Must be 1, 2 or 3.' });
    }

    const deck = await Deck.create({
      userId,
      title: title.trim(),
      coverColor: coverColor || '#ffffff',
      coverImage: coverImage || '',
      // Asignaciones de la nueva jerarquía académica
      materiaId: materiaId || null,
      parcialNumber: parcialNumber ? Number(parcialNumber) : null,
      temaId: temaId || null,
      subtemaId: subtemaId || null
    });

    return res.status(201).json(deck.serialize(0));
  } catch (err) {
    console.error('[decks:post] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.updateDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, coverColor, coverImage, isStarred,
      materiaId, parcialNumber, temaId, subtemaId
    } = req.body || {};

    const update = {};
    if (typeof title === 'string') update.title = title.trim();
    if (typeof coverColor === 'string') update.coverColor = coverColor;
    if (typeof coverImage === 'string') update.coverImage = coverImage;
    if (typeof isStarred === 'boolean') update.isStarred = isStarred;

    // Permite reubicar o desvincular el mazo dentro de la jerarquía académica
    if (materiaId !== undefined) update.materiaId = materiaId;
    if (parcialNumber !== undefined) {
      if (parcialNumber !== null && ![1, 2, 3].includes(Number(parcialNumber))) {
        return res.status(400).json({ error: 'Invalid parcial number. Must be 1, 2 or 3.' });
      }
      update.parcialNumber = parcialNumber ? Number(parcialNumber) : null;
    }
    if (temaId !== undefined) update.temaId = temaId;
    if (subtemaId !== undefined) update.subtemaId = subtemaId;

    const deck = await Deck.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    const cardCount = await Flashcard.countDocuments({ deckId: deck._id });
    return res.json(deck.serialize(cardCount));
  } catch (err) {
    console.error('[decks:put] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.updateDefault = async (req, res) => {
  try {
    const { id } = req.params;
    const { isDefault } = req.body || {};
    const update = { 
      isDefault: !!isDefault,
      ...(isDefault ? { isPublicReadOnly: false } : {})
    };

    const deck = await Deck.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    const cardCount = await Flashcard.countDocuments({ deckId: deck._id });
    return res.json(deck.serialize(cardCount));
  } catch (err) {
    console.error('[decks:put-default] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.updatePublicReadOnly = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublicReadOnly } = req.body || {};
    const update = { 
      isPublicReadOnly: !!isPublicReadOnly,
      ...(isPublicReadOnly ? { isDefault: false } : {})
    };

    const deck = await Deck.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    const cardCount = await Flashcard.countDocuments({ deckId: deck._id });
    return res.json(deck.serialize(cardCount));
  } catch (err) {
    console.error('[decks:put-readonly] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.deleteDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    const deck = await Deck.findOneAndDelete({
      _id: id,
      userId,
      $nor: [{ aiGenerationLocks: { $elemMatch: { expiresAt: { $gt: new Date() } } } }],
    });
    if (!deck) {
      const exists = await Deck.exists({ _id: id, userId });
      if (!exists) return res.status(404).json({ error: 'Deck not found.' });
      return res.status(409).json({ error: 'El mazo tiene una generación con IA en proceso. Inténtalo de nuevo cuando termine.' });
    }
    await Flashcard.deleteMany({ deckId: id });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[decks:delete] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.exportDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const deck = await Deck.findById(id);
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    const cards = await Flashcard.find({ deckId: id }).sort({ createdAt: -1 });
    return res.json({
      deck: deck.serialize(cards.length),
      cards: cards.map((c) => ({
        id: c._id, // 👈 INYECCIÓN REQUERIDA: Añade el ObjectId único de cada tarjeta para el Radar y la IA
        question: c.question,
        answer: c.answer,
        bgImageIndex: c.bgImageIndex,
        textAlign: c.textAlign,
        fontSize: c.fontSize,
        easeFactor: c.easeFactor,
        contentImage: c.contentImage || '', 
        imageSide: c.imageSide || ''
      })),
    });
  } catch (err) {
    console.error('[decks:export] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.importDeck = async (req, res) => {
  try {
    const { userId, deck, cards } = req.body || {};
    if (!deck || !deck.title?.trim()) {
      return res.status(400).json({ error: 'Invalid deck payload.' });
    }

    // Permite inyectar los metadatos de organización al importar copias de seguridad de forma contextual
    const newDeck = await Deck.create({
      userId,
      title: deck.title.trim(),
      coverColor: deck.coverColor || '#ffffff',
      coverImage: typeof deck.coverImage === 'string' ? deck.coverImage : '',
      cardBackgrounds: Array.isArray(deck.cardBackgrounds) ? deck.cardBackgrounds : [],
      materiaId: deck.materiaId || null,
      parcialNumber: deck.parcialNumber ? Number(deck.parcialNumber) : null,
      temaId: deck.temaId || null,
      subtemaId: deck.subtemaId || null
    });

    let insertedCount = 0;
    if (Array.isArray(cards) && cards.length) {
      const docs = cards
        .filter((c) => c && c.question && c.answer)
        .map((c) => ({
          userId,
          deckId: newDeck._id,
          question: String(c.question),
          answer: String(c.answer),
          bgImageIndex: typeof c.bgImageIndex === 'number' ? c.bgImageIndex : -1,
          contentImage: typeof c.contentImage === 'string' ? c.contentImage : '', 
          imageSide: typeof c.imageSide === 'string' ? c.imageSide : '',
          ...(['left', 'center', 'right'].includes(c.textAlign) ? { textAlign: c.textAlign } : {}),
          ...(typeof c.fontSize === 'string' ? { fontSize: c.fontSize } : {}),
          ...(typeof c.easeFactor === 'number' ? { easeFactor: c.easeFactor } : {}),
        }));
      if (docs.length) {
        const inserted = await Flashcard.insertMany(docs);
        insertedCount = inserted.length;
      }
    }

    return res.status(201).json({
      success: true,
      deck: newDeck.serialize(insertedCount),
    });
  } catch (err) {
    console.error('[decks:import] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};
