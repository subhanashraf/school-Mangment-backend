const mongoose = require('mongoose');

const academicYearSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  year: { 
    type: String, 
    required: true 
  },
  startDate: Date,
  endDate: Date,
  isActive: { 
    type: Boolean, 
    default: false 
  },
}, { timestamps: true });

// Index for school + year uniqueness
academicYearSchema.index({ schoolId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('AcademicYear', academicYearSchema);