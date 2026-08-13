const mongoose = require('mongoose');

const homeworkSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    fileUrl: String,
    dueDate: {
      type: Date,
      required: true,
    },
    totalStudents: Number,
    submittedCount: {
      type: Number,
      default: 0,
    },
    submissions: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Student',
        },
        fileUrl: String,
        submittedDate: Date,
        status: {
          type: String,
          enum: ['Submitted', 'Late', 'Not Submitted'],
          default: 'Not Submitted',
        },
        reasonForMissing: {
          type: String,
          default: '',
        },
        marks: Number,
        feedback: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Homework', homeworkSchema);
