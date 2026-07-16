const express = require('express');
const router = express.Router();
const flashcardController = require('../controllers/flashcardController');
const { protect } = require('../controllers/authController');

// Operaciones individuales de tarjetas
router.post('/flashcards', flashcardController.createCard);
router.put('/flashcards/:id', flashcardController.updateCard);
router.delete('/flashcards/:id', flashcardController.deleteCard);
router.get('/flashcards/deck/:deckId', flashcardController.getCardsByDeck);

// Operaciones masivas e Inteligencia Artificial
router.post('/flashcards/bulk', flashcardController.createBulkCards);
router.post('/flashcards/generate-ai', protect, flashcardController.generateAiCards);

module.exports = router;
