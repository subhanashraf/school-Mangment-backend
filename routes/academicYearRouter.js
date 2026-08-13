const express = require('express');
const router = express.Router();
const academicYearController = require('../controllers/academicYearController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/academic-years', authenticate, authorize('admin'), academicYearController.createOrUpdateAcademicYear);
router.get('/academic-years', authenticate, academicYearController.getAcademicYears);
router.delete('/academic-years/:yearId', authenticate, authorize('admin'), academicYearController.deleteAcademicYear);

module.exports = router;