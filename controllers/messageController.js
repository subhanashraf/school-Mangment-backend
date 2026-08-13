const Message = require('../models/Message');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');

// Send Message
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, subject, message, attachments } = req.body;

    const senderRole = req.user.role;
    const senderModel = senderRole === 'admin' ? 'User' : (senderRole === 'teacher' ? 'Teacher' : 'Student');

    let recipientModel = 'Student';
    const isUser = await User.exists({ _id: recipientId });
    if (isUser) {
      recipientModel = 'User';
    } else {
      const isTeacher = await Teacher.exists({ _id: recipientId });
      if (isTeacher) {
        recipientModel = 'Teacher';
      }
    }

    const newMessage = await Message.create({
      schoolId: req.user.schoolId,
      senderId: req.user.userId,
      senderModel,
      recipientId,
      recipientModel,
      subject,
      message,
      attachments,
    });

    await newMessage.populate('senderId', 'name email');
    await newMessage.populate('recipientId', 'name email');

    res.status(201).json({
      message: 'Message sent successfully',
      message: newMessage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Inbox Messages
exports.getInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, isRead } = req.query;
    let query = {
      recipientId: req.user.userId,
      schoolId: req.user.schoolId,
    };

    if (isRead !== undefined) query.isRead = isRead === 'true';

    const messages = await Message.find(query)
      .populate('senderId', 'name email avatar')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Message.countDocuments(query);

    res.json({
      messages,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Sent Messages
exports.getSent = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const messages = await Message.find({
      senderId: req.user.userId,
      schoolId: req.user.schoolId,
    })
      .populate('recipientId', 'name email avatar')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Message.countDocuments({
      senderId: req.user.userId,
    });

    res.json({
      messages,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Conversation
exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({
      schoolId: req.user.schoolId,
      $or: [
        { senderId: req.user.userId, recipientId: userId },
        { senderId: userId, recipientId: req.user.userId },
      ],
    })
      .populate('senderId', 'name email avatar')
      .populate('recipientId', 'name email avatar')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark Message as Read
exports.markAsRead = async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.id,
        recipientId: req.user.userId,
        schoolId: req.user.schoolId,
      },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    res.json({
      message: 'Message marked as read',
      message: message,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Message
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.user.schoolId,
      $or: [
        { senderId: req.user.userId },
        { recipientId: req.user.userId },
      ],
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Unread Count
exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      recipientId: req.user.userId,
      isRead: false,
      schoolId: req.user.schoolId,
    });

    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
