const AcademicYear = require('../models/AcademicYear');

// Create or Update

exports.createOrUpdateAcademicYear = async (req, res) => {
  try {
    const { yearId, year, startDate, endDate, isActive = false } = req.body;
    const schoolId = req.user.schoolId;

    // Prevent duplicate year
    const duplicate = await AcademicYear.findOne({
      schoolId,
      year,
      ...(yearId && { _id: { $ne: yearId } }),
    });

    if (duplicate)
      return res.status(409).json({ message: 'Academic year already exists' });

    // If active, deactivate other years
    if (isActive)
      await AcademicYear.updateMany(
        { schoolId, ...(yearId && { _id: { $ne: yearId } }) },
        { $set: { isActive: false } }
      );

    const data = { year, startDate, endDate, isActive, schoolId };

    const academicYear = yearId
      ? await AcademicYear.findOneAndUpdate(
          { _id: yearId, schoolId },
          data,
          { new: true, runValidators: true }
        )
      : await AcademicYear.create(data);

    if (!academicYear)
      return res.status(404).json({ message: 'Academic year not found' });

    res.status(yearId ? 200 : 201).json({
      message: yearId ? 'Year updated' : 'Year created',
      academicYear,
    });
  } catch (err) {
    console.error('Academic Year Error:', err);
    res.status(500).json({ message: err.message });
  }
};



// Get All

exports.getAcademicYears = async (req, res) => {
  try {
    const academicYears = await AcademicYear.find({
      schoolId: req.user.schoolId,
    }).sort({ createdAt: -1 });

    res.status(200).json({ academicYears });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// Delete
exports.deleteAcademicYear = async (req, res) => {
  try {
    const { yearId } = req.params;

    const year = await AcademicYear.findOne({
      _id: yearId,
      schoolId: req.user.schoolId,
    });

    if (!year) {
      return res.status(404).json({ message: 'Year not found' });
    }

    if (year.isActive) {
      return res.status(400).json({ message: 'Cannot delete active year' });
    }

    await AcademicYear.findByIdAndDelete(yearId);
    res.json({ message: 'Year deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};