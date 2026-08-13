const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');

/**
 * Automatically partition class divisions for each (Subject, Standard) pair
 * among the teachers assigned to teach it, prioritizing those with lower workloads.
 * @param {string} schoolId - The ID of the school.
 */
const redistributeTeacherAssignments = async (schoolId) => {
  try {
    // 1. Get all teachers, classes, and subjects for the school
    const teachers = await Teacher.find({ schoolId });
    const classes = await Class.find({ schoolId });
    const subjects = await Subject.find({ schoolId });

    // 2. Initialize assignments map (teacherId -> list of { subjectId, classId })
    const newAssignments = new Map();
    teachers.forEach(t => {
      newAssignments.set(t._id.toString(), []);
    });

    // Helper to calculate total workload of a teacher
    // Workload is measured as the total number of unique standard-subject combinations assigned
    const getWorkload = (teacher) => {
      let count = 0;
      if (teacher.assignedSubjectStandards) {
        teacher.assignedSubjectStandards.forEach(ass => {
          count += (ass.standards || []).length;
        });
      }
      return count;
    };

    // Pre-calculate workloads
    const teacherWorkloads = teachers.map(t => ({
      id: t._id.toString(),
      workload: getWorkload(t)
    }));

    // 3. For each subject, find the standards and partition the divisions
    for (const subject of subjects) {
      // Find all unique standards assigned for this subject across all teachers
      const standardsSet = new Set();
      teachers.forEach(t => {
        if (t.assignedSubjectStandards) {
          t.assignedSubjectStandards.forEach(ass => {
            if (ass.subjectId.toString() === subject._id.toString() && ass.standards) {
              ass.standards.forEach(std => standardsSet.add(String(std).trim()));
            }
          });
        }
      });

      for (const std of standardsSet) {
        // Find all teachers assigned to teach this subject in this standard
        const assignedTeachers = teachers.filter(t => {
          if (!t.assignedSubjectStandards) return false;
          return t.assignedSubjectStandards.some(ass => 
            ass.subjectId.toString() === subject._id.toString() && 
            (ass.standards || []).map(s => String(s).trim()).includes(std)
          );
        });

        if (assignedTeachers.length === 0) continue;

        // Find all divisions of this standard in the school (sorted alphabetically: A, B, C...)
        const stdClasses = classes
          .filter(c => String(c.standard).trim() === std)
          .sort((a, b) => String(a.division).trim().localeCompare(String(b.division).trim()));

        if (stdClasses.length === 0) continue;

        // Sort assigned teachers by workload ascending (lowest workload first)
        const sortedTeachers = [...assignedTeachers].sort((a, b) => {
          const wA = teacherWorkloads.find(w => w.id === a._id.toString())?.workload || 0;
          const wB = teacherWorkloads.find(w => w.id === b._id.toString())?.workload || 0;
          if (wA !== wB) return wA - wB;
          // Deterministic fallback by ID
          return a._id.toString().localeCompare(b._id.toString());
        });

        const n = stdClasses.length; // total divisions
        const m = sortedTeachers.length; // total teachers
        const base = Math.floor(n / m);
        const remainder = n % m;

        // Determine how many divisions each teacher receives
        const divisionCounts = sortedTeachers.map((t, idx) => {
          return base + (idx < remainder ? 1 : 0);
        });

        // Allocate the divisions contiguously to teachers
        let classIdx = 0;
        sortedTeachers.forEach((teacher, idx) => {
          const count = divisionCounts[idx];
          const tId = teacher._id.toString();
          for (let i = 0; i < count; i++) {
            if (classIdx < n) {
              newAssignments.get(tId).push({
                subjectId: subject._id,
                classId: stdClasses[classIdx]._id
              });
              classIdx++;
            }
          }
        });
      }
    }

    // 4. Save the dynamically computed division assignments for all teachers
    for (const teacher of teachers) {
      const tId = teacher._id.toString();
      const tAssignments = newAssignments.get(tId) || [];
      
      teacher.subjectClassAssignments = tAssignments;
      teacher.subjectIds = [...new Set(tAssignments.map(a => a.subjectId.toString()))];
      teacher.classIds = [...new Set(tAssignments.map(a => a.classId.toString()))];
      
      // Prevent mongoose from failing validation on empty fields if applicable
      await teacher.save();
    }
    console.log(`[Redistributor] Completed assignment partition for school ${schoolId}`);
  } catch (error) {
    console.error('[Redistributor] Failed to redistribute teacher assignments:', error);
    throw error;
  }
};

module.exports = {
  redistributeTeacherAssignments
};
