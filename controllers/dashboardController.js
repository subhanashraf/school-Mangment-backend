const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Attendance = require('../models/Attendance');
const Complaint = require('../models/Complaint');
const Notice = require('../models/Notice');
const Marks = require('../models/Marks');
const Exam = require('../models/Exam');

// Get Admin Dashboard Stats
exports.getAdminStats = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Overall stats
    const totalStudents = await Student.countDocuments({ schoolId });
    const totalTeachers = await Teacher.countDocuments({ schoolId });
    const totalAttendance = await Attendance.countDocuments({ schoolId });
    const pendingComplaints = await Complaint.countDocuments({
      schoolId,
      status: 'Pending',
    });

    // Today's attendance
    const todayAttendance = await Attendance.countDocuments({
      schoolId,
      date: { $gte: today },
    });

    // Recent notices
    const recentNotices = await Notice.find({ schoolId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Pending exams
    const upcomingExams = await Exam.find({
      schoolId,
      date: { $gte: today },
    }).limit(5);

    res.json({
      stats: {
        totalStudents,
        totalTeachers,
        totalAttendance,
        pendingComplaints,
        todayAttendance,
      },
      recentNotices,
      upcomingExams,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Teacher Dashboard Stats
exports.getTeacherStats = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const teacherId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const teacher = await Teacher.findById(teacherId).populate('classIds');

    // Get students from assigned classes
    const Student = require('../models/Student');
    const totalStudents = await Student.countDocuments({
      schoolId,
      classId: { $in: teacher.classIds },
    });

    // Today's attendance in my classes
    const todayAttendance = await Attendance.countDocuments({
      schoolId,
      classId: { $in: teacher.classIds },
      date: { $gte: today },
    });

    // Pending homework
    const Homework = require('../models/Homework');
    const pendingHomework = await Homework.countDocuments({
      schoolId,
      teacherId,
      dueDate: { $gte: today },
    });

    // My subjects
    const mySubjects = teacher.subjectIds.length;

    res.json({
      stats: {
        totalStudents,
        todayAttendance,
        pendingHomework,
        mySubjects,
        assignedClasses: teacher.classIds.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Student Dashboard Stats
exports.getStudentStats = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const studentId = req.user.userId;

    const student = await Student.findById(studentId);

    // Attendance percentage
    const allAttendance = await Attendance.find({
      schoolId,
      userId: studentId,
    });

    const presentDays = allAttendance.filter(a => a.status === 'Present').length;
    const attendancePercentage = allAttendance.length > 0 
      ? ((presentDays / allAttendance.length) * 100).toFixed(2) 
      : 0;

    // Average marks
    const marks = await Marks.find({
      schoolId,
      studentId,
    });

    const averageMarks = marks.length > 0 
      ? (marks.reduce((sum, m) => sum + m.percentage, 0) / marks.length).toFixed(2)
      : 0;

    // Pending homework
    const Homework = require('../models/Homework');
    const pendingHomework = await Homework.countDocuments({
      schoolId,
      classId: student.classId,
      dueDate: { $gte: new Date() },
    });

    // Upcoming exams
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingExams = await Exam.countDocuments({
      schoolId,
      classId: student.classId,
      date: { $gte: today },
    });

    res.json({
      stats: {
        attendancePercentage,
        averageMarks,
        pendingHomework,
        upcomingExams,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Analytics
exports.getAnalytics = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    // Student performance over time
    const marks = await Marks.find({ schoolId })
      .select('percentage createdAt')
      .sort({ createdAt: 1 });

    // Monthly attendance
    const attendance = await Attendance.find({ schoolId })
      .select('date status')
      .sort({ date: 1 });

    // Complaint trend
    const complaints = await Complaint.find({ schoolId })
      .select('status createdAt')
      .sort({ createdAt: 1 });

    res.json({
      performance: marks,
      attendance,
      complaints,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
