const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, authorize, verifySchoolAccess } = require('../middleware/auth');

// Get All Students
router.get('/', authenticate, authorize('admin', 'teacher'), studentController.getAllStudents);

// Get Student by ID
router.get('/:id', authenticate, studentController.getStudentById);

// Create Student
router.post('/', authenticate, authorize('admin'), studentController.createStudent);

// Update Student
router.put('/:id', authenticate, authorize('admin', 'teacher'), studentController.updateStudent);

// Delete Student
router.delete('/:id', authenticate, authorize('admin'), studentController.deleteStudent);

// Promote Student
router.post('/:id/promote', authenticate, authorize('admin'), studentController.promoteStudent);

// Get Student Attendance
router.get('/:id/attendance', authenticate, studentController.getStudentAttendance);

// Bulk Import Students
router.post('/bulk/import', authenticate, authorize('admin'), studentController.bulkImportStudents);

module.exports = router;
