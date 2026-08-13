const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');

// Get All Students
exports.getAllStudents = async (req, res) => {
  try {
    const { classId, page = 1, limit = 10, search } = req.query;
    const schoolId = req.user.schoolId;

    let query = { schoolId };

    if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const teacher = await Teacher.findById(req.user.userId);
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }

      const assignedClassIds = [];
      if (teacher.classTeacherOf) {
        assignedClassIds.push(teacher.classTeacherOf.toString());
      }
      if (teacher.classIds && teacher.classIds.length > 0) {
        teacher.classIds.forEach(cid => {
          assignedClassIds.push(cid.toString());
        });
      }

      if (classId) {
        if (!assignedClassIds.includes(classId.toString())) {
          return res.status(403).json({ message: 'Access denied. You do not teach this class.' });
        }
        query.classId = classId;
      } else {
        query.classId = { $in: assignedClassIds };
      }
    } else {
      if (classId) query.classId = classId;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const students = await Student.find(query)
      .populate('classId', 'standard division')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ lastName: 1, firstName: 1 });

    const total = await Student.countDocuments(query);

    res.json({
      students,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Student by ID
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('classId')
      .populate('schoolId');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if user has access to this student's school
    if (student.schoolId._id.toString() !== req.user.schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'student' && req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ student });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create Student
exports.createStudent = async (req, res) => {
  try {
    const { name, email, password, phone, rollNumber, registrationNumber, classId, division, ...rest } = req.body;

    // Check if any classes/standards and subjects exist for this school
    const classCount = await Class.countDocuments({ schoolId: req.user.schoolId });
    const Subject = require('../models/Subject');
    const subjectCount = await Subject.countDocuments({ schoolId: req.user.schoolId });
    if (classCount === 0 || subjectCount === 0) {
      return res.status(400).json({ message: 'Student and teacher cannot be added unless and until both class (standards/divisions) and subjects are configured' });
    }

    // Check if student exists
    let student = await Student.findOne({ email, schoolId: req.user.schoolId });
    if (student) {
      return res.status(400).json({ message: 'Student already exists' });
    }

    const { hashPassword, validatePasswordStrength } = require('../utils/password');
    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: 'Password must be at least 6 characters, contain 1 capital letter, 1 number, and 1 special character' });
    }
    const hashedPassword = await hashPassword(password);

    let resolvedClassId = classId;
    let resolvedDivision = division;

    if (req.body.classStandard && req.body.classDivision) {
      const cl = await Class.findOne({
        schoolId: req.user.schoolId,
        standard: String(req.body.classStandard).trim(),
        division: String(req.body.classDivision).trim(),
      });
      if (!cl) {
        const newClass = await Class.create({
          schoolId: req.user.schoolId,
          standard: String(req.body.classStandard).trim(),
          division: String(req.body.classDivision).trim(),
        });
        resolvedClassId = newClass._id;
      } else {
        resolvedClassId = cl._id;
      }
      resolvedDivision = req.body.classDivision;
    }

    const School = require('../models/School');
    const schoolData = await School.findById(req.user.schoolId);
    const schoolCode = schoolData ? schoolData.code : '';
    const schoolName = schoolData ? schoolData.name : '';
    const AcedemicYear = require('../models/AcademicYear');
    const activeYear = await AcedemicYear.findOne({ schoolId: req.user.schoolId, isActive: true });
    if (!activeYear) {
      return res.status(400).json({ message: 'No active academic year found. Please set an active academic year before adding students.' });
    }

    student = await Student.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'student',
      schoolId: req.user.schoolId,
      schoolCode,
      schoolName,
      rollNumber,
      academicYearId: activeYear._id,
      registrationNumber,
      classId: resolvedClassId,
      division: resolvedDivision,
      ...rest,
    });

    // Update class student count
    if (resolvedClassId) {
      await Class.findByIdAndUpdate(resolvedClassId, { $inc: { studentCount: 1 } });
      
      // Auto-create StudentFee if FeeStructure exists for this standard
      try {
        const cl = await Class.findById(resolvedClassId);
        if (cl) {
          const FeeStructure = require('../models/FeeStructure');
          const StudentFee = require('../models/StudentFee');
          const hasFee = await FeeStructure.findOne({ schoolId: req.user.schoolId, standard: cl.standard });
          if (hasFee) {
            await StudentFee.create({
              schoolId: req.user.schoolId,
              studentId: student._id,
              classId: resolvedClassId
            });
          }
        }
      } catch (feeErr) {
        console.error("Failed to auto-create student fee record:", feeErr);
      }
    }

    res.status(201).json({
      message: 'Student created successfully',
      student,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const missingFields = Object.keys(error.errors).map(key => error.errors[key].message);
      return res.status(400).json({ message: `Validation Error: ${missingFields.join(', ')}` });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Database constraint duplicate error. Please ensure unique email/admission/roll details.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Update Student
exports.updateStudent = async (req, res) => {
  try {
    let resolvedClassId = req.body.classId;
    let resolvedDivision = req.body.division;

    if (req.body.classStandard && req.body.classDivision) {
      const cl = await Class.findOne({
        schoolId: req.user.schoolId,
        standard: String(req.body.classStandard).trim(),
        division: String(req.body.classDivision).trim(),
      });
      if (!cl) {
        const newClass = await Class.create({
          schoolId: req.user.schoolId,
          standard: String(req.body.classStandard).trim(),
          division: String(req.body.classDivision).trim(),
        });
        resolvedClassId = newClass._id;
      } else {
        resolvedClassId = cl._id;
      }
      resolvedDivision = req.body.classDivision;
      req.body.classId = resolvedClassId;
      req.body.division = resolvedDivision;
    }

    const originalStudent = await Student.findById(req.params.id);

    if (req.body.password) {
      const { hashPassword } = require('../utils/password');
      req.body.password = await hashPassword(req.body.password);
    } else {
      delete req.body.password;
    }

    const School = require('../models/School');
    const schoolData = await School.findById(req.user.schoolId);
    if (schoolData) {
      req.body.schoolCode = schoolData.code;
      req.body.schoolName = schoolData.name;
    }

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.user.schoolId },
      req.body,
      { new: true, runValidators: true }
    ).populate('classId');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Update class student count if class changed
    if (originalStudent && String(originalStudent.classId) !== String(resolvedClassId)) {
      if (originalStudent.classId) {
        await Class.findByIdAndUpdate(originalStudent.classId, { $inc: { studentCount: -1 } });
      }
      if (resolvedClassId) {
        await Class.findByIdAndUpdate(resolvedClassId, { $inc: { studentCount: 1 } });
      }
    }

    res.json({
      message: 'Student updated successfully',
      student,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Student
exports.deleteStudent = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Only administrators can delete students.' });
    }

    const student = await Student.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Clean up uploaded documents in Cloudinary
    try {
      const { deleteCloudinaryFile } = require('../utils/cloudinaryHelper');
      if (student.photo) {
        await deleteCloudinaryFile(student.photo);
      }
      if (student.documents) {
        for (const key of Object.keys(student.documents)) {
          const docUrl = student.documents[key];
          if (docUrl) {
            await deleteCloudinaryFile(docUrl);
          }
        }
      }
    } catch (cldErr) {
      console.error('Cloudinary cleanup error during student delete:', cldErr);
    }

    // Update class student count
    await Class.findByIdAndUpdate(student.classId, { $inc: { studentCount: -1 } });

    // Clean up student fee records
    try {
      const StudentFee = require('../models/StudentFee');
      await StudentFee.deleteMany({ schoolId: req.user.schoolId, studentId: student._id });
    } catch (feeErr) {
      console.error("Failed to delete student fee record:", feeErr);
    }

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Promote Student
exports.promoteStudent = async (req, res) => {
  try {
    const { newClassId } = req.body;

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.user.schoolId },
      { classId: newClassId },
      { new: true }
    ).populate('classId');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({
      message: 'Student promoted successfully',
      student,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Student Attendance
exports.getStudentAttendance = async (req, res) => {
  try {
    if (req.user.role === 'student' && req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const Attendance = require('../models/Attendance');
    const { page = 1, limit = 10 } = req.query;

    const attendance = await Attendance.find({ userId: req.params.id })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ date: -1 });

    const total = await Attendance.countDocuments({ userId: req.params.id });

    // Calculate percentage
    const presentDays = attendance.filter(a => a.status === 'Present').length;
    const totalDays = attendance.length;
    const percentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0;

    res.json({
      attendance,
      stats: {
        totalDays,
        presentDays,
        absentDays: attendance.filter(a => a.status === 'Absent').length,
        leaveDays: attendance.filter(a => a.status === 'Leave').length,
        lateDays: attendance.filter(a => a.status === 'Late').length,
        percentage,
      },
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bulk Import Students
exports.bulkImportStudents = async (req, res) => {
  try {
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'Students array is required' });
    }

    const { hashPassword } = require('../utils/password');

    const createdStudents = [];
    const errors = [];

    for (let i = 0; i < students.length; i++) {
      try {
        const student = students[i];
        const hashedPassword = await hashPassword(student.password);

        const newStudent = await Student.create({
          ...student,
          password: hashedPassword,
          role: 'student',
          schoolId: req.user.schoolId,
        });

        createdStudents.push(newStudent);

        // Update class count
        await Class.findByIdAndUpdate(student.classId, { $inc: { studentCount: 1 } });

        // Auto-create StudentFee if FeeStructure exists for this standard
        try {
          const cl = await Class.findById(student.classId);
          if (cl) {
            const FeeStructure = require('../models/FeeStructure');
            const StudentFee = require('../models/StudentFee');
            const hasFee = await FeeStructure.findOne({ schoolId: req.user.schoolId, standard: cl.standard });
            if (hasFee) {
              await StudentFee.create({
                schoolId: req.user.schoolId,
                studentId: newStudent._id,
                classId: student.classId
              });
            }
          }
        } catch (feeErr) {
          console.error("Failed to auto-create student fee during bulk import:", feeErr);
        }
      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
      }
    }

    res.json({
      message: 'Bulk import completed',
      created: createdStudents.length,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
