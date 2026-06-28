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

// Esperar a que la cascada de métricas pendiente de un usuario termine de procesarse.
// Se usa antes de cerrar una sesión, para garantizar que el resumen mostrado al usuario
// y el mastery que verá después en el deck queden 100% sincronizados.
router.get('/users/:userId/queue-status', reviewController.waitForUserQueue);

module.exports = router;
