// FILE: backend/src/routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

// --- Endpoints de Horarios ---
// Obtenemos un horario específico por su ID (debe ir antes que :userId para evitar colisiones)
router.get('/schedules/by-id/:id', scheduleController.getScheduleById);

router.get('/schedules/:userId', scheduleController.getSchedules);
router.post('/schedules', scheduleController.createSchedule);
router.put('/schedules/:id', scheduleController.updateSchedule);
router.delete('/schedules/:id', scheduleController.deleteSchedule);

// --- Endpoints de Clases (dentro de un horario) ---
router.post('/schedules/:id/classes', scheduleController.addClass);
router.put('/schedules/:id/classes/:classId', scheduleController.updateClass);
router.delete('/schedules/:id/classes/:classId', scheduleController.deleteClass);

module.exports = router;
