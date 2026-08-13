const Timetable = require('../models/Timetable');
const TimetableConfig = require('../models/TimetableConfig');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMin(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildDaySlots(config) {
  const { schoolStartTime, schoolEndTime, breaks, lectureDurationMinutes } = config;
  const schoolStart = toMin(schoolStartTime);
  const schoolEnd   = toMin(schoolEndTime);
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
        startTime: fromMin(activeBreak.start),
        endTime: fromMin(activeBreak.end)
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
        endTime: fromMin(nextBreak.start)
      });
      current = nextBreak.start;
    } else {
      const lecEnd = Math.min(schoolEnd, current + dur);
      if (lecEnd - current >= 10) {
        slots.push({
          type: 'lecture',
          name: `Lecture ${lecIdx++}`,
          startTime: fromMin(current),
          endTime: fromMin(lecEnd)
        });
      }
      current = lecEnd;
    }
  }
  return slots;
}

function mergeSlots(rawSlots) {
  if (rawSlots.length === 0) return [];
  const merged = [];
  let current = null;

  for (const slot of rawSlots) {
    if (!slot) continue;
    if (!current) {
      current = { ...slot };
    } else if (
      current.subjectId.toString() === slot.subjectId.toString() &&
      current.teacherId.toString() === slot.teacherId.toString() &&
      current.endTime === slot.startTime
    ) {
      current.endTime = slot.endTime;
    } else {
      merged.push(current);
      current = { ...slot };
    }
  }
  if (current) {
    merged.push(current);
  }
  return merged;
}

// Check teacher burden daily limit and consecutive limits
function canTeacherTakeSlot(teacherId, day, slotIdx, teacherBusy, daySlots) {
  const tIdStr = teacherId.toString();
  
  // 1. Check if teacher is already busy during this slot
  if (teacherBusy[tIdStr]?.[day]?.[slotIdx]) {
    return false;
  }

  // 2. Check daily burden: Cap at 3 periods of active teaching per day to avoid burnout
  const dailySlotsTaught = (teacherBusy[tIdStr]?.[day] || []).filter(Boolean).length;
  if (dailySlotsTaught + 1 > 3) {
    return false;
  }

  // 3. Check consecutive burden: Max 3 consecutive lectures
  let consecutiveCount = 1;
  let step = 1;
  while (slotIdx - step >= 0 && teacherBusy[tIdStr]?.[day]?.[slotIdx - step]) {
    consecutiveCount++;
    step++;
  }
  step = 1;
  while (slotIdx + step < daySlots.length && teacherBusy[tIdStr]?.[day]?.[slotIdx + step]) {
    consecutiveCount++;
    step++;
  }

  if (consecutiveCount > 3) {
    return false;
  }

  return true;
}

// ─── Get / Save Config ────────────────────────────────────────────────────────

exports.getConfig = async (req, res) => {
  try {
    const config = await TimetableConfig.findOne({ schoolId: req.user.schoolId });
    res.json({ config: config || null });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.saveConfig = async (req, res) => {
  try {
    const { schoolStartTime, schoolEndTime, lectureDurationMinutes, workingDays, breaks, academicYear } = req.body;
    const config = await TimetableConfig.findOneAndUpdate(
      { schoolId: req.user.schoolId },
      { schoolStartTime, schoolEndTime, lectureDurationMinutes, workingDays, breaks, academicYear },
      { upsert: true, new: true }
    );
    res.json({ config });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── Get Timetable for a class ─────────────────────────────────────────────

exports.getTimetable = async (req, res) => {
  try {
    const { classId } = req.params;
    const timetables = await Timetable.find({ schoolId: req.user.schoolId, classId })
      .populate('slots.subjectId', 'name code')
      .populate('slots.teacherId', 'name')
      .sort({ dayOfWeek: 1 });
    res.json({ timetables });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getAllTimetables = async (req, res) => {
  try {
    const timetables = await Timetable.find({ schoolId: req.user.schoolId })
      .populate('classId', 'standard division')
      .populate('slots.subjectId', 'name code')
      .populate('slots.teacherId', 'name');
    res.json({ timetables });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── Auto-Generate Timetable ──────────────────────────────────────────────────

exports.generateTimetable = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { standards } = req.body;

    const config = await TimetableConfig.findOne({ schoolId });
    if (!config) return res.status(400).json({ message: 'Please save school timing configuration first.' });

    let classQuery = { schoolId };
    if (standards && standards.length > 0) classQuery.standard = { $in: standards.map(String) };
    const classes = await Class.find(classQuery);
    if (!classes.length) return res.status(400).json({ message: 'No classes found.' });

    const teachers = await Teacher.find({ schoolId });
    const subjects = await Subject.find({ schoolId });
    const daySlots = buildDaySlots(config);
    if (!daySlots.length) return res.status(400).json({ message: 'No lecture slots could be built.' });

    // Teacher busy matrix: teacherBusy[teacherId][day][slotIdx] = boolean
    const teacherBusy = {};
    for (const t of teachers) {
      teacherBusy[t._id.toString()] = {};
      for (const day of config.workingDays) {
        teacherBusy[t._id.toString()][day] = new Array(daySlots.length).fill(false);
      }
    }

    // Build per-class requirements
    const classNeeds = {};
    for (const cls of classes) {
      const needs = [];
      for (const subject of subjects) {
        const perStd = subject.lecturesPerStandard?.find(l => l.standard.toString() === cls.standard.toString());
        const totalYearlyLectures = perStd ? (perStd.totalPortionLectures || 40) : 40;
        
        const assignedTeacher = teachers.find(t =>
          t.subjectClassAssignments && t.subjectClassAssignments.some(a =>
            a.classId?.toString() === cls._id.toString() &&
            a.subjectId?.toString() === subject._id.toString()
          )
        );

        if (assignedTeacher) {
          // Calculate baseline weekly lectures assuming a 30-week school year
          let weeklyCount = Math.ceil(totalYearlyLectures / 30);
          
          // Adjust weekly lectures dynamically based on the teacher's total class/subject assignments to avoid burdening them
          const teacherLoad = assignedTeacher.subjectClassAssignments ? assignedTeacher.subjectClassAssignments.length : 1;
          if (teacherLoad >= 6) {
            weeklyCount = Math.max(1, Math.round(weeklyCount * 0.5));
          } else if (teacherLoad >= 4) {
            weeklyCount = Math.max(1, Math.round(weeklyCount * 0.7));
          } else if (teacherLoad >= 3) {
            weeklyCount = Math.max(2, Math.round(weeklyCount * 0.85));
          }

          if (weeklyCount > 0) {
            const getStandardPriority = (stdStr) => {
              const num = parseInt(stdStr.replace(/\D/g, ''), 10);
              if (isNaN(num)) return 1;
              if (num >= 9) return num * 10; // high standards (9, 10, 11, 12) get highest priority
              return num;
            };
            const stdPriority = getStandardPriority(cls.standard || '1');
            const calculatedWeightage = totalYearlyLectures * stdPriority;

            needs.push({
              subjectId: subject._id,
              teacherId: assignedTeacher._id,
              weeklyCount,
              remaining: weeklyCount,
              weightage: calculatedWeightage,
            });
          }
        }
      }
      needs.sort((a, b) => b.weightage - a.weightage);
      classNeeds[cls._id.toString()] = needs;
    }

    // Generate slots per class per day
    const generated = {};
    for (const cls of classes) {
      generated[cls._id.toString()] = {};
      for (const day of config.workingDays) {
        generated[cls._id.toString()][day] = new Array(daySlots.length).fill(null);
      }
    }

    // First pass: Allocate standard weekly lectures
    for (const day of config.workingDays) {
      for (const cls of classes) {
        const clsId = cls._id.toString();
        const needs = classNeeds[clsId];
        
        for (let slotIdx = 0; slotIdx < daySlots.length; slotIdx++) {
          if (daySlots[slotIdx].type === 'break') continue;
          if (generated[clsId][day][slotIdx]) continue;

          for (const need of needs) {
            if (need.remaining <= 0) continue;
            
            const tIdStr = need.teacherId.toString();

            // Check if teacher is free & has consecutive/daily free slots
            const teacherFree = canTeacherTakeSlot(need.teacherId, day, slotIdx, teacherBusy, daySlots);
            if (!teacherFree) continue;

            // Allocate slot
            generated[clsId][day][slotIdx] = {
              startTime: daySlots[slotIdx].startTime,
              endTime: daySlots[slotIdx].endTime,
              subjectId: need.subjectId,
              teacherId: need.teacherId,
            };
            if (teacherBusy[tIdStr]) {
              teacherBusy[tIdStr][day][slotIdx] = true;
            }

            need.remaining--;
            break;
          }
        }
      }
    }

    // Second pass: Backfill remaining empty lecture slots so students have ZERO free periods
    for (const day of config.workingDays) {
      for (const cls of classes) {
        const clsId = cls._id.toString();
        const needs = classNeeds[clsId];

        for (let slotIdx = 0; slotIdx < daySlots.length; slotIdx++) {
          if (daySlots[slotIdx].type === 'break') continue;
          if (generated[clsId][day][slotIdx]) continue;

          // Find candidate teachers for this class who are physically free at this slot
          const candidates = [];
          for (const need of needs) {
            const tIdStr = need.teacherId.toString();
            // Check if teacher is teaching another class at this exact slot (clash check)
            let physicallyClashed = false;
            for (const otherCls of classes) {
              const otherClsId = otherCls._id.toString();
              if (generated[otherClsId]?.[day]?.[slotIdx]?.teacherId?.toString() === tIdStr) {
                physicallyClashed = true;
                break;
              }
            }
            if (!physicallyClashed) {
              const dailyLoad = (teacherBusy[tIdStr]?.[day] || []).filter(Boolean).length;
              candidates.push({ need, dailyLoad });
            }
          }

          if (candidates.length > 0) {
            // Sort candidates by daily load (lowest load first)
            candidates.sort((a, b) => a.dailyLoad - b.dailyLoad);
            const bestCandidate = candidates[0].need;
            const tIdStr = bestCandidate.teacherId.toString();

            generated[clsId][day][slotIdx] = {
              startTime: daySlots[slotIdx].startTime,
              endTime: daySlots[slotIdx].endTime,
              subjectId: bestCandidate.subjectId,
              teacherId: bestCandidate.teacherId,
            };
            if (teacherBusy[tIdStr]) {
              teacherBusy[tIdStr][day][slotIdx] = true;
            }
          }
        }
      }
    }

    // Persist
    const classIds = classes.map(c => c._id);
    await Timetable.deleteMany({ schoolId, classId: { $in: classIds } });
    const docs = [];
    for (const cls of classes) {
      for (const day of config.workingDays) {
        const rawSlots = generated[cls._id.toString()][day];
        const finalSlots = [];

        for (let i = 0; i < daySlots.length; i++) {
          const ds = daySlots[i];
          if (ds.type === 'break') {
            finalSlots.push({
              startTime: ds.startTime,
              endTime: ds.endTime,
              isBreak: true,
              breakName: ds.name
            });
          } else {
            const gen = rawSlots[i];
            if (gen) {
              finalSlots.push({
                startTime: ds.startTime,
                endTime: ds.endTime,
                subjectId: gen.subjectId,
                teacherId: gen.teacherId
              });
            }
          }
        }

        docs.push({
          schoolId,
          classId: cls._id,
          dayOfWeek: day,
          slots: finalSlots,
          academicYear: config.academicYear,
          isActive: true,
        });
      }
    }
    await Timetable.insertMany(docs);

    res.json({ message: 'Timetable generated successfully!', classesProcessed: classes.length, slotsPerDay: daySlots.length });
  } catch (e) {
    console.error('Timetable generation error:', e);
    res.status(500).json({ message: e.message });
  }
};
