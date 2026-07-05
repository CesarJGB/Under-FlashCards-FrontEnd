// FILE: backend/src/routes/userRoutes.js (agregar estas rutas)
const express = require('express');
const router = express.Router();
const userPreferencesController = require('../controllers/userPreferencesController');

// Rutas existentes...

// Nuevas rutas de preferencias
router.get('/:userId/preferences', userPreferencesController.getUserPreferences);
router.put('/:userId/preferences', userPreferencesController.updateUserPreferences);

module.exports = router;

