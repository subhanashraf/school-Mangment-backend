const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

// Admin Dashboard
router.get('/admin', authenticate, authorize('admin'), dashboardController.getAdminStats);

// Teacher Dashboard
router.get('/teacher', authenticate, authorize('teacher'), dashboardController.getTeacherStats);

// Student Dashboard
router.get('/student', authenticate, authorize('student'), dashboardController.getStudentStats);

// Analytics
router.get('/analytics', authenticate, authorize('admin'), dashboardController.getAnalytics);

module.exports = router;
