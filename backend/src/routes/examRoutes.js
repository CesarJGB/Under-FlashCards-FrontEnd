const express = require('express');
const examController = require('../controllers/examController');

const router = express.Router();

// The user-scoped list route is intentionally distinct from /exams/:id.
router.get('/exams/user/:userId', examController.listExams);

router.post('/exams/generate-questions-ai', examController.generateQuestionsAi);
router.post('/exams', examController.createExam);

router.get('/exams/:id/questions', examController.listQuestions);
router.post('/exams/:id/questions/bulk', examController.createQuestionsBulk);
router.post('/exams/:id/questions', examController.createQuestion);
router.put('/exams/:id/questions/:questionId', examController.updateQuestion);
router.patch('/exams/:id/questions/:questionId', examController.updateQuestion);
router.delete('/exams/:id/questions/:questionId', examController.deleteQuestion);

router.post('/exams/:id/generate-from-decks', examController.generateFromDecks);
router.post('/exams/:id/attempts', examController.createAttempt);

router.get('/exams/:id', examController.getExam);
router.put('/exams/:id', examController.updateExam);
router.patch('/exams/:id', examController.updateExam);
router.delete('/exams/:id', examController.deleteExam);

module.exports = router;
