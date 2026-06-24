const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rutas de autenticación y configuración de usuario
router.post('/auth/google', authController.googleAuth);
router.get('/user/:userId', authController.getUser);
router.put('/user/settings', authController.updateSettings);

module.exports = router;
