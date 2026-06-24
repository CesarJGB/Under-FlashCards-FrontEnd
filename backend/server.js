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
    coverImage: { type: String, default: '' },
    cardBackgrounds: { type: [String], default: [] },
    isStarred: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    isPublicReadOnly: { type: Boolean, default: false }
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
    bgImageIndex: { type: Number, default: -1 },
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    fontSize: { type: String, default: 'text-base' },
    contentImage: { type: String, default: '' },
    imageSide: { type: String, enum: ['question', 'answer', ''], default: '' }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Deck = mongoose.model('Deck', deckSchema);
const Flashcard = mongoose.model('Flashcard', flashcardSchema);

const maskKey = (key) =>
  key ? `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : '';

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
  contentImage: c.contentImage || '', 
  imageSide: c.imageSide || '',       
  createdAt: c.createdAt,
});

const serializeDeck = (d, cardCount) => ({
  id: d._id,
  userId: d.userId,
  title: d.title,
  coverColor: d.coverColor,
  coverImage: d.coverImage,
  cardCount: typeof cardCount === 'number' ? cardCount : undefined,
  cardBackgrounds: d.cardBackgrounds || [], 
  isStarred: d.isStarred || false,
  isDefault: d.isDefault || false,
  isPublicReadOnly: d.isPublicReadOnly || false,
  createdAt: d.createdAt,
});

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
// CORS
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'flashcards-backend', db: mongoose.connection.readyState });
});

// -----------------------------------------------------------------------------
// POST /api/auth/google
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
// GET /api/user/:userId
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
// PUT /api/user/settings
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
app.get('/api/decks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    
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
    return res.json(decks.map((d) => serializeDeck(d, countMap[String(d._id)] || 0)));
  } catch (err) {
    console.error('[decks:get] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

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

app.put('/api/decks/:id/default', async (req, res) => {
  try {
    const { id } = req.params;
    const { isDefault } = req.body || {};
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid deck id.' });
    }

    const update = { 
      isDefault: !!isDefault,
      ...(isDefault ? { isPublicReadOnly: false } : {})
    };

    const deck = await Deck.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    return res.json(serializeDeck(deck));
  } catch (err) {
    console.error('[decks:put-default] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

app.put('/api/decks/:id/public-readonly', async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublicReadOnly } = req.body || {};
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid deck id.' });
    }

    const update = { 
      isPublicReadOnly: !!isPublicReadOnly,
      ...(isPublicReadOnly ? { isDefault: false } : {})
    };

    const deck = await Deck.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    return res.json(serializeDeck(deck));
  } catch (err) {
    console.error('[decks:put-readonly] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

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
        contentImage: c.contentImage || '', 
        imageSide: c.imageSide || ''
      })),
    });
  } catch (err) {
    console.error('[decks:export] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

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
      deck: serializeDeck(newDeck, insertedCount),
    });
  } catch (err) {
    console.error('[decks:import] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// -----------------------------------------------------------------------------
// FLASHCARDS
// -----------------------------------------------------------------------------

// ✨ NUEVO ENDPOINT: Generación inteligente mediante OpenAI (Formatos JSON Nativos)
app.post('/api/flashcards/generate-ai', async (req, res) => {
  try {
    const { userId, deckId, text, count, batchStyles } = req.body || {};
    
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(deckId)) {
      return res.status(400).json({ message: 'IDs de usuario o mazo inválidos.' });
    }
    if (!text?.trim()) {
      return res.status(400).json({ message: 'Proporciona anotaciones o apuntes para procesar.' });
    }

    // 1. Extraer la API Key privada guardada de forma segura en tu Mongoose User
    const user = await User.findById(userId);
    if (!user || !user.aiApiKey) {
      return res.status(400).json({ message: 'No has configurado tu API Key en la sección de Ajustes.' });
    }

    const currentDeck = await Deck.findById(deckId);
    if (!currentDeck) return res.status(404).json({ message: 'Mazo no encontrado en la base de datos.' });

    const targetCount = parseInt(count, 10) || 5;

    // 2. Comunicarse directamente con OpenAI forzando un objeto de respuesta JSON estructurado
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
      const errorText = await openAiResponse.text().catch(() => '');
      console.error('[OpenAI Error Downstream]:', errorText);
      return res.status(502).json({ message: 'El motor de IA rechazó la solicitud. Revisa la vigencia y saldo de tu clave.' });
    }

    const aiResponseData = await openAiResponse.json();
    let rawJsonString = aiResponseData.choices?.[0]?.message?.content?.trim() || "{}";

    // Sanitizador preventivo por si el modelo ignora el response_format e inserta bloques de código markdown
    if (rawJsonString.startsWith('```')) {
      rawJsonString = rawJsonString.replace(/```json|```/g, '').trim();
    }

    const parsedAiResult = JSON.parse(rawJsonString);
    const generatedCardsArray = parsedAiResult.cards;

    if (!Array.isArray(generatedCardsArray) || generatedCardsArray.length === 0) {
      return res.status(422).json({ message: 'La IA no devolvió un lote de tarjetas con la estructura esperada.' });
    }

    // 3. Procesar las tarjetas inyectando estilos e insertando en bloque en MongoDB
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

    // Persistir cambios en la colección de fondos del mazo e insertar flashcards
    await currentDeck.save();
    const insertedFlashcards = await Flashcard.insertMany(documentsToInsert);
    const backgrounds = currentDeck.cardBackgrounds || [];

    // Retornar al cliente React el listado serializado listo para renderizar a 0ms
    return res.status(201).json(insertedFlashcards.map((c) => serializeFlashcard(c, backgrounds)));

  } catch (err) {
    console.error('[flashcards:generate-ai] fatal error:', err.message);
    return res.status(500).json({ message: 'Ocurrió un colapso interno al intentar fabricar las tarjetas artificiales.' });
  }
});

// POST /api/flashcards/bulk
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

    return res.status(201).json(inserted.map((c) => serializeFlashcard(c, backgrounds)));
  } catch (err) {
    console.error('[flashcards:bulk] error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor al crear lote.' });
  }
});

// GET /api/flashcards/deck/:deckId
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

// POST /api/flashcards
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
      contentImage: contentImage || '', 
      imageSide: imageSide || '',       
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

// PUT /api/flashcards/:id
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

// DELETE /api/flashcards/:id
app.delete('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid flashcard id.' });
    }
    const card = await Flashcard.filterByIdAndDelete(id);
    const cardDeleted = await Flashcard.findByIdAndDelete(id);
    if (!cardDeleted) return res.status(404).json({ error: 'Flashcard not found.' });
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
