const User = require('../models/User');

// @desc    Assign panel to student
// @route   POST /api/matching/assign
// @access  Private (Admin only)
exports.assignPanelToStudent = async (req, res) => {
  try {
    const { studentId, panelId } = req.body;

    const student = await User.findById(studentId);
    const panel = await User.findById(panelId);

    if (!student || !panel) {
      return res.status(404).json({
        success: false,
        message: 'Student or panel not found',
      });
    }

    // Add to both sides
    if (!student.assignedPanels.includes(panelId)) {
      student.assignedPanels.push(panelId);
      await student.save();
    }

    if (!panel.assignedStudents.includes(studentId)) {
      panel.assignedStudents.push(studentId);
      await panel.save();
    }

    res.json({
      success: true,
      message: 'Panel assigned to student successfully',
    });
  } catch (error) {
    console.error('Assign error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning panel',
    });
  }
};

// @desc    Get my assigned students (for panel)
// @route   GET /api/matching/my-students
// @access  Private (Panel)
exports.getMyStudents = async (req, res) => {
  try {
    const panel = await User.findById(req.user._id)
      .populate('assignedStudents', 'name matricNumber program researchTitle');

    res.json({
      success: true,
      students: panel.assignedStudents || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
    });
  }
};

// @desc    Get my assigned panels (for student)
// @route   GET /api/matching/my-panels
// @access  Private (Student)
exports.getMyPanels = async (req, res) => {
  try {
    const student = await User.findById(req.user._id)
      .populate('assignedPanels', 'name email');

    res.json({
      success: true,
      panels: student.assignedPanels || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching panels',
    });
  }
};