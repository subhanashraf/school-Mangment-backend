const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Student = require('../models/Student');
const Class = require('../models/Class');

// Get Fee Structures
exports.getFeeStructures = async (req, res) => {
  try {
    const structures = await FeeStructure.find({ schoolId: req.user.schoolId }).sort({ createdAt: -1 });
    res.json({ structures });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Set Fee Structure
exports.setFeeStructure = async (req, res) => {
  try {
    const { standard, totalAmount, totalMonths = 12, totalInstallments = 4, academicYear = '', startMonth, endMonth } = req.body;
    const qAmount = Math.round((totalAmount / totalInstallments) * 100) / 100;

    let structure = await FeeStructure.findOne({ schoolId: req.user.schoolId, standard });
    if (structure) {
      structure.totalAmount = totalAmount;
      structure.totalMonths = totalMonths;
      structure.totalInstallments = totalInstallments;
      structure.academicYear = academicYear;
      structure.startMonth = startMonth;
      structure.endMonth = endMonth;
      structure.q1Amount = qAmount;
      structure.q2Amount = qAmount;
      structure.q3Amount = qAmount;
      structure.q4Amount = qAmount;
      await structure.save();
    } else {
      structure = await FeeStructure.create({
        schoolId: req.user.schoolId,
        standard,
        totalAmount,
        totalMonths,
        totalInstallments,
        academicYear,
        startMonth,
        endMonth,
        q1Amount: qAmount,
        q2Amount: qAmount,
        q3Amount: qAmount,
        q4Amount: qAmount
      });
    }

    // Auto-create fee record trackers for existing students in this standard
    const mappedClasses = await Class.find({ schoolId: req.user.schoolId, standard });
    const classIds = mappedClasses.map(c => c._id);
    
    if (classIds.length > 0) {
      const students = await Student.find({ schoolId: req.user.schoolId, classId: { $in: classIds } });
      for (const s of students) {
        const existing = await StudentFee.findOne({ schoolId: req.user.schoolId, studentId: s._id });
        if (!existing) {
          await StudentFee.create({
            schoolId: req.user.schoolId,
            studentId: s._id,
            classId: s.classId
          });
        }
      }
    }

    res.status(200).json({ message: 'Fee structure configured successfully', structure });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Fee Structure
exports.deleteFeeStructure = async (req, res) => {
  try {
    const { standard } = req.params;
    await FeeStructure.findOneAndDelete({ schoolId: req.user.schoolId, standard });

    const mappedClasses = await Class.find({ schoolId: req.user.schoolId, standard });
    const classIds = mappedClasses.map(c => c._id);
    if (classIds.length > 0) {
      await StudentFee.deleteMany({ schoolId: req.user.schoolId, classId: { $in: classIds } });
    }

    res.json({ message: 'Fee structure deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Student Fees by Standard
exports.getStudentFeesByStandard = async (req, res) => {
  try {
    const { standard } = req.params;
    const mappedClasses = await Class.find({ schoolId: req.user.schoolId, standard });
    const classIds = mappedClasses.map(c => c._id);

    const fees = await StudentFee.find({ schoolId: req.user.schoolId, classId: { $in: classIds } })
      .populate('studentId', 'name email rollNumber')
      .populate('classId', 'standard division');

    res.json({ fees });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle Quarter/Installment Payment Status
exports.toggleQuarterPaymentStatus = async (req, res) => {
  try {
    const { studentFeeId } = req.params;
    const { quarter } = req.body; // can be 'q1', 'q2', 'q3', 'q4' OR a number like 1, 2, 3...

    const fee = await StudentFee.findOne({ _id: studentFeeId, schoolId: req.user.schoolId });
    if (!fee) {
      return res.status(404).json({ message: 'Student fee record not found' });
    }

    let instNum = parseInt(quarter);
    if (isNaN(instNum)) {
      const match = quarter.match(/\d+/);
      if (match) instNum = parseInt(match[0]);
    }

    if (!isNaN(instNum)) {
      if (!fee.paidInstallments) fee.paidInstallments = [];
      if (!fee.paidDates) fee.paidDates = new Map();

      const instIndex = fee.paidInstallments.indexOf(instNum);
      if (instIndex > -1) {
        fee.paidInstallments.splice(instIndex, 1);
        if (fee.paidDates instanceof Map) {
          fee.paidDates.delete(instNum.toString());
        } else {
          delete fee.paidDates[instNum.toString()];
        }
        if (instNum <= 4) {
          fee[`q${instNum}Status`] = 'Pending';
          fee[`q${instNum}PaidDate`] = null;
        }
      } else {
        fee.paidInstallments.push(instNum);
        if (fee.paidDates instanceof Map) {
          fee.paidDates.set(instNum.toString(), new Date());
        } else {
          fee.paidDates = { ...fee.paidDates, [instNum.toString()]: new Date() };
        }
        if (instNum <= 4) {
          fee[`q${instNum}Status`] = 'Paid';
          fee[`q${instNum}PaidDate`] = new Date();
        }
      }
      fee.markModified('paidInstallments');
      fee.markModified('paidDates');
    } else {
      const statusField = `${quarter.toLowerCase()}Status`;
      const dateField = `${quarter.toLowerCase()}PaidDate`;
      const currentStatus = fee[statusField];
      if (currentStatus === 'Paid') {
        fee[statusField] = 'Pending';
        fee[dateField] = null;
      } else {
        fee[statusField] = 'Paid';
        fee[dateField] = new Date();
      }
    }

    await fee.save();
    
    const updatedFee = await StudentFee.findById(fee._id)
      .populate('studentId', 'name email rollNumber')
      .populate('classId', 'standard division');

    res.json({ message: 'Payment status updated successfully', fee: updatedFee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get logged-in student's fee record and standard structure
exports.getStudentOwnFee = async (req, res) => {
  try {
    const fee = await StudentFee.findOne({ studentId: req.user.userId, schoolId: req.user.schoolId })
      .populate('classId', 'standard division');
    
    if (!fee) {
      const Student = require('../models/Student');
      const Class = require('../models/Class');
      const student = await Student.findById(req.user.userId);
      if (student && student.classId) {
        const cls = await Class.findById(student.classId);
        if (cls) {
          const structure = await FeeStructure.findOne({ schoolId: req.user.schoolId, standard: cls.standard });
          if (structure) {
            const newFee = await StudentFee.create({
              schoolId: req.user.schoolId,
              studentId: student._id,
              classId: student.classId
            });
            const populated = await StudentFee.findById(newFee._id).populate('classId', 'standard division');
            return res.json({ fee: populated, structure });
          }
        }
      }
      return res.status(404).json({ message: 'No fee record found. Please verify that a Class and Fee Structure are configured for you.' });
    }

    const structure = await FeeStructure.findOne({ schoolId: req.user.schoolId, standard: fee.classId?.standard });
    res.json({ fee, structure });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Pay student quarter fee
exports.payQuarterFee = async (req, res) => {
  try {
    const { quarter } = req.body;
    const studentFee = await StudentFee.findOne({ studentId: req.user.userId, schoolId: req.user.schoolId })
      .populate('classId', 'standard division');
    if (!studentFee) {
      return res.status(404).json({ message: 'Student fee tracker record not found' });
    }

    let instNum = parseInt(quarter);
    if (isNaN(instNum)) {
      const match = quarter.match(/\d+/);
      if (match) instNum = parseInt(match[0]);
    }

    if (!isNaN(instNum)) {
      if (!studentFee.paidInstallments) studentFee.paidInstallments = [];
      if (!studentFee.paidDates) studentFee.paidDates = new Map();

      if (!studentFee.paidInstallments.includes(instNum)) {
        studentFee.paidInstallments.push(instNum);
        if (studentFee.paidDates instanceof Map) {
          studentFee.paidDates.set(instNum.toString(), new Date());
        } else {
          studentFee.paidDates = { ...studentFee.paidDates, [instNum.toString()]: new Date() };
        }
      }
      if (instNum <= 4) {
        studentFee[`q${instNum}Status`] = 'Paid';
        studentFee[`q${instNum}PaidDate`] = new Date();
      }
      studentFee.markModified('paidInstallments');
      studentFee.markModified('paidDates');
    } else {
      const statusField = `${quarter.toLowerCase()}Status`;
      const dateField = `${quarter.toLowerCase()}PaidDate`;
      studentFee[statusField] = 'Paid';
      studentFee[dateField] = new Date();
    }

    await studentFee.save();
    
    const structure = await FeeStructure.findOne({ schoolId: req.user.schoolId, standard: studentFee.classId?.standard });
    res.json({ message: `Payment successful`, fee: studentFee, structure });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Pay student full fee
exports.payFullFee = async (req, res) => {
  try {
    const studentFee = await StudentFee.findOne({ studentId: req.user.userId, schoolId: req.user.schoolId })
      .populate('classId', 'standard division');
    if (!studentFee) {
      return res.status(404).json({ message: 'Student fee tracker record not found' });
    }

    const structure = await FeeStructure.findOne({ schoolId: req.user.schoolId, standard: studentFee.classId?.standard });
    const totalInst = structure?.totalInstallments || 4;

    if (!studentFee.paidInstallments) studentFee.paidInstallments = [];
    if (!studentFee.paidDates) studentFee.paidDates = new Map();

    for (let i = 1; i <= totalInst; i++) {
      if (!studentFee.paidInstallments.includes(i)) {
        studentFee.paidInstallments.push(i);
        if (studentFee.paidDates instanceof Map) {
          studentFee.paidDates.set(i.toString(), new Date());
        } else {
          studentFee.paidDates = { ...studentFee.paidDates, [i.toString()]: new Date() };
        }
      }
      if (i <= 4) {
        studentFee[`q${i}Status`] = 'Paid';
        studentFee[`q${i}PaidDate`] = new Date();
      }
    }

    studentFee.markModified('paidInstallments');
    studentFee.markModified('paidDates');

    await studentFee.save();
    res.json({ message: 'Full fees payment successful', fee: studentFee, structure });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
