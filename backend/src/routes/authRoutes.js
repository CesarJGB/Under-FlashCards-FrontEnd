const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/auth/google', authController.googleAuth);
router.post('/auth/redeem-invite', authController.redeemInvite);
router.post('/admin/invite-codes', authController.protect, authController.requireAdmin, authController.generateInviteCode);
router.get('/admin/invite-codes', authController.protect, authController.requireAdmin, authController.listInviteCodes);
router.patch('/admin/invite-codes/:id/revoke', authController.protect, authController.requireAdmin, authController.revokeInviteCode);
router.patch('/admin/invite-codes/:id/reactivate', authController.protect, authController.requireAdmin, authController.reactivateInviteCode);
router.get('/user/:userId', authController.getUser);
router.put('/user/settings', authController.updateSettings);
router.get('/user/:userId/balance', authController.getAiBalance);

module.exports = router;
