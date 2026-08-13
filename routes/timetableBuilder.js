// routes/timetableBuilder.js
const express = require('express');
const router = express.Router();
const builder = require('../controllers/timetableBuilderController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/init/:classId', authenticate, authorize('admin'), builder.getBuilderData);
router.post('/validate', authenticate, authorize('admin'), builder.validateSlot);
router.post('/save/:classId', authenticate, authorize('admin'), builder.saveClassTimetable);
router.get('/teacher-schedule/:teacherId', authenticate, builder.getTeacherSchedule);

module.exports = router;