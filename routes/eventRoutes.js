const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate, authorize } = require('../middleware/auth');

// Create Event
router.post('/', authenticate, authorize('admin'), eventController.createEvent);

// Get All Events
router.get('/', authenticate, eventController.getAllEvents);

// Get Calendar Events
router.get('/calendar', authenticate, eventController.getCalendarEvents);

// Get Event by ID
router.get('/:id', authenticate, eventController.getEventById);

// Update Event
router.put('/:id', authenticate, authorize('admin'), eventController.updateEvent);

// Delete Event
router.delete('/:id', authenticate, authorize('admin'), eventController.deleteEvent);

module.exports = router;
