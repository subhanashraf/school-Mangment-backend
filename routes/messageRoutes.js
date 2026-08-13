const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

// Send Message
router.post('/', authenticate, messageController.sendMessage);

// Get Inbox
router.get('/inbox', authenticate, messageController.getInbox);

// Get Sent Messages
router.get('/sent', authenticate, messageController.getSent);

// Get Conversation
router.get('/conversation/:userId', authenticate, messageController.getConversation);

// Mark as Read
router.post('/:id/read', authenticate, messageController.markAsRead);

// Delete Message
router.delete('/:id', authenticate, messageController.deleteMessage);

// Get Unread Count
router.get('/unread-count', authenticate, messageController.getUnreadCount);

module.exports = router;
