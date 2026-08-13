const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { authenticate, authorize } = require('../middleware/auth');

// Get All Subjects
router.get('/', authenticate, subjectController.getAllSubjects);

// Get Subject by ID
router.get('/:id', authenticate, subjectController.getSubjectById);

// Create Subject
router.post('/', authenticate, authorize('admin'), subjectController.createSubject);

// Update Subject
router.put('/:id', authenticate, authorize('admin'), subjectController.updateSubject);

// Delete Subject
router.delete('/:id', authenticate, authorize('admin'), subjectController.deleteSubject);

// Assign Teacher
router.post('/:id/assign-teacher', authenticate, authorize('admin'), subjectController.assignTeacher);

module.exports = router;
