// backend/src/routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// Registrar la telemetría de una sesión de repaso
router.post('/decks/:deckId/reviews', reviewController.registerReview);

// =========================================================================
// SESIONES DE ESTUDIO (Bucle Activo / Repaso Continuo)
// =========================================================================

// Iniciar una nueva sesión de estudio para un deck
router.post('/decks/:deckId/sessions', reviewController.startSession);

// Cerrar una sesión de estudio activa (al salir del Reproductor Continuo)
router.patch('/sessions/:sessionId/close', reviewController.closeSession);

// Incrementar el contador de lotes completados de una sesión (cuando se recarga la cola de 30)
router.patch('/sessions/:sessionId/batch-completed', reviewController.incrementSessionBatch);

module.exports = router;
