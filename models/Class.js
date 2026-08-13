const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    standard: {
      type: String,
      required: [true, 'Standard is required'],
    }, 
    division: {
      type: String,
      required: true,
    },
    classTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    capacity: {
      type: Number,
      default: 40,
    },
    studentCount: {
      type: Number,
      default: 0,
    },
    room: String,
    academicYear: String,
  },
  { timestamps: true }
);

classSchema.index({ schoolId: 1, standard: 1, division: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
