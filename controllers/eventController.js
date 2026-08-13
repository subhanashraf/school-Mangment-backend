const Event = require('../models/Event');

// Create Event
exports.createEvent = async (req, res) => {
  try {
    const { name, description, eventType, startDate, endDate, location, isHoliday } = req.body;

    const event = await Event.create({
      schoolId: req.user.schoolId,
      name,
      description,
      eventType,
      startDate,
      endDate,
      location,
      isHoliday,
      createdBy: req.user.userId,
      createdByModel: req.user.role === 'teacher' ? 'Teacher' : 'User',
    });

    res.status(201).json({
      message: 'Event created successfully',
      event,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Events
exports.getAllEvents = async (req, res) => {
  try {
    const { eventType, page = 1, limit = 10, upcoming = false } = req.query;
    let query = { schoolId: req.user.schoolId };

    if (eventType) query.eventType = eventType;
    if (upcoming === 'true') query.startDate = { $gte: new Date() };

    const events = await Event.find(query)
      .populate('createdBy', 'name')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ startDate: 1 });

    const total = await Event.countDocuments(query);

    res.json({
      events,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Event by ID
exports.getEventById = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    })
      .populate('createdBy', 'name email');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Event
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({
      message: 'Event updated successfully',
      event,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Event
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Calendar Events
exports.getCalendarEvents = async (req, res) => {
  try {
    const { month, year } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const events = await Event.find({
      schoolId: req.user.schoolId,
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    }).sort({ startDate: 1 });

    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
