const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    // CHANGED: classId → classIds (array)
    classIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    }],
    date: {
      type: Date,
      required: true,
    },
    academicYearId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'AcademicYear',
          required: true,
        },  
    startTime: String,
    endTime: String,
    duration: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exam', examSchema);