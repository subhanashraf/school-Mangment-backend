const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
   
    category: {
      type: String,
      enum: ['General', 'Event', 'Achievement', 'Exam', 'Result'],
      default: 'General',
    },
    content: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'createdByModel',
      required: true,
    },
    createdByModel: {
      type: String,
      required: true,
      enum: ['User', 'Teacher'],
      default: 'User',
    },
    attachments: [String],
    targetAudience: {
      type: String,
      enum: ['All', 'Students', 'Teachers', 'Class Specific', 'Individual'],
      required: true,
    },
    targetClassId: mongoose.Schema.Types.ObjectId,
    targetUserId: mongoose.Schema.Types.ObjectId,
    isPinned: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    viewedBy: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        viewedDate: Date,
      },
    ],
    expiresAt: {
      type: Date,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notice', noticeSchema);
