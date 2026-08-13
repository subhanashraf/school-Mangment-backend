const express = require('express');
const router = express.Router();
const homeworkController = require('../controllers/homeworkController');
const { authenticate, authorize } = require('../middleware/auth');

// Create Homework
router.post('/', authenticate, authorize('teacher'), homeworkController.createHomework);

// Get All Homework
router.get('/', authenticate, authorize('admin', 'teacher'), homeworkController.getAllHomework);

// Get Homework for Student
router.get('/student', authenticate, authorize('student'), homeworkController.getHomeworkForStudent);

// Submit Homework
router.post('/:id/submit', authenticate, authorize('student'), homeworkController.submitHomework);

// Grade Homework
router.post('/:id/grade', authenticate, authorize('teacher'), homeworkController.gradeHomework);

// Update Homework
router.put('/:id', authenticate, authorize('teacher'), homeworkController.updateHomework);

// Delete Homework
router.delete('/:id', authenticate, authorize('teacher'), homeworkController.deleteHomework);

module.exports = router;
