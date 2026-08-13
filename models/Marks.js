const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
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
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    
    // All student marks in ONE document
    studentMarks: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Student',
          required: true,
        },
        marks: {
          type: Number,
          required: true,
          min: 0,
        },
        percentage: Number,
        passStatus: {
          type: String,
          enum: ['Pass', 'Fail'],
        },
        remarks: String,
        _id: false,
      },
    ],
    
    totalMarks: {
      type: Number,
      default: 100,
    },
    passingMarks: {
      type: Number,
      default: 35,
    },
    
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'enteredByModel',
    },
    enteredByModel: {
      type: String,
      enum: ['User', 'Teacher'],
      default: 'Teacher',
    },
  },
  { timestamps: true }
);

marksSchema.index(
  { schoolId: 1, examId: 1, classId: 1, subjectId: 1, academicYearId: 1 },
  { unique: true }
);

module.exports = mongoose.model('Marks', marksSchema);