const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Subject name is required'],
    },
    code: {
      type: String,
      required: true,
    },
    description: String,
   
    standard: {
      type: String,
    },
    // Lectures needed per standard (can differ per class)
    lecturesPerStandard: [
      {
        standard: { type: String, required: true },
        weeklyLectures: { type: Number, default: 5 },
        lectureDuration: { type: String, default: '60', enum: ['30', '45', '60'] },
        totalPortionLectures: { type: Number, default: 40 },
        weightage: { type: Number, default: 1 },
         maxMarks: {
      type: Number,
      default: 100,
    },
    minMarks: {
      type: Number,
      default: 35,
    },
      }
    ],
    // Overall default weekly lectures if no per-standard entry
    defaultWeeklyLectures: {
      type: Number,
      default: 5,
    },
    // Subject weight for timetable priority (higher = more spread out)
    weightage: {
      type: Number,
      default: 1,
    },
    assignedTeachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
      },
    ],
  },
  { timestamps: true }
);

subjectSchema.index({ schoolId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);
