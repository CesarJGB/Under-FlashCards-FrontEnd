// FILE: backend/src/server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI;
  const DB_NAME = process.env.DB_NAME || 'flashcards';
  const mongoose = require('mongoose');
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`MongoDB conectado (db: ${DB_NAME})`);
  } catch (err) {
    console.error('[FATAL] MongoDB connection error:', err.message);
    process.exit(1);
  }
};

const authRoutes = require('./routes/authRoutes');
const deckRoutes = require('./routes/deckRoutes');
const flashcardRoutes = require('./routes/flashcardRoutes');
const academicRoutes = require('./routes/academicRoutes'); // 👈 NUEVO: Importación de las rutas de jerarquía

const app = express();
const PORT = process.env.PORT || 8001;

// Inicializar base de datos
connectDB();

// -----------------------------------------------------------------------------
// CORS Configuración
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

// Middlewares Globales
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Monitoreo de salud
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({ status: 'ok', service: 'flashcards-backend', db: mongoose.connection.readyState });
});

// -----------------------------------------------------------------------------
// Vinculación de Enrutadores Modulares
// -----------------------------------------------------------------------------
app.use('/api', authRoutes);
app.use('/api', deckRoutes);
app.use('/api', flashcardRoutes);
app.use('/api', academicRoutes); // 👈 NUEVO: Registro del router unificado para Materias, Temas y Subtemas

// Encendido del servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Flashcards backend corriendo en el puerto ${PORT}`);
  console.log(`Orígenes CORS admitidos: ${allowedOrigins.join(', ')}`);
});
