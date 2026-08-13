const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'senderModel',
      required: true,
    },
    senderModel: {
      type: String,
      required: true,
      enum: ['User', 'Teacher', 'Student'],
      default: 'User',
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'recipientModel',
      required: true,
    },
    recipientModel: {
      type: String,
      required: true,
      enum: ['User', 'Teacher', 'Student'],
      default: 'User',
    },
    subject: String,
    message: {
      type: String,
      required: true,
    },
    attachments: [String],
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
  },
  { timestamps: true }
);

messageSchema.index({ schoolId: 1, senderId: 1, recipientId: 1 });

module.exports = mongoose.model('Message', messageSchema);
