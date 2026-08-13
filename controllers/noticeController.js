const Notice = require('../models/Notice');

// Create Notice
exports.createNotice = async (req, res) => {
  try {
    const { title, category, content, targetAudience, targetClassId, isPinned, priority, attachments, visibleDays } = req.body;

    let expiresAt = undefined;
    if (visibleDays && Number(visibleDays) > 0) {
      expiresAt = new Date(Date.now() + Number(visibleDays) * 24 * 60 * 60 * 1000);
    }

    const notice = await Notice.create({
      schoolId: req.user.schoolId,
      title,
      category: category || 'General',
      content,
      createdBy: req.user.userId,
      createdByModel: req.user.role === 'teacher' ? 'Teacher' : 'User',
      targetAudience,
      targetClassId,
      isPinned,
      priority,
      attachments: attachments || [],
      expiresAt,
    });

    res.status(201).json({
      message: 'Notice created successfully',
      notice,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Notices
exports.getAllNotices = async (req, res) => {
  try {
    const { page = 1, limit = 10, isPinned } = req.query;
    let query = { schoolId: req.user.schoolId };

    if (isPinned !== undefined) query.isPinned = isPinned === 'true';

    const notices = await Notice.find(query)
      .populate('createdBy', 'name')
      .populate('examId')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ isPinned: -1, createdAt: -1 });

    const validNotices = [];
    for (const notice of notices) {
      if (notice.category === 'Exam' && notice.populated('examId') && !notice.examId) {
        Notice.findByIdAndDelete(notice._id).catch(err => console.error("Error deleting orphaned notice:", err));
      } else {
        validNotices.push(notice);
      }
    }

    const total = await Notice.countDocuments(query);

    res.json({
      notices: validNotices,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Notices for User
exports.getNoticesForUser = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.userId;

    let query = {
      schoolId: req.user.schoolId,
      $or: [
        { targetAudience: 'All' },
        { targetUserId: userId },
      ],
    };

    // Add role-based filters
    if (req.user.role === 'student') {
      query.$or.push({ targetAudience: 'Students' });
    } else if (req.user.role === 'teacher') {
      query.$or.push({ targetAudience: 'Teachers' });
    }

    const notices = await Notice.find(query)
      .populate('createdBy', 'name')
      .populate('examId')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ isPinned: -1, createdAt: -1 });

    const validNotices = [];
    for (const notice of notices) {
      if (notice.category === 'Exam' && notice.populated('examId') && !notice.examId) {
        Notice.findByIdAndDelete(notice._id).catch(err => console.error("Error deleting orphaned notice:", err));
      } else {
        validNotices.push(notice);
      }
    }

    res.json({
      notices: validNotices,
      pagination: {
        total: await Notice.countDocuments(query),
        pages: Math.ceil((await Notice.countDocuments(query)) / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Notice
exports.updateNotice = async (req, res) => {
  try {
    const notice = await Notice.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy');

    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    res.json({
      message: 'Notice updated successfully',
      notice,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Notice
exports.deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    // Clean up uploaded documents in Cloudinary
    try {
      const { deleteCloudinaryFile } = require('../utils/cloudinaryHelper');
      if (notice.attachments && notice.attachments.length > 0) {
        for (const url of notice.attachments) {
          if (url) {
            await deleteCloudinaryFile(url);
          }
        }
      }
    } catch (cldErr) {
      console.error('Cloudinary cleanup error during notice delete:', cldErr);
    }

    res.json({ message: 'Notice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark Notice as Read
exports.markNoticeAsRead = async (req, res) => {
  try {
    const notice = await Notice.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      {
        $addToSet: {
          viewedBy: {
            userId: req.user.userId,
            viewedDate: new Date(),
          },
        },
      },
      { new: true }
    );

    res.json({ message: 'Notice marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
