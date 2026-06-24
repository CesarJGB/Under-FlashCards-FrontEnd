const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/auth/google', authController.googleAuth);
router.get('/user/:userId', authController.getUser);
router.put('/user/settings', authController.updateSettings);
router.get('/user/:userId/balance', authController.getAiBalance);

module.exports = router;
