// backend/src/routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// Registrar la telemetría de una sesión de repaso
router.post('/decks/:deckId/reviews', reviewController.registerReview);

module.exports = router;
