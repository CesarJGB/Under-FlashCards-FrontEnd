const express = require('express');
const router = express.Router();
const deckController = require('../controllers/deckController');

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

module.exports = router;
