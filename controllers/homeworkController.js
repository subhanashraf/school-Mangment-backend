const Homework = require('../models/Homework');
const Student = require('../models/Student');

// Create Homework
exports.createHomework = async (req, res) => {
  try {
    const { classStandard, classDivision, subjectId, subjectName, title, description, dueDate } = req.body;

    const Class = require('../models/Class');
    let resolvedClassId;
    const cl = await Class.findOne({
      schoolId: req.user.schoolId,
      standard: String(classStandard).trim(),
      division: String(classDivision).trim(),
    });
    if (!cl) {
      const newClass = await Class.create({
        schoolId: req.user.schoolId,
        standard: String(classStandard).trim(),
        division: String(classDivision).trim(),
      });
      resolvedClassId = newClass._id;
    } else {
      resolvedClassId = cl._id;
    }

    const Subject = require('../models/Subject');
    let resolvedSubjectId = subjectId;
    if (subjectName) {
      const subName = String(subjectName).trim();
      const subCode = subName.toUpperCase().replace(/\s+/g, '_');
      let subject = await Subject.findOne({
        schoolId: req.user.schoolId,
        name: { $regex: new RegExp(`^${subName}$`, 'i') }
      });
      if (!subject) {
        let codeCheck = await Subject.findOne({ schoolId: req.user.schoolId, code: subCode });
        if (codeCheck) {
          resolvedSubjectId = codeCheck._id;
        } else {
          subject = await Subject.create({
            schoolId: req.user.schoolId,
            name: subName,
            code: subCode,
          });
          resolvedSubjectId = subject._id;
        }
      } else {
        resolvedSubjectId = subject._id;
      }
    }

    // Check that teacher teaches this subject in this class
    const Teacher = require('../models/Teacher');
    const teacher = await Teacher.findById(req.user.userId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher profile not found' });
    }

    const isAssigned = teacher.subjectClassAssignments && teacher.subjectClassAssignments.some(
      a => a.subjectId.toString() === resolvedSubjectId.toString() && a.classId.toString() === resolvedClassId.toString()
    );
    const isClassTeacher = teacher.isClassTeacher && teacher.classTeacherOf && teacher.classTeacherOf.toString() === resolvedClassId.toString();

    if (!isAssigned && !isClassTeacher) {
      return res.status(403).json({ message: 'Access denied. You are not assigned to teach this subject in this class.' });
    }

    // Get total students in class
    const studentCount = await Student.countDocuments({
      classId: resolvedClassId,
      schoolId: req.user.schoolId,
    });

    const homework = await Homework.create({
      schoolId: req.user.schoolId,
      classId: resolvedClassId,
      subjectId: resolvedSubjectId,
      teacherId: req.user.userId,
      title,
      description,
      dueDate,
      totalStudents: studentCount,
    });

    res.status(201).json({
      message: 'Homework assigned successfully',
      homework,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Homework
exports.getAllHomework = async (req, res) => {
  try {
    const { classId, subjectId, page = 1, limit = 10 } = req.query;
    let query = { schoolId: req.user.schoolId };

    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;

    const homework = await Homework.find(query)
      .populate('classId', 'standard division')
      .populate('subjectId', 'name')
      .populate('teacherId', 'name')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ dueDate: 1 });

    const total = await Homework.countDocuments(query);

    res.json({
      homework,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Homework for Student
exports.getHomeworkForStudent = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const student = await Student.findOne({
      _id: req.user.userId,
      schoolId: req.user.schoolId,
    });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const homework = await Homework.find({
      classId: student.classId,
      schoolId: req.user.schoolId,
    })
      .populate('subjectId', 'name')
      .populate('teacherId', 'name')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ dueDate: 1 });

    res.json({
      homework,
      pagination: {
        total: await Homework.countDocuments({ classId: student.classId }),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit Homework
exports.submitHomework = async (req, res) => {
  try {
    const { homeworkId, fileUrl, reasonForMissing } = req.body;

    const homework = await Homework.findOne({
      _id: homeworkId || req.params.id,
      schoolId: req.user.schoolId,
    });
    if (!homework) {
      return res.status(404).json({ message: 'Homework not found' });
    }

    const submissionExists = homework.submissions.find(
      s => s.studentId.toString() === req.user.userId
    );

    if (submissionExists) {
      if (reasonForMissing) {
        submissionExists.reasonForMissing = reasonForMissing;
        submissionExists.status = 'Not Submitted';
      } else {
        submissionExists.fileUrl = fileUrl;
        submissionExists.submittedDate = new Date();
        submissionExists.status = new Date() <= new Date(homework.dueDate) ? 'Submitted' : 'Late';
      }
    } else {
      if (reasonForMissing) {
        homework.submissions.push({
          studentId: req.user.userId,
          reasonForMissing,
          status: 'Not Submitted',
        });
      } else {
        homework.submissions.push({
          studentId: req.user.userId,
          fileUrl,
          submittedDate: new Date(),
          status: new Date() <= new Date(homework.dueDate) ? 'Submitted' : 'Late',
        });
        homework.submittedCount += 1;
      }
    }

    await homework.save();

    res.json({
      message: 'Homework submitted successfully',
      homework,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Grade Homework
exports.gradeHomework = async (req, res) => {
  try {
    const { homeworkId, studentId, marks, feedback } = req.body;

    const homework = await Homework.findOne({
      _id: homeworkId || req.params.id,
      schoolId: req.user.schoolId,
    });
    if (!homework) {
      return res.status(404).json({ message: 'Homework not found' });
    }

    const submission = homework.submissions.find(
      s => s.studentId.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    submission.marks = marks;
    submission.feedback = feedback;
    await homework.save();

    res.json({
      message: 'Homework graded successfully',
      submission,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Homework
exports.updateHomework = async (req, res) => {
  try {
    const homework = await Homework.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!homework) {
      return res.status(404).json({ message: 'Homework not found' });
    }

    res.json({
      message: 'Homework updated successfully',
      homework,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Homework
exports.deleteHomework = async (req, res) => {
  try {
    const homework = await Homework.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!homework) {
      return res.status(404).json({ message: 'Homework not found' });
    }

    res.json({ message: 'Homework deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
