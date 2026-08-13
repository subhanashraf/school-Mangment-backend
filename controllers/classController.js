const Class = require('../models/Class');

// Get All Classes
exports.getAllClasses = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { standard, page = 1, limit = 10 } = req.query;

    let query = { schoolId };
    if (standard) query.standard = standard;

    const classes = await Class.find(query)
      .populate('classTeacherId', 'name email')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Class.countDocuments(query);

    res.json({
      classes,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Class by ID
exports.getClassById = async (req, res) => {
  try {
    const classData = await Class.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    })
      .populate('classTeacherId', 'name email phone')
      .populate('schoolId');

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    res.json({ class: classData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create Class
exports.createClass = async (req, res) => {
  try {
    const { standard, division, academicYear } = req.body;

    // Check if class exists (without filtering by academicYear since index standard+division is unique per school)
    let classExists = await Class.findOne({
      schoolId: req.user.schoolId,
      standard,
      division,
    });

    if (classExists) {
      return res.status(400).json({ message: 'Class already exists' });
    }

    const newClass = await Class.create({
      schoolId: req.user.schoolId,
      standard,
      division,
      academicYear: academicYear || new Date().getFullYear().toString(),
    });

    // Replicate existing standard exams to the new division
    try {
      const Exam = require('../models/Exam');
      const otherClasses = await Class.find({ schoolId: req.user.schoolId, standard, _id: { $ne: newClass._id } });
      const otherClassIds = otherClasses.map(c => c._id);
      
      if (otherClassIds.length > 0) {
        const existingExams = await Exam.find({ classId: { $in: otherClassIds }, schoolId: req.user.schoolId });
        
        // Group by exam name to find unique exams on this standard
        const uniqueExams = {};
        for (const ex of existingExams) {
          if (!uniqueExams[ex.name]) {
            uniqueExams[ex.name] = ex;
          }
        }
        
        // For each unique exam name, create a copy for the new class/division
        for (const examName of Object.keys(uniqueExams)) {
          const template = uniqueExams[examName];
          await Exam.create({
            schoolId: req.user.schoolId,
            name: template.name,
            classId: newClass._id,
            subjectId: template.subjectId,
            date: template.date,
            startTime: template.startTime,
            endTime: template.endTime,
            totalMarks: template.totalMarks,
            passingMarks: template.passingMarks,
            duration: template.duration
          });
        }
      }
    } catch (err) {
      console.error("Failed to replicate exams to new division:", err);
    }

    res.status(201).json({
      message: 'Class created successfully',
      class: newClass,
    });
  } catch (error) {
    if (error.code === 11000 || error.message?.includes('E11000') || error.message?.includes('duplicate key')) {
      return res.status(400).json({ message: 'Class standard and division already exists.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Update Class
exports.updateClass = async (req, res) => {
  try {
    const classData = await Class.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.user.schoolId },
      req.body,
      { new: true, runValidators: true }
    ).populate('classTeacherId');

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    res.json({
      message: 'Class updated successfully',
      class: classData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Class
exports.deleteClass = async (req, res) => {
  try {
    const classData = await Class.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Find all remaining divisions for this standard in ascending order
    const remainingClasses = await Class.find({
      schoolId: req.user.schoolId,
      standard: classData.standard,
      _id: { $ne: classData._id }
    }).sort({ division: 1 });

    const Student = require('../models/Student');
    const studentsToTransfer = await Student.find({
      classId: classData._id,
      schoolId: req.user.schoolId
    });

    if (studentsToTransfer.length > 0) {
      if (remainingClasses.length > 0) {
        // Retrieve current student counts for all active remaining divisions
        const Student = require('../models/Student');
        const activeCounts = {};
        for (const c of remainingClasses) {
          const currentCount = await Student.countDocuments({ classId: c._id, schoolId: req.user.schoolId });
          activeCounts[c._id] = currentCount;
        }

        const counts = {};
        remainingClasses.forEach(c => { counts[c._id] = 0; });

        for (const student of studentsToTransfer) {
          // Find the remaining division with the smallest total enrollment (initial count + newly assigned)
          let targetClass = remainingClasses[0];
          let minCount = activeCounts[targetClass._id] + counts[targetClass._id];

          for (const c of remainingClasses) {
            const currentTotal = activeCounts[c._id] + counts[c._id];
            if (currentTotal < minCount) {
              targetClass = c;
              minCount = currentTotal;
            }
          }

          await Student.findByIdAndUpdate(student._id, {
            classId: targetClass._id,
            division: targetClass.division
          });
          counts[targetClass._id]++;
        }

        // Increment studentCount for target classes
        for (const cid of Object.keys(counts)) {
          const incAmount = counts[cid];
          if (incAmount > 0) {
            await Class.findByIdAndUpdate(cid, { $inc: { studentCount: incAmount } });
          }
        }
      } else {
        // No divisions left, clear class references
        await Student.updateMany(
          { classId: classData._id, schoolId: req.user.schoolId },
          { $set: { classId: null, division: '' } }
        );
      }
    }

    // Cascade delete associated exams, marks, and notices
    const Exam = require('../models/Exam');
    const Marks = require('../models/Marks');
    const Notice = require('../models/Notice');
    const examsToDelete = await Exam.find({ classId: classData._id, schoolId: req.user.schoolId });
    const examIds = examsToDelete.map(e => e._id);
    if (examIds.length > 0) {
      await Promise.all([
        Exam.deleteMany({ _id: { $in: examIds } }),
        Marks.deleteMany({ examId: { $in: examIds } }),
        Notice.deleteMany({ examId: { $in: examIds } })
      ]);
    }

    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Whole Standard (Class)
exports.deleteStandard = async (req, res) => {
  try {
    const { standardName } = req.params;
    const schoolId = req.user.schoolId;

    // Find all classes matching this standard
    const classesToDelete = await Class.find({ standard: standardName, schoolId });
    const classIds = classesToDelete.map(c => c._id);

    if (classIds.length === 0) {
      return res.status(404).json({ message: 'No classes found for this standard' });
    }

    // Delete classes
    await Class.deleteMany({ _id: { $in: classIds } });

    // Unassign students from all these classes
    const Student = require('../models/Student');
    await Student.updateMany(
      { classId: { $in: classIds }, schoolId },
      { $set: { classId: null, division: '' } }
    );

    // Cascade delete associated exams, marks, and notices
    const Exam = require('../models/Exam');
    const Marks = require('../models/Marks');
    const Notice = require('../models/Notice');
    const examsToDelete = await Exam.find({ classId: { $in: classIds }, schoolId });
    const examIds = examsToDelete.map(e => e._id);
    if (examIds.length > 0) {
      await Promise.all([
        Exam.deleteMany({ _id: { $in: examIds } }),
        Marks.deleteMany({ examId: { $in: examIds } }),
        Notice.deleteMany({ examId: { $in: examIds } })
      ]);
    }

    res.json({ message: `All divisions for standard ${standardName} deleted successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Class Students
exports.getClassStudents = async (req, res) => {
  try {
    const Student = require('../models/Student');

    const classData = await Class.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    const students = await Student.find({
      classId: req.params.id,
      schoolId: req.user.schoolId,
    })
      .sort({ lastName: 1, firstName: 1 });

    res.json({
      students,
      totalStudents: students.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bulk Setup Classes (Standards & Divisions)
exports.bulkSetupClasses = async (req, res) => {
  try {
    const { classesConfig } = req.body;
    if (!classesConfig || !Array.isArray(classesConfig)) {
      return res.status(400).json({ message: 'classesConfig is required and must be an array' });
    }

    const schoolId = req.user.schoolId;
    const academicYear = new Date().getFullYear().toString();
    const createdClasses = [];
    const Student = require('../models/Student');

    const getDivisionLetters = (count) => {
      const letters = [];
      for (let i = 0; i < count; i++) {
        letters.push(String.fromCharCode(65 + i)); // 65 is 'A'
      }
      return letters;
    };

    // Keep track of which standard + division pairs are defined in the new config
    const activePairs = new Set();

    // 1. Create or verify new config classes
    for (const config of classesConfig) {
      const { standard, divisionsCount } = config;
      const count = parseInt(divisionsCount || 1, 10);
      const divisions = getDivisionLetters(count);

      for (const division of divisions) {
        activePairs.add(`${standard.toString()}:${division}`);

        let classObj = await Class.findOne({
          schoolId,
          standard: standard.toString(),
          division,
        });

        if (!classObj) {
          classObj = await Class.create({
            schoolId,
            standard: standard.toString(),
            division,
            academicYear
          });

          // Replicate existing standard exams to the new division
          try {
            const Exam = require('../models/Exam');
            const otherClasses = await Class.find({ schoolId, standard: standard.toString(), _id: { $ne: classObj._id } });
            const otherClassIds = otherClasses.map(c => c._id);
            
            if (otherClassIds.length > 0) {
              const existingExams = await Exam.find({ classId: { $in: otherClassIds }, schoolId });
              
              // Group by exam name to find unique exams on this standard
              const uniqueExams = {};
              for (const ex of existingExams) {
                if (!uniqueExams[ex.name]) {
                  uniqueExams[ex.name] = ex;
                }
              }
              
              // For each unique exam name, create a copy for the new class/division
              for (const examName of Object.keys(uniqueExams)) {
                const template = uniqueExams[examName];
                await Exam.create({
                  schoolId,
                  name: template.name,
                  classId: classObj._id,
                  subjectId: template.subjectId,
                  date: template.date,
                  startTime: template.startTime,
                  endTime: template.endTime,
                  totalMarks: template.totalMarks,
                  passingMarks: template.passingMarks,
                  duration: template.duration
                });
              }
            }
          } catch (err) {
            console.error("Failed to replicate exams to new division in bulk setup:", err);
          }
        }
        createdClasses.push(classObj);
      }
    }

    // Reload classes from db to return the final list
    const finalClasses = await Class.find({ schoolId });

    res.json({
      message: 'Classes configured successfully',
      classes: finalClasses
    });
  } catch (error) {
    if (error.code === 11000 || error.message?.includes('E11000') || error.message?.includes('duplicate key')) {
      return res.status(400).json({ message: 'One or more of the classes you are trying to configure already exist.' });
    }
    res.status(500).json({ message: error.message });
  }
};
