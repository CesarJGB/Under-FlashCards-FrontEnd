const express = require('express');
const examFolderController = require('../controllers/examFolderController');

const router = express.Router();

router.get('/exam-folders/:userId', examFolderController.getExamFolders);
router.post('/exam-folders', examFolderController.createExamFolder);
router.put('/exam-folders/:id', examFolderController.updateExamFolder);

module.exports = router;
