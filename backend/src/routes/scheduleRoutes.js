// backend/src/routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { protect } = require('../controllers/authController');

// --- Endpoints de Horarios ---
router.get('/schedules/:userId', protect, scheduleController.getSchedules);
router.post('/schedules', protect, scheduleController.createSchedule);
router.put('/schedules/:id', protect, scheduleController.updateSchedule);
router.delete('/schedules/:id', protect, scheduleController.deleteSchedule);

// --- Endpoints de Clases (dentro de un horario) ---
router.post('/schedules/:id/classes', protect, scheduleController.addClass);
router.put('/schedules/:id/classes/:classId', protect, scheduleController.updateClass);
router.delete('/schedules/:id/classes/:classId', protect, scheduleController.deleteClass);

module.exports = router;
