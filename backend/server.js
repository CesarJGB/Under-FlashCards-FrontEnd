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
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Deck = mongoose.model('Deck', deckSchema);
const Flashcard = mongoose.model('Flashcard', flashcardSchema);

// Helpers: never leak the raw aiApiKey to clients.
const maskKey = (key) =>
  key ? `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : '';

const serializeFlashcard = (c) => ({
  id: c._id,
  userId: c.userId,
  deckId: c.deckId,
  question: c.question,
  answer: c.answer,
  easeFactor: c.easeFactor,
  createdAt: c.createdAt,
});

const serializeDeck = (d, cardCount) => ({
  id: d._id,
  userId: d.userId,
  title: d.title,
  coverColor: d.coverColor,
  coverImage: d.coverImage,
  cardCount: typeof cardCount === 'number' ? cardCount : undefined,
  createdAt: d.createdAt,
});

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
app.use(express.json({ limit: '1mb' }));

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
    const { title, coverColor, coverImage } = req.body || {};
    const update = {};
    if (typeof title === 'string') update.title = title.trim();
    if (typeof coverColor === 'string') update.coverColor = coverColor;
    if (typeof coverImage === 'string') update.coverImage = coverImage;

    const deck = await Deck.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    return res.json(serializeDeck(deck));
  } catch (err) {
    console.error('[decks:put] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/decks/:id — delete a deck and its flashcards
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

// -----------------------------------------------------------------------------
// FLASHCARDS — scoped to a deck
// -----------------------------------------------------------------------------

// GET /api/flashcards/deck/:deckId — list flashcards of a deck
app.get('/api/flashcards/deck/:deckId', async (req, res) => {
  try {
    const { deckId } = req.params;
    if (!mongoose.isValidObjectId(deckId)) {
      return res.status(400).json({ error: 'Invalid deck id.' });
    }
    const cards = await Flashcard.find({ deckId }).sort({ createdAt: -1 });
    return res.json(cards.map(serializeFlashcard));
  } catch (err) {
    console.error('[flashcards:get-deck] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/flashcards — create a flashcard (requires deckId)
app.post('/api/flashcards', async (req, res) => {
  try {
    const { userId, deckId, question, answer } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    if (!mongoose.isValidObjectId(deckId)) {
      return res.status(400).json({ error: 'Invalid deck id.' });
    }
    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({ error: 'Question and answer are required.' });
    }
    const card = await Flashcard.create({
      userId,
      deckId,
      question: question.trim(),
      answer: answer.trim(),
    });
    return res.status(201).json(serializeFlashcard(card));
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
    const { question, answer } = req.body || {};
    const update = {};
    if (typeof question === 'string') update.question = question.trim();
    if (typeof answer === 'string') update.answer = answer.trim();

    const card = await Flashcard.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!card) return res.status(404).json({ error: 'Flashcard not found.' });
    return res.json(serializeFlashcard(card));
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
