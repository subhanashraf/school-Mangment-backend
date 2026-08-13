const Subject = require('../models/Subject');

// Get All Subjects
exports.getAllSubjects = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { page = 1, limit = 10, search } = req.query;

    let query = { schoolId };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const subjects = await Subject.find(query)
      .populate('assignedTeachers', 'name email')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Subject.countDocuments(query);

    res.json({
      subjects,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Subject by ID
exports.getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    })
      .populate('assignedTeachers', 'name email phone');

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.json({ subject });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create Subject
exports.createSubject = async (req, res) => {
  try {
    const { name, code, maxMarks = 100, minMarks = 35, standard, lecturesPerStandard, defaultWeeklyLectures, weightage } = req.body;

    // Check if subject exists
    let subject = await Subject.findOne({
      schoolId: req.user.schoolId,
      code,
    });

    if (subject) {
      return res.status(400).json({ message: 'Subject with this code already exists' });
    }

    subject = await Subject.create({
      schoolId: req.user.schoolId,
      name,
      code,
      maxMarks,
      minMarks,
      standard,
      lecturesPerStandard,
      defaultWeeklyLectures,
      weightage,
    });

    res.status(201).json({
      message: 'Subject created successfully',
      subject,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Subject
exports.updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedTeachers');

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.json({
      message: 'Subject updated successfully',
      subject,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Subject
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Assign Teacher to Subject
exports.assignTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;

    const subject = await Subject.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      { $addToSet: { assignedTeachers: teacherId } },
      { new: true }
    ).populate('assignedTeachers');

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.json({
      message: 'Teacher assigned successfully',
      subject,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
