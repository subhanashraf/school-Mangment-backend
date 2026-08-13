const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema(
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
    academicYearId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'AcademicYear',
          required: true,
        },  
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: true,
    },
    slots: [
      {
        startTime: String, // HH:MM format
        endTime: String,
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Subject',
        },
        teacherId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Teacher',
        },
        isBreak: {
          type: Boolean,
          default: false,
        },
        breakName: {
          type: String,
          default: '',
        },
        room: String,
      },
    ],
    academicYear: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

timetableSchema.index({ schoolId: 1, classId: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', timetableSchema);
