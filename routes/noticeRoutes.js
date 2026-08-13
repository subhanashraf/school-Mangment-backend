const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const { authenticate, authorize } = require('../middleware/auth');

// Create Notice
router.post('/', authenticate, authorize('admin', 'teacher'), noticeController.createNotice);

// Get All Notices
router.get('/', authenticate, authorize('admin'), noticeController.getAllNotices);

// Get Notices for User
router.get('/user/notices', authenticate, noticeController.getNoticesForUser);

// Update Notice
router.put('/:id', authenticate, authorize('admin'), noticeController.updateNotice);

// Delete Notice
router.delete('/:id', authenticate, authorize('admin'), noticeController.deleteNotice);

// Mark as Read
router.post('/:id/read', authenticate, noticeController.markNoticeAsRead);

module.exports = router;
