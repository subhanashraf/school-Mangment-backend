const Exam = require('../models/Exam');
const Marks = require('../models/Marks');
const Student = require('../models/Student');
const Notice = require('../models/Notice');

// Create Exam
// Create Exam
exports.createExam = async (req, res) => {
  try {
    const { name, classIds, classId, subjectId, date, totalMarks = 100, passingMarks = 35 } = req.body;

    if (req.user.role === 'teacher') {
      return res.status(403).json({ message: 'Access denied. Teachers are not allowed to create assessments/exams.' });
    }
      const AcedemicYear = require('../models/AcademicYear');
    const activeYear = await AcedemicYear.findOne({ schoolId: req.user.schoolId, isActive: true });
    if (!activeYear) {
      return res.status(400).json({ message: 'No active academic year found. Please set an active academic year before adding students.' });
    }

    // Support both old (classId) and new (classIds) format
    const finalClassIds = classIds || (classId ? [classId] : []);

    const exam = await Exam.create({
      schoolId: req.user.schoolId,
      name,
      classIds: finalClassIds,
      subjectId,
      date,
      academicYearId: activeYear._id,
      totalMarks,
      passingMarks,
    });

    res.status(201).json({
      message: 'Exam created successfully',
      exam,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Exams
exports.getAllExams = async (req, res) => {
  try {
    const { classId, page = 1, limit = 10 } = req.query;
    let query = { schoolId: req.user.schoolId };
    if (classId) query.classIds = { $in: [classId] };

    const exams = await Exam.find(query)
      .populate('subjectId', 'name code')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ date: -1 })
      .lean();

    // Get all unique class IDs
    const allClassIds = [...new Set(exams.flatMap(e => e.classIds || []))];
    
    // Fetch all classes in one query
    const Class = require('../models/Class');
    const classes = await Class.find({ _id: { $in: allClassIds } })
      .select('standard division studentCount')
      .lean();
    
    const classMap = {};
    classes.forEach(c => { classMap[c._id.toString()] = c; });

    // Map classes to exams
    const validExams = exams.map(ex => ({
      ...ex,
      classIds: (ex.classIds || [])
        .map(id => classMap[id.toString()])
        .filter(Boolean)
        .map(c => ({
          _id: c._id.toString(),
          standard: c.standard,
          division: c.division,
          studentCount: c.studentCount || 0
        }))
    })).filter(ex => ex.classIds.length > 0);

    const total = await Exam.countDocuments(query);

    res.json({
      exams: validExams,
      pagination: { total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Enter Marks
exports.enterMarks = async (req, res) => {
  try {
    const { examId, classId, subjectId, studentMarks } = req.body;

    // Validate exam
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Teacher authorization check
    if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const teacher = await Teacher.findById(req.user.userId);
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }
      const isAssigned = teacher.subjectClassAssignments?.some(
        a => a.subjectId.toString() === subjectId.toString() && 
             a.classId.toString() === classId.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ 
          message: 'Access denied. You are not assigned to teach this subject in this class.' 
        });
      }
    }

    // Calculate passStatus & percentage for each student
    const processedStudentMarks = studentMarks.map(s => {
      const percentage = ((s.marks / (req.body.totalMarks || 100)) * 100).toFixed(2);
      const passStatus = s.marks >= (req.body.passingMarks || 35) ? 'Pass' : 'Fail';
      return {
        studentId: s.studentId,
        marks: s.marks,
        percentage: parseFloat(percentage),
        passStatus,
        remarks: s.remarks || '',
      };
    });

    // Upsert: find by unique index (schoolId, examId, classId, subjectId)
    const filter = {
      schoolId: req.user.schoolId,
      examId,
      classId,
      subjectId,
    };

    const update = {
      $set: {
        studentMarks: processedStudentMarks,
        totalMarks: req.body.totalMarks || 100,
        passingMarks: req.body.passingMarks || 35,
        enteredBy: req.user.userId,
        enteredByModel: req.user.role === 'teacher' ? 'Teacher' : 'User',
      },
    };

    const options = { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true 
    };

    const result = await Marks.findOneAndUpdate(filter, update, options);

    res.status(existing ? 200 : 201).json({
      message: existing ? 'Marks updated' : 'Marks entered successfully',
      marks: result,
    });

  } catch (error) {
    // Handle duplicate key error (unique index violation)
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: 'Marks already exist for this exam, class, and subject combination.' 
      });
    }
    res.status(500).json({ message: error.message });
  }
};
// Bulk Get Marks with classid examid and subjectid
exports.getMarksByClassAndSubject = async (req, res) => {
  try {
    const { examId, classId, subjectId } = req.params;

    const marks = await Marks.findOne({
      schoolId: req.user.schoolId,
      examId,
      classId,
      subjectId,
    }).populate('studentMarks.studentId', 'name rollNumber');

    // If no marks found, return empty structure — not 404
    if (!marks) {
      return res.json({
        examId,
        classId,
        subjectId,
        totalMarks: 100,
        passingMarks: 35,
        studentMarks: [],
      });
    }

    res.json({
      examId: marks.examId,
      classId: marks.classId,
      subjectId: marks.subjectId,
      totalMarks: marks.totalMarks,
      passingMarks: marks.passingMarks,
      studentMarks: marks.studentMarks.map(s => ({
        studentId: s.studentId?._id || s.studentId,
        name: s.studentId?.name || '',
        rollNumber: s.studentId?.rollNumber || '',
        marks: s.marks,
        percentage: s.percentage,
        passStatus: s.passStatus,
        remarks: s.remarks,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Bulk Enter Marks
exports.bulkEnterMarks = async (req, res) => {
  try {
    const { examId, classId, subjectId, totalMarks, passingMarks, marksData } = req.body;

    if (!Array.isArray(marksData)) {
      return res.status(400).json({ message: 'Marks data must be an array' });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Teacher authorization check
    if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const teacher = await Teacher.findById(req.user.userId);
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }
      const isAssigned = teacher.subjectClassAssignments?.some(
        a => a.subjectId.toString() === subjectId.toString() && 
             a.classId.toString() === classId.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ 
          message: 'Access denied. You are not assigned to teach this subject in this class.' 
        });
      }
    }

    // Process all student marks
    const studentMarks = marksData.map(item => {
      const percentage = ((item.marks / (totalMarks || 100)) * 100).toFixed(2);
      const passStatus = item.marks >= (passingMarks || 35) ? 'Pass' : 'Fail';
      
      return {
        studentId: item.studentId,
        marks: item.marks,
        percentage: parseFloat(percentage),
        passStatus,
        remarks: item.remarks || '',
      };
    });

    // Upsert one document per exam-class-subject
    const filter = {
      schoolId: req.user.schoolId,
      examId,
      classId,
      subjectId,
    };

    const update = {
      $set: {
        studentMarks,
        totalMarks: totalMarks || 100,
        passingMarks: passingMarks || 35,
        enteredBy: req.user.userId,
        enteredByModel: req.user.role === 'teacher' ? 'Teacher' : 'User',
      },
    };

    const result = await Marks.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    res.json({
      message: 'Marks entered successfully',
      entered: studentMarks.length,
      marks: result,
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: 'Marks already exist for this exam, class, and subject combination.' 
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// Get Student Marks
exports.getStudentMarks = async (req, res) => {
  try {
    const { studentId } = req.params;

    const marks = await Marks.find({
      studentId,
      schoolId: req.user.schoolId,
    })
      .populate('examId', 'name date')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 });

    res.json({ marks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Exam Result
exports.getExamResult = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const teacher = await Teacher.findById(req.user.userId);
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }

      // Check if class teacher of this exam's class
      const isClassTeacher = teacher.isClassTeacher && teacher.classTeacherOf && teacher.classTeacherOf.toString() === exam.classId.toString();

      // Check if assigned subject teacher
      const isAssigned = teacher.subjectClassAssignments && teacher.subjectClassAssignments.some(
        a => a.subjectId.toString() === exam.subjectId.toString() && a.classId.toString() === exam.classId.toString()
      );

      if (!isClassTeacher && !isAssigned) {
        return res.status(403).json({ message: 'Access denied. You are not authorized to view results for this exam.' });
      }
    }

    const results = await Marks.find({ examId, schoolId: req.user.schoolId })
      .populate('studentId', 'name email rollNumber')
      .populate('subjectId', 'name')
      .sort({ marks: -1 });

    const totalStudents = results.length;
    const topScore = results.length > 0 ? Math.max(...results.map(r => r.marks)) : 0;
    const averageScore = results.length > 0 ? (results.reduce((sum, r) => sum + r.marks, 0) / totalStudents).toFixed(2) : 0;
    const passedCount = results.filter(r => r.marks >= r.outOfMarks * 0.35).length;

    res.json({
      results,
      summary: {
        totalStudents,
        topScore,
        averageScore,
        passedCount,
        failedCount: totalStudents - passedCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Toppers List
exports.getToppers = async (req, res) => {
  try {
    const { classId, examId, limit = 10 } = req.query;

    let query = { schoolId: req.user.schoolId };
    if (examId) query.examId = examId;

    const toppers = await Marks.find(query)
      .populate('studentId', 'name email rollNumber classId')
      .sort({ percentage: -1 })
      .limit(parseInt(limit));

    res.json({ toppers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Exam
exports.updateExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const teacher = await Teacher.findById(req.user.userId);
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }
      const isAssigned = teacher.subjectClassAssignments && teacher.subjectClassAssignments.some(
        a => a.subjectId.toString() === exam.subjectId.toString() && a.classId.toString() === exam.classId.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: 'Access denied. You are not assigned to teach this subject in this class.' });
      }
    }

    const updatedExam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ message: 'Exam updated successfully', exam: updatedExam });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Exam
exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const teacher = await Teacher.findById(req.user.userId);
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }
      const isAssigned = teacher.subjectClassAssignments && teacher.subjectClassAssignments.some(
        a => a.subjectId.toString() === exam.subjectId.toString() && a.classId.toString() === exam.classId.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: 'Access denied. You are not assigned to teach this subject in this class.' });
      }
    }

    await Exam.findByIdAndDelete(req.params.id);
    // Delete all marks associated with this exam
    await Marks.deleteMany({ examId: req.params.id });
    // Delete the auto-created notice linked to this exam (if any)
    await Notice.deleteMany({ examId: req.params.id, schoolId: req.user.schoolId });
    res.json({ message: 'Exam and its marks deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
