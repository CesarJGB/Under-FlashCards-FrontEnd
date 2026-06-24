const mongoose = require('mongoose');

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI;
  const DB_NAME = process.env.DB_NAME || 'flashcards';

  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`MongoDB conector exitoso (db: ${DB_NAME})`);
  } catch (err) {
    console.error('[FATAL] Error de conexión a MongoDB:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
