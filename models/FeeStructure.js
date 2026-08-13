const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema(
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
    totalAmount: {
      type: Number,
      required: [true, 'Total Fee Amount is required'],
    },
    totalInstallments: {
      type: Number,
      default: 12,
    },
 
    academicYearId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'AcademicYear',
          required: true,
        },  

  },
  { timestamps: true }
);

feeStructureSchema.index({ schoolId: 1, standard: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
