const Complaint = require('../models/Complaint');

// Create Complaint
exports.createComplaint = async (req, res) => {
  try {
    const { title, description, category, priority, attachments } = req.body;

    const raisedByModel = req.user.role === 'admin' ? 'User' : (req.user.role === 'teacher' ? 'Teacher' : 'Student');

    const complaint = await Complaint.create({
      schoolId: req.user.schoolId,
      raisedBy: req.user.userId,
      raisedByModel,
      title,
      description,
      category,
      priority,
      attachments: attachments || [],
    });

    res.status(201).json({
      message: 'Grievance raised successfully',
      complaint,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Complaints
exports.getAllComplaints = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    const query = { schoolId: req.user.schoolId };

    if (status) query.status = status;
    if (category) query.category = category;

    const complaints = await Complaint.find(query)
      .populate('raisedBy', 'name email role')
      .populate('assignedTo', 'name email')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Complaint.countDocuments(query);

    res.json({
      complaints,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get My Complaints
exports.getMyComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const complaints = await Complaint.find({
      raisedBy: req.user.userId,
      schoolId: req.user.schoolId,
    })
      .populate('assignedTo', 'name email')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Complaint.countDocuments({
      raisedBy: req.user.userId,
      schoolId: req.user.schoolId,
    });

    res.json({
      complaints,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Assign Complaint
exports.assignComplaint = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const User = require('../models/User');
    const isUser = await User.exists({ _id: assignedTo });
    const assignedToModel = isUser ? 'User' : 'Teacher';

    const complaint = await Complaint.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      {
        assignedTo,
        assignedToModel,
        status: 'In Progress',
      },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json({
      message: 'Complaint assigned successfully',
      complaint,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Resolve Complaint
exports.resolveComplaint = async (req, res) => {
  try {
    const { resolution } = req.body;

    const complaint = await Complaint.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      {
        status: 'Resolved',
        resolution,
        resolvedDate: new Date(),
      },
      { new: true }
    ).populate('raisedBy', 'name email');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json({
      message: 'Complaint resolved successfully',
      complaint,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add Comment to Complaint
exports.addComment = async (req, res) => {
  try {
    const { comment } = req.body;

    const commentUserRole = req.user.role;
    const userModel = commentUserRole === 'admin' ? 'User' : (commentUserRole === 'teacher' ? 'Teacher' : 'Student');

    const complaint = await Complaint.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      {
        $push: {
          comments: {
            userId: req.user.userId,
            userModel,
            comment,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate('comments.userId', 'name');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json({
      message: 'Comment added successfully',
      complaint,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Complaint Status (Under Process or Resolved/Completed)
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { status, resolution } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (resolution !== undefined) updateData.resolution = resolution;
    if (status === 'Resolved') {
      updateData.resolvedDate = new Date();
    }

    const complaint = await Complaint.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: req.user.schoolId,
      },
      updateData,
      { new: true }
    ).populate('raisedBy', 'name email role');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json({
      message: `Complaint status updated successfully to ${status}`,
      complaint,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
