// FILE: backend/src/routes/academicRoutes.js

const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');

// --- Endpoints de Materias ---
router.get('/academic/materias/:userId', academicController.getMaterias);
router.post('/academic/materias', academicController.createMateria);
router.delete('/academic/materias/:id', academicController.deleteMateria);

// --- Endpoints de Temas ---
router.get('/academic/temas/:materiaId', academicController.getTemas);
router.post('/academic/temas', academicController.createTema);
router.delete('/academic/temas/:id', academicController.deleteTema);

// --- Endpoints de Subtemas ---
router.get('/academic/subtemas/:temaId', academicController.getSubtemas);
router.post('/academic/subtemas', academicController.createSubtema);
router.delete('/academic/subtemas/:id', academicController.deleteSubtema);

module.exports = router;
