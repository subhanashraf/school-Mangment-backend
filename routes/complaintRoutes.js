const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { authenticate, authorize } = require('../middleware/auth');

// Create Complaint
router.post('/', authenticate, complaintController.createComplaint);

// Get All Complaints
router.get('/', authenticate, authorize('admin'), complaintController.getAllComplaints);

// Get My Complaints
router.get('/my', authenticate, complaintController.getMyComplaints);

// Assign Complaint
router.post('/:id/assign', authenticate, authorize('admin'), complaintController.assignComplaint);

// Resolve Complaint
router.post('/:id/resolve', authenticate, authorize('admin', 'teacher'), complaintController.resolveComplaint);

// Update Status
router.put('/:id/status', authenticate, authorize('admin'), complaintController.updateComplaintStatus);

// Add Comment
router.post('/:id/comment', authenticate, complaintController.addComment);

module.exports = router;
