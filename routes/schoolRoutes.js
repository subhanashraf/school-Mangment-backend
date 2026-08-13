const express = require('express');
const router = express.Router();
const schoolController = require('../controllers/schoolController');
const { authenticate, authorize } = require('../middleware/auth');

// Create School (Super Admin Only)
router.post('/', schoolController.createSchool);

// Get All Schools
router.get('/', schoolController.getAllSchools);

// Get My School (For Admin)
router.get('/my', authenticate, authorize('admin'), schoolController.getMySchool);

// Get School Statistics
router.get('/stats', authenticate, authorize('admin'), schoolController.getSchoolStats);

// Get School by ID
router.get('/:id', authenticate, authorize('admin'), schoolController.getSchoolById);

// Update School
router.put('/:id', authenticate, authorize('admin'), schoolController.updateSchool);

module.exports = router;
