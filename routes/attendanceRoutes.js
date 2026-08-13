const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

// ─── Teacher: Timetable-aware period routes ────────────────────
// GET today's periods for logged-in teacher
router.get('/teacher/active-periods', authenticate, authorize('teacher'), attendanceController.getTeacherActivePeriods);
// GET student list for a specific period
router.get('/teacher/period-students', authenticate, authorize('teacher', 'admin'), attendanceController.getPeriodStudents);
// POST mark period attendance (time-window enforced server-side)
router.post('/teacher/mark-period', authenticate, authorize('teacher'), attendanceController.markPeriodAttendance);

// ─── Student: Own attendance ────────────────────────────────────
router.get('/student/my', authenticate, authorize('student'), attendanceController.getMyAttendance);

// ─── Admin: Student full profile (att + fees + marks) ──────────
router.get('/admin/student/:studentId', authenticate, authorize('admin'), attendanceController.getAdminStudentProfile);
// PUT admin override any attendance record
router.put('/admin/update/:attendanceId', authenticate, authorize('admin'), attendanceController.adminUpdateAttendance);
// POST admin create/upsert attendance
router.post('/admin/create', authenticate, authorize('admin'), attendanceController.adminCreateAttendance);

// ─── Legacy routes (kept for compatibility) ─────────────────────
router.post('/mark', authenticate, authorize('teacher', 'admin'), attendanceController.markAttendance);
router.post('/mark-class', authenticate, authorize('teacher', 'admin'), attendanceController.markClassAttendance);
router.get('/user/:userId', authenticate, attendanceController.getUserAttendance);
router.get('/class/report', authenticate, authorize('admin', 'teacher'), attendanceController.getClassAttendanceReport);

module.exports = router;
