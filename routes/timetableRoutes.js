const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { authenticate, authorize } = require('../middleware/auth');

// Get Timetable Config
router.get('/config', authenticate, timetableController.getConfig);

// Save Timetable Config
router.post('/config', authenticate, authorize('admin'), timetableController.saveConfig);

// Generate Timetable (One-Click)
router.post('/generate', authenticate, authorize('admin'), timetableController.generateTimetable);

// Get All Timetables
router.get('/', authenticate, timetableController.getAllTimetables);

// Get Timetable by Class
router.get('/class/:classId', authenticate, timetableController.getTimetable);

module.exports = router;
