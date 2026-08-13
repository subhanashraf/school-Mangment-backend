const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },  
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    periodStartTime: {
      type: String, // HH:MM
      default: null,
    },
    periodEndTime: {
      type: String, // HH:MM
      default: null,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Leave', 'Late'],
      required: true,
    },
    remarks: String,
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'markedByModel',
    },
    markedByModel: {
      type: String,
      enum: ['User', 'Teacher'],
      default: 'Teacher',
    },
  },
  { timestamps: true }
);

// One record per student per subject per day
attendanceSchema.index({ schoolId: 1, userId: 1, date: 1, subjectId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
