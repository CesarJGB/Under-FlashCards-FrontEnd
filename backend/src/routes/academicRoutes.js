// FILE: backend/src/routes/academicRoutes.js

const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');

// --- Endpoints de Materias ---
router.get('/academic/materias/:userId', academicController.getMaterias);
router.post('/academic/materias', academicController.createMateria);
router.put('/academic/materias/:id', academicController.updateMateria);
router.delete('/academic/materias/:id', academicController.deleteMateria);

// --- Endpoints de Temas ---
router.get('/academic/temas/:materiaId', academicController.getTemas);
router.post('/academic/temas', academicController.createTema);
router.put('/academic/temas/:id', academicController.updateTema);
router.delete('/academic/temas/:id', academicController.deleteTema);

// --- Endpoints de Subtemas ---
router.get('/academic/subtemas/:temaId', academicController.getSubtemas);
router.post('/academic/subtemas', academicController.createSubtema);
router.put('/academic/subtemas/:id', academicController.updateSubtema);
router.delete('/academic/subtemas/:id', academicController.deleteSubtema);

// --- Endpoints de Parciales Activos ---
router.patch('/academic/materias/:id/active-parciales', academicController.updateActiveParciales);
router.get('/academic/materias/:id/domain-preview', academicController.getDomainPreview);

module.exports = router;

