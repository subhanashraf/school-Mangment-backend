const express = require('express');
const router = express.Router();
const marksController = require('../controllers/marksController');
const { authenticate, authorize } = require('../middleware/auth');

// Create Exam
router.post('/exams', authenticate, authorize('admin', 'teacher'), marksController.createExam);

// Get All Exams
router.get('/exams', authenticate, marksController.getAllExams);
router.put('/exams/:id', authenticate, authorize('admin', 'teacher'), marksController.updateExam);
router.delete('/exams/:id', authenticate, authorize('admin', 'teacher'), marksController.deleteExam);
// GEt Marks for a specific exam and class and subject
router.get('/exams/:examId/class/:classId/subject/:subjectId', authenticate, marksController.getMarksByClassAndSubject);
// Enter Marks
router.post('/enter', authenticate, authorize('teacher', 'admin'), marksController.enterMarks);

// Bulk Enter Marks
router.post('/bulk', authenticate, authorize('teacher', 'admin'), marksController.bulkEnterMarks);

// Get Student Marks
router.get('/student/:studentId', authenticate, marksController.getStudentMarks);

// Get Exam Result
router.get('/exam/:examId', authenticate, marksController.getExamResult);

// Get Toppers
router.get('/toppers', authenticate, marksController.getToppers);

module.exports = router;
