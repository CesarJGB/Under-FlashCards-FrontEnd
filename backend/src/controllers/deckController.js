const Deck = require('../models/Deck');
const Flashcard = require('../models/Flashcard');

exports.getDecks = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const decks = await Deck.find({
      $or: [
        { userId },
        { isDefault: true },
        { isPublicReadOnly: true }
      ]
    }).sort({ createdAt: -1 });

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
    const { userId, title, coverColor, coverImage } = req.body || {};
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }
    const deck = await Deck.create({
      userId,
      title: title.trim(),
      coverColor: coverColor || '#ffffff',
      coverImage: coverImage || '',
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
    const { title, coverColor, coverImage, isStarred } = req.body || {};
    const update = {};
    if (typeof title === 'string') update.title = title.trim();
    if (typeof coverColor === 'string') update.coverColor = coverColor;
    if (typeof coverImage === 'string') update.coverImage = coverImage;
    if (typeof isStarred === 'boolean') update.isStarred = isStarred;

    const deck = await Deck.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    return res.json(deck.serialize());
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
    return res.json(deck.serialize());
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
    return res.json(deck.serialize());
  } catch (err) {
    console.error('[decks:put-readonly] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.deleteDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const deck = await Deck.findByIdAndDelete(id);
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
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

    const newDeck = await Deck.create({
      userId,
      title: deck.title.trim(),
      coverColor: deck.coverColor || '#ffffff',
      coverImage: typeof deck.coverImage === 'string' ? deck.coverImage : '',
      cardBackgrounds: Array.isArray(deck.cardBackgrounds) ? deck.cardBackgrounds : [],
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
