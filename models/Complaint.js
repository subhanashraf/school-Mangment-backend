const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'raisedByModel',
      required: true,
    },
    raisedByModel: {
      type: String,
      required: true,
      enum: ['User', 'Teacher', 'Student'],
      default: 'Student',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['Academic', 'Behavioral', 'Facilities', 'Other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Resolved'],
      default: 'Pending',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'assignedToModel',
    },
    assignedToModel: {
      type: String,
      enum: ['User', 'Teacher'],
      default: 'User',
    },
    resolution: String,
    resolvedDate: Date,
    attachments: [String],
    comments: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'comments.userModel',
        },
        userModel: {
          type: String,
          enum: ['User', 'Teacher', 'Student'],
          default: 'Student',
        },
        comment: String,
        createdAt: Date,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);
