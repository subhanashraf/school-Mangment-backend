const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/auth');

// Get All Teachers
router.get('/', authenticate, authorize('admin'), teacherController.getAllTeachers);

// Get Teacher by ID
router.get('/:id', authenticate, authorize('admin'), teacherController.getTeacherById);

// Create Teacher
router.post('/', authenticate, authorize('admin'), teacherController.createTeacher);

// Update Teacher
router.put('/:id', authenticate, authorize('admin'), teacherController.updateTeacher);

// Delete Teacher
router.delete('/:id', authenticate, authorize('admin'), teacherController.deleteTeacher);

// Assign Subject
router.post('/:id/assign-subject', authenticate, authorize('admin'), teacherController.assignSubject);

// Assign Class
router.post('/:id/assign-class', authenticate, authorize('admin'), teacherController.assignClass);

// Make Class Teacher
router.post('/:id/make-class-teacher', authenticate, authorize('admin'), teacherController.makeClassTeacher);

module.exports = router;
