const Timetable = require('../models/Timetable');
const TimetableConfig = require('../models/TimetableConfig');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function buildDaySlots(config) {
  const { schoolStartTime, schoolEndTime, breaks, lectureDurationMinutes } = config;
  const schoolStart = toMin(schoolStartTime);
  const schoolEnd = toMin(schoolEndTime);
  const dur = lectureDurationMinutes || 45;
  
  const sortedBreaks = [...(breaks || [])].map(b => ({
    name: b.name,
    start: toMin(b.startTime),
    end: toMin(b.endTime)
  })).sort((a, b) => a.start - b.start);

  const slots = [];
  let current = schoolStart;
  let lecIdx = 1;

  while (current < schoolEnd) {
    const activeBreak = sortedBreaks.find(b => current >= b.start && current < b.end);
    if (activeBreak) {
      slots.push({
        type: 'break',
        name: activeBreak.name,
        startTime: fromMin(activeBreak.start),  // ← BUG HERE
        endTime: fromMin(activeBreak.end),      // ← BUG HERE
        slotIndex: slots.length
      });
      current = activeBreak.end;
      continue;
    
    }

    const nextBreak = sortedBreaks.find(b => b.start > current && b.start < current + dur);
    if (nextBreak) {
      slots.push({
        type: 'lecture',
        name: `Lecture ${lecIdx++}`,
        startTime: fromMin(current),
        endTime: fromMin(nextBreak.start),
        slotIndex: slots.length
      });
      current = nextBreak.start;
    } else {
      const lecEnd = Math.min(schoolEnd, current + dur);
      if (lecEnd - current >= 10) {
        slots.push({
          type: 'lecture',
          name: `Lecture ${lecIdx++}`,
          startTime: fromMin(current),
          endTime: fromMin(lecEnd),
          slotIndex: slots.length
        });
      }
      current = lecEnd;
    }
  }
  return slots;
}

function fromMin(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── GET BUILDER DATA ───────────────────────────────────────────────────────
exports.getBuilderData = async (req, res) => {
  try {
    const { classId } = req.params;
    const schoolId = req.user.schoolId;

    const config = await TimetableConfig.findOne({ schoolId });
    if (!config) return res.status(400).json({ message: 'Please configure school timings first.' });

    const cls = await Class.findOne({ _id: classId, schoolId });
    if (!cls) return res.status(404).json({ message: 'Class not found.' });

    const daySlots = buildDaySlots(config);

    const subjects = await Subject.find({ schoolId });
    const classSubjects = subjects.filter(sub => 
      sub.lecturesPerStandard?.some(l => l.standard?.toString() === cls.standard?.toString())
    );

    const teachers = await Teacher.find({ schoolId });
    const relevantTeachers = teachers.filter(t => 
      t.subjectClassAssignments?.some(a => a.classId?.toString() === classId)
    );

    const existingTimetables = await Timetable.find({ schoolId, classId })
      .populate('slots.subjectId', 'name code')
      .populate('slots.teacherId', 'name');

    const teacherBusyMap = {};
    const allTimetables = await Timetable.find({ schoolId })
      .populate('slots.teacherId', 'name')
      .populate('classId', 'standard division');

    for (const tt of allTimetables) {
      if (!tt.classId) continue;
      for (const slot of tt.slots) {
        if (slot.teacherId && slot.teacherId._id && !slot.isBreak && slot.startTime && slot.endTime) {
          const tId = slot.teacherId._id.toString();
          const timeKey = `${slot.startTime}-${slot.endTime}`;
          
          if (!teacherBusyMap[tId]) teacherBusyMap[tId] = {};
          if (!teacherBusyMap[tId][tt.dayOfWeek]) teacherBusyMap[tId][tt.dayOfWeek] = {};
          
          teacherBusyMap[tId][tt.dayOfWeek][timeKey] = {
            classId: tt.classId._id.toString(),
            className: `Std ${tt.classId.standard} (${tt.classId.division})`
          };
        }
      }
    }

    res.json({
      class: cls,
      daySlots,
      workingDays: config.workingDays,
      subjects: classSubjects.map(s => ({ _id: s._id, name: s.name, code: s.code })),
      teachers: relevantTeachers.map(t => ({
        _id: t._id,
        name: t.name,
        employeeId: t.employeeId,
        subjectClassAssignments: t.subjectClassAssignments?.filter(a => 
          a.classId?.toString() === classId
        ).map(a => ({ 
          subjectId: a.subjectId?._id || a.subjectId 
        })) || []
      })),
      existingTimetables,
      teacherBusyMap
    });
  } catch (e) {
    console.error('getBuilderData error:', e);
    res.status(500).json({ message: e.message });
  }
};
// ─── VALIDATE SLOT ASSIGNMENT ───────────────────────────────────────────────

exports.validateSlot = async (req, res) => {
  try {
    const { classId, day, slotIndex, teacherId, subjectId } = req.body;
    const schoolId = req.user.schoolId;

    const config = await TimetableConfig.findOne({ schoolId });
    const daySlots = buildDaySlots(config);
    const slot = daySlots[slotIndex];
    if (!slot || slot.type === 'break') {
      return res.json({ valid: false, reason: 'Invalid or break slot.' });
    }

    // Check teacher clash
    const existingTT = await Timetable.findOne({ schoolId, dayOfWeek: day });
    // Find if teacher is busy in this slot across ANY class
    const allTTs = await Timetable.find({ schoolId, dayOfWeek: day });
    for (const tt of allTTs) {
      const existingSlot = tt.slots[slotIndex];
      if (existingSlot && !existingSlot.isBreak && existingSlot.teacherId?.toString() === teacherId) {
        // Same class = just updating, not a clash
        if (tt.classId.toString() !== classId) {
          const clashClass = await Class.findById(tt.classId);
          return res.json({
            valid: false,
            reason: 'Teacher clash',
            details: {
              teacherName: (await Teacher.findById(teacherId))?.name,
              otherClass: `Std ${clashClass?.standard} (${clashClass?.division})`,
              time: `${slot.startTime} - ${slot.endTime}`
            }
          });
        }
      }
    }

    // Check teacher daily load (soft warning, not hard block)
    let dailyCount = 0;
    for (const tt of allTTs) {
      if (tt.slots[slotIndex] && !tt.slots[slotIndex].isBreak && 
          tt.slots[slotIndex].teacherId?.toString() === teacherId) {
        dailyCount++;
      }
    }

    // Check if teacher is assigned to this subject+class
    const teacher = await Teacher.findById(teacherId);
    const isAssigned = teacher?.subjectClassAssignments?.some(a => 
      a.classId?.toString() === classId && a.subjectId?.toString() === subjectId
    );

    res.json({
      valid: true,
      warnings: {
        dailyLoad: dailyCount >= 3 ? 'Teacher already has 3+ periods today' : null,
        notAssigned: !isAssigned ? 'Teacher is not officially assigned to this subject for this class' : null
      }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─── SAVE TIMETABLE FOR CLASS ───────────────────────────────────────────────

exports.saveClassTimetable = async (req, res) => {
  try {
    const { classId } = req.params;
    const { timetableData } = req.body; // { Monday: [{slotIndex, subjectId, teacherId}, ...], ... }
    const schoolId = req.user.schoolId;

    const config = await TimetableConfig.findOne({ schoolId });
    const daySlots = buildDaySlots(config);

    const docs = [];
    for (const day of config.workingDays) {
      const dayAssignments = timetableData[day] || [];
      
      // Build slots array matching daySlots length
      const slots = daySlots.map((ds, idx) => {
        if (ds.type === 'break') {
          return {
            startTime: ds.startTime,
            endTime: ds.endTime,
            isBreak: true,
            breakName: ds.name
          };
        }
        const assignment = dayAssignments.find(a => a.slotIndex === idx);
        if (assignment) {
          return {
            startTime: ds.startTime,
            endTime: ds.endTime,
            subjectId: assignment.subjectId,
            teacherId: assignment.teacherId
          };
        }
        // Empty slot
        return {
          startTime: ds.startTime,
          endTime: ds.endTime,
          subjectId: null,
          teacherId: null
        };
      });

      docs.push({
        schoolId,
        classId,
        dayOfWeek: day,
        slots,
        academicYear: config.academicYear,
        isActive: true
      });
    }

    // Delete old and insert new (atomic-ish)
    await Timetable.deleteMany({ schoolId, classId });
    await Timetable.insertMany(docs);

    res.json({ message: 'Timetable saved successfully!' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─── GET TEACHER SCHEDULE (for sidebar/helper view) ───────────────────────

exports.getTeacherSchedule = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const schoolId = req.user.schoolId;

    const timetables = await Timetable.find({ schoolId })
      .populate('classId', 'standard division')
      .populate('slots.subjectId', 'name');

    const schedule = {};
    for (const tt of timetables) {
      if (!schedule[tt.dayOfWeek]) schedule[tt.dayOfWeek] = [];
      
      for (let i = 0; i < tt.slots.length; i++) {
        const slot = tt.slots[i];
        if (slot.teacherId?.toString() === teacherId && !slot.isBreak) {
          schedule[tt.dayOfWeek].push({
            time: `${slot.startTime} - ${slot.endTime}`,
            className: `Std ${tt.classId.standard} (${tt.classId.division})`,
            subjectName: slot.subjectId?.name || 'Unknown',
            slotIndex: i
          });
        }
      }
    }

    res.json({ schedule });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};