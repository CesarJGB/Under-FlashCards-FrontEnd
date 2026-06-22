// =============================================================================
// Flashcards MVP - Backend (Node.js + Express + Mongoose)
// Google Sign-In verification + MongoDB persistence (users, flashcards).
//
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
// THIS BREAKS THE AUTH. All config comes from environment variables (.env).
// =============================================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');

const app = express();

const PORT = process.env.PORT || 8001;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'flashcards';

if (!GOOGLE_CLIENT_ID) {
  console.error('[FATAL] GOOGLE_CLIENT_ID is not defined. Set it in your .env file.');
}

// -----------------------------------------------------------------------------
// MongoDB (Mongoose) connection
// -----------------------------------------------------------------------------
mongoose
  .connect(MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log(`MongoDB connected (db: ${DB_NAME})`))
  .catch((err) => console.error('[FATAL] MongoDB connection error:', err.message));

// -----------------------------------------------------------------------------
// Models
// -----------------------------------------------------------------------------
const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    name: String,
    picture: String,
    // Optional, user-provided AI API key. TODO: encrypt at rest in the future.
    aiApiKey: { type: String, default: '' },
  },
  { timestamps: true }
);

const deckSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    coverColor: { type: String, default: '#ffffff' },
    // Optional cover image stored as a base64 data URL.
    coverImage: { type: String, default: '' },
    // 📸 EL POOL: Guarda cada imagen base64 ÚNICA del mazo una sola vez para optimizar espacio
    cardBackgrounds: { type: [String], default: [] },
    // ⭐ FAVORITOS: Guardado correctamente dentro de la estructura del esquema
    isStarred: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const flashcardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true,
      index: true,
    },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    easeFactor: { type: Number, default: 2.5 },
    // 🔍 INDEXACIÓN INTELIGENTE: Cambiamos el string gigante por un puntero numérico al pool del mazo
    bgImageIndex: { type: Number, default: -1 },
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    fontSize: { type: String, default: 'text-base' },
    // 🖼️ NUEVOS ATRIBUTOS: Imagen de contenido específica (ej. Anatomía) y en qué lado renderiza
    contentImage: { type: String, default: '' },
    imageSide: { type: String, enum: ['question', 'answer', ''], default: '' }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Deck = mongoose.model('Deck', deckSchema);
const Flashcard = mongoose.model('Flashcard', flashcardSchema);

// Helpers: never leak the raw aiApiKey to clients.
const maskKey = (key) =>
  key ? `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : '';

// Infla el índice numérico convirtiéndolo dinámicamente en la cadena Base64 real para el frontend
const serializeFlashcard = (c, cardBackgrounds = []) => ({
  id: c._id,
  userId: c.userId,
  deckId: c.deckId,
  question: c.question,
  answer: c.answer,
  easeFactor: c.easeFactor,
  bgImage: (cardBackgrounds && c.bgImageIndex >= 0) ? (cardBackgrounds[c.bgImageIndex] || '') : '',
  textAlign: c.textAlign,
  fontSize: c.fontSize,
  contentImage: c.contentImage || '', // 🚀 Mapeo de la imagen de contenido hacia el cliente
  imageSide: c.imageSide || '',       // 🚀 Mapeo de la cara activa asignada
  createdAt: c.createdAt,
});

const serializeDeck = (d, cardCount) => ({
  id: d._id,
  userId: d.userId,
  title: d.title,
  coverColor: d.coverColor,
  coverImage: d.coverImage,
  cardCount: typeof cardCount === 'number' ? cardCount : undefined,
  cardBackgrounds: d.cardBackgrounds || [], // Lo exponemos para portabilidad de importación/exportación
  isStarred: d.isStarred || false,
  createdAt: d.createdAt,
});

// FUNCIÓN MÁGICA DE DEDUPLICACIÓN: Retorna el índice si ya existe, o mete el activo al pool si es nuevo
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

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// -----------------------------------------------------------------------------
// CORS: explicit allow-list (Cloudflare Pages domain + localhost)
// -----------------------------------------------------------------------------
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const devOrigins = ['http://localhost:3000', 'http://localhost:5173'];
const allowedOrigins = [...new Set([...configuredOrigins, ...devOrigins])];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));

// 🛠️ SOLUCIÓN AL SOLICITAR IMÁGENES GRANDES: Expandimos el parser a 50MB para soportar fotos en Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'flashcards-backend', db: mongoose.connection.readyState });
});

// -----------------------------------------------------------------------------
// POST /api/auth/google — verify Google idToken + upsert user
// -----------------------------------------------------------------------------
app.post('/api/auth/google', async (req, res) => {
  try {
    const idToken = req.body?.credential || req.body?.token;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing Google credential token.' });
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Token audience mismatch.' });
    }
    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'Google email is not verified.' });
    }

    const user = await User.findOneAndUpdate(
      { googleId: payload.sub },
      {
        $set: { email: payload.email, name: payload.name, picture: payload.picture },
        $setOnInsert: { googleId: payload.sub },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        hasApiKey: !!user.aiApiKey,
      },
    });
  } catch (err) {
    console.error('[auth/google] Verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired Google token.' });
  }
});

// -----------------------------------------------------------------------------
// GET /api/user/:userId — settings state (no raw key)
// -----------------------------------------------------------------------------
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      hasApiKey: !!user.aiApiKey,
      apiKeyMasked: maskKey(user.aiApiKey),
    });
  } catch (err) {
    console.error('[user] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// -----------------------------------------------------------------------------
// PUT /api/user/settings — update aiApiKey
// -----------------------------------------------------------------------------
app.put('/api/user/settings', async (req, res) => {
  try {
    const { userId, aiApiKey } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    if (typeof aiApiKey !== 'string') {
      return res.status(400).json({ error: 'aiApiKey must be a string.' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { aiApiKey: aiApiKey.trim() } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json({
      success: true,
      hasApiKey: !!user.aiApiKey,
      apiKeyMasked: maskKey(user.aiApiKey),
    });
  } catch (err) {
    console.error('[user/settings] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// -----------------------------------------------------------------------------
// DECKS — CRUD
// -----------------------------------------------------------------------------

// GET /api/decks/:userId — list a user's decks (with card counts)
app.get('/api/decks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    const decks = await Deck.find({ userId }).sort({ createdAt: -1 });
    const counts = await Flashcard.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$deckId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    return res.json(decks.map((d) => serializeDeck(d, countMap[String(d._id)] || 0)));
  } catch (err) {
    console.error('[decks:get] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/decks — create a deck
app.post('/api/decks', async (req, res) => {
  try {
    const { userId, title, coverColor, coverImage } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }
    const deck = await Deck.create({
      userId,
      title: title.trim(),
      coverColor: coverColor || '#ffffff',
      coverImage: coverImage || '',
    });
    return res.status(201).json(serializeDeck(deck, 0));
  } catch (err) {
    console.error('[decks:post] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/decks/:id — update a deck
app.put('/api/decks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid deck id.' });
    }
    const { title, coverColor, coverImage, isStarred } = req.body || {};
    const update = {};
    if (typeof title === 'string') update.title = title.trim();
    if (typeof coverColor === 'string') update.coverColor = coverColor;
    if (typeof coverImage === 'string') update.coverImage = coverImage;
    if (typeof isStarred === 'boolean') update.isStarred = isStarred;

    const deck = await Deck.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    return res.json(serializeDeck(deck));
  } catch (err) {
    console.error('[decks:put] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/decks/:id — delete a mazo and its flashcards
app.delete('/api/decks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid deck id.' });
    }
    const deck = await Deck.findByIdAndDelete(id);
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    await Flashcard.deleteMany({ deckId: id });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[decks:delete] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/decks/:id/export — mazo + its flashcards as a portable JSON
app.get('/api/decks/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid deck id.' });
    }
    const deck = await Deck.findById(id);
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    const cards = await Flashcard.find({ deckId: id }).sort({ createdAt: -1 });
    return res.json({
      deck: serializeDeck(deck, cards.length),
      cards: cards.map((c) => ({
        question: c.question,
        answer: c.answer,
        bgImageIndex: c.bgImageIndex,
        textAlign: c.textAlign,
        fontSize: c.fontSize,
        easeFactor: c.easeFactor,
        contentImage: c.contentImage || '', // 🚀 Integra las imágenes en el JSON de respaldo
        imageSide: c.imageSide || ''
      })),
    });
  } catch (err) {
    console.error('[decks:export] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/decks/import — create a new mazo (owned by userId) + its cards
app.post('/api/decks/import', async (req, res) => {
  try {
    const { userId, deck, cards } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
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
          contentImage: typeof c.contentImage === 'string' ? c.contentImage : '', // 🚀 Rehidrata imágenes de contenido
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
      deck: serializeDeck(newDeck, insertedCount),
    });
  } catch (err) {
    console.error('[decks:import] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// -----------------------------------------------------------------------------
// FLASHCARDS — scoped to a mazo
// -----------------------------------------------------------------------------

// POST /api/flashcards/bulk — Crear múltiples flashcards blindado ante imágenes pesadas
app.post('/api/flashcards/bulk', async (req, res) => {
  try {
    const { userId, deckId, batchStyles, cards } = req.body || {};
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(deckId)) {
      return res.status(400).json({ error: 'IDs de usuario o mazo inválidos.' });
    }
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
        contentImage: '', // Creaciones masivas por texto plano entran por defecto limpias de imágenes
        imageSide: ''
      });
    }

    if (docs.length === 0) {
      return res.status(400).json({ error: 'Ninguna tarjeta tiene formato válido.' });
    }

    await currentDeck.save();

    const inserted = await Flashcard.insertMany(docs);
    const backgrounds = currentDeck.cardBackgrounds || [];

    return res.status(201).json(inserted.map((c) => serializeFlashcard(c, backgrounds)));
  } catch (err) {
    console.error('[flashcards:bulk] error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor al crear lote.' });
  }
});

// GET /api/flashcards/deck/:deckId — list flashcards of a deck
app.get('/api/flashcards/deck/:deckId', async (req, res) => {
  try {
    const { deckId } = req.params;
    if (!mongoose.isValidObjectId(deckId)) {
      return res.status(400).json({ error: 'Invalid mazo id.' });
    }
    const deck = await Deck.findById(deckId);
    const backgrounds = deck ? deck.cardBackgrounds : [];

    const cards = await Flashcard.find({ deckId }).sort({ createdAt: -1 });
    return res.json(cards.map((c) => serializeFlashcard(c, backgrounds)));
  } catch (err) {
    console.error('[flashcards:get-deck] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/flashcards — create a flashcard (requires deckId)
app.post('/api/flashcards', async (req, res) => {
  try {
    const { userId, deckId, question, answer, bgImage, textAlign, fontSize, contentImage, imageSide } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    if (!mongoose.isValidObjectId(deckId)) {
      return res.status(400).json({ error: 'Invalid mazo id.' });
    }
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
      contentImage: contentImage || '', // 🚀 Captura y guarda el string comprimido
      imageSide: imageSide || '',       // 🚀 Captura la orientación del render
      ...(['left', 'center', 'right'].includes(textAlign) ? { textAlign } : {}),
      ...(typeof fontSize === 'string' ? { fontSize } : {}),
    });

    const deck = await Deck.findById(deckId);
    return res.status(201).json(serializeFlashcard(card, deck ? deck.cardBackgrounds : []));
  } catch (err) {
    console.error('[flashcards:post] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/flashcards/:id — edit a flashcard
app.put('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid flashcard id.' });
    }
    const { question, answer, bgImage, textAlign, fontSize, contentImage, imageSide } = req.body || {};
    const update = {};
    if (typeof question === 'string') update.question = question.trim();
    if (typeof answer === 'string') update.answer = answer.trim();
    if (['left', 'center', 'right'].includes(textAlign)) update.textAlign = textAlign;
    if (typeof fontSize === 'string') update.fontSize = fontSize;
    
    // 🚀 Actualiza opcionalmente las propiedades de imagen de contenido
    if (typeof contentImage === 'string') update.contentImage = contentImage;
    if (typeof imageSide === 'string') update.imageSide = imageSide;

    const currentCard = await Flashcard.findById(id);
    if (!currentCard) return res.status(404).json({ error: 'Flashcard not found.' });

    if (typeof bgImage === 'string') {
      update.bgImageIndex = await getOrCreateBgIndex(currentCard.deckId, bgImage);
    }

    const card = await Flashcard.findByIdAndUpdate(id, { $set: update }, { new: true });
    const deck = await Deck.findById(card.deckId);
    return res.json(serializeFlashcard(card, deck ? deck.cardBackgrounds : []));
  } catch (err) {
    console.error('[flashcards:put] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/flashcards/:id — delete a flashcard
app.delete('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid flashcard id.' });
    }
    const card = await Flashcard.findByIdAndDelete(id);
    if (!card) return res.status(404).json({ error: 'Flashcard not found.' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[flashcards:delete] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Flashcards backend listening on port ${PORT}`);
  console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
});
