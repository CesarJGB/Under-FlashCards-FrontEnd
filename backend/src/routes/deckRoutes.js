const express = require('express');
const router = express.Router();
const deckController = require('../controllers/deckController');
const reviewController = require('../controllers/reviewController'); // 🚀 Inyectado para telemetría y colas

// CRUD y herramientas de mazos
router.get('/decks/:userId', deckController.getDecks);
router.post('/decks', deckController.createDeck);
router.put('/decks/:id', deckController.updateDeck);
router.put('/decks/:id/default', deckController.updateDefault);
router.put('/decks/:id/public-readonly', deckController.updatePublicReadOnly);
router.delete('/decks/:id', deckController.deleteDeck);

// Exportación e Importación
router.get('/decks/:id/export', deckController.exportDeck);
router.post('/decks/import', deckController.importDeck);

// =========================================================================
// ZONA DE MÉTODOS DE ESTUDIO & REPASO
// =========================================================================
// Obtener la cola inteligente priorizada por errores y dificultad
router.get('/decks/:deckId/continuous-session', reviewController.getContinuousSessionCards);
// Obtener el mazo completo en orden aleatorio simple, sin ponderación (Repaso Normal)
router.get('/decks/:deckId/normal-session', reviewController.getNormalSessionCards);
// Cargar el mazo completo UNA SOLA VEZ (usado por SessionPlayer en ambos modos;
// la selección/shuffle de lotes se hace en el cliente para evitar reenviar
// imágenes pesadas en cada recarga)
router.get('/decks/:deckId/all-cards', reviewController.getAllSessionCards);

module.exports = router;
