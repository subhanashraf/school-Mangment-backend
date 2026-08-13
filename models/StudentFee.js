const mongoose = require('mongoose');

const monthPaymentSchema = new mongoose.Schema(
  {
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    paidDate: {
      type: Date,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'cheque', 'online', 'other'],
    },
    transactionId: {
      type: String,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    remarks: {
      type: String,
    },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'waived'],
      default: 'unpaid',
    },
  },
  { _id: false }
);

const studentFeeSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      unique: true, // One document per student only
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    // All months for all years in one nested object
    months: {
      type: Map,
      of: monthPaymentSchema,
      default: {},
    },
  },
  { timestamps: true }
);

// ─── Static: Pay fee for a specific month ───
studentFeeSchema.statics.payFee = async function (data) {
  const { studentId, month, academicYearId, amountPaid, ...paymentDetails } = data;

  const Student = mongoose.model('Student');
  const student = await Student.findById(studentId);

  const feeRecord = await this.findOne({ studentId });
  if (!feeRecord) {
    throw new Error('Fee record not found for this student');
  }

  const monthKey = month.toString();
  const monthData = feeRecord.months.get(monthKey) || {};

  // Update payment
  const newAmountPaid = (monthData.amountPaid || 0) + amountPaid;
  const monthlyFee = student.currentFee;

  const updatedMonthData = {
    academicYearId,
    amountPaid: newAmountPaid,
    paidDate: new Date(),
    status: newAmountPaid >= monthlyFee ? 'paid' : (newAmountPaid > 0 ? 'partial' : 'unpaid'),
    ...paymentDetails,
  };

  feeRecord.months.set(monthKey, updatedMonthData);

  return feeRecord.save();
};

// ─── Static: Get fee status for a student ───
studentFeeSchema.statics.getFeeStatus = async function (studentId) {
  const Student = mongoose.model('Student');
  const student = await Student.findById(studentId);

  const feeRecord = await this.findOne({ studentId });
  if (!feeRecord) {
    throw new Error('Fee record not found');
  }

  const result = {
    studentId,
    monthlyFee: student.currentFee,
    months: {},
    totalPaid: 0,
    totalDue: 0,
    totalMonthsPaid: 0,
    totalMonthsUnpaid: 0,
  };

  feeRecord.months.forEach((data, month) => {
    const monthlyFee = student.currentFee;
    const due = Math.max(0, monthlyFee - (data.amountPaid || 0));

    result.months[month] = {
      ...data.toObject(),
      feeAmount: monthlyFee,
      amountDue: due,
    };

    result.totalPaid += data.amountPaid || 0;
    result.totalDue += due;

    if (data.status === 'paid') result.totalMonthsPaid++;
    else result.totalMonthsUnpaid++;
  });

  return result;
};

// ─── Static: Get months by academic year ───
studentFeeSchema.statics.getMonthsByYear = async function (studentId, academicYearId) {
  const feeRecord = await this.findOne({ studentId });
  if (!feeRecord) return null;

  const yearMonths = {};
  feeRecord.months.forEach((data, month) => {
    if (data.academicYearId.toString() === academicYearId.toString()) {
      yearMonths[month] = data;
    }
  });

  return yearMonths;
};

module.exports = mongoose.model('StudentFee', studentFeeSchema);