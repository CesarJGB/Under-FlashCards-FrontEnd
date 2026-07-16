require('dotenv').config();

const mongoose = require('mongoose');

const INDEX_NAME = 'publicProfile.shareId_1';
const INDEX_KEY = { 'publicProfile.shareId': 1 };
const INDEX_OPTIONS = {
  unique: true,
  partialFilterExpression: { 'publicProfile.shareId': { $type: 'string' } }
};

function isExpectedIndex(index) {
  return index.name === INDEX_NAME
    && index.unique === true
    && index.partialFilterExpression?.['publicProfile.shareId']?.$type === 'string';
}

async function migrate() {
  const mongoUri = process.env.MONGO_URL || process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || 'flashcards';

  if (!mongoUri) {
    throw new Error('MONGO_URL o MONGO_URI es obligatorio.');
  }

  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;
  const collectionExists = await db.listCollections({ name: 'materias' }).hasNext();

  if (!collectionExists) {
    console.log('La colección materias todavía no existe; no hay índice que migrar.');
    return;
  }

  const collection = db.collection('materias');
  const existingIndex = (await collection.indexes()).find((index) => index.name === INDEX_NAME);

  if (existingIndex && !isExpectedIndex(existingIndex)) {
    await collection.dropIndex(INDEX_NAME);
    console.log(`Índice ${INDEX_NAME} anterior eliminado.`);
  }

  if (!isExpectedIndex(existingIndex)) {
    await collection.createIndex(INDEX_KEY, INDEX_OPTIONS);
    console.log(`Índice ${INDEX_NAME} creado como único parcial.`);
  } else {
    console.log(`Índice ${INDEX_NAME} ya tiene la configuración correcta.`);
  }
}

migrate()
  .catch((error) => {
    console.error('No se pudo migrar el índice de shareId:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
