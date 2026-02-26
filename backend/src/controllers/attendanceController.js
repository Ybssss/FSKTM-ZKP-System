const Attendance = require('../models/Attendance');
const Timetable = require('../models/Timetable');
const User = require('../models/User');

// @desc    Mark attendance (manual or QR)
// @route   POST /api/attendance
// @access  Private (Panel, Admin)
exports.markAttendance = async (req, res) => {
  try {
    const { timetableId, studentId, verificationMethod = 'manual', notes, status = 'present' } = req.body;

    console.log('📝 Marking attendance:', { timetableId, studentId, verificationMethod, status });

    // Validate required fields
    if (!timetableId || !studentId) {
      return res.status(400).json({
        success: false,
        message: 'Timetable ID and Student ID are required',
      });
    }

    // Check if timetable exists
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      console.log('❌ Timetable not found:', timetableId);
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found',
      });
    }

    // Check if student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      console.log('❌ Student not found:', studentId);
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if already marked
    const existing = await Attendance.findOne({ timetableId, studentId });
    if (existing) {
      console.log('⚠️  Attendance already marked');
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for this session',
        attendance: existing,
      });
    }

    // Create attendance record
    const attendance = await Attendance.create({
      studentId,
      timetableId,
      checkInTime: new Date(),
      status,
      verificationMethod,
      notes: notes || `Marked by ${req.user.name}`,
    });

    console.log('✅ Attendance marked successfully');

    // Populate the response
    const populated = await Attendance.findById(attendance._id)
      .populate('studentId', 'name matricNumber')
      .populate('timetableId', 'sessionType date venue');

    res.status(201).json({
      success: true,
      attendance: populated,
    });
  } catch (error) {
    console.error('❌ Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: error.message,
    });
  }
};

// @desc    Get attendance by timetable
// @route   GET /api/attendance/timetable/:id
// @access  Private
exports.getAttendanceByTimetable = async (req, res) => {
  try {
    console.log('🔍 Fetching attendance for timetable:', req.params.id);

    const attendances = await Attendance.find({ timetableId: req.params.id })
      .populate('studentId', 'name matricNumber email')
      .sort({ checkInTime: -1 });

    console.log(`✅ Found ${attendances.length} attendance records`);

    res.json({
      success: true,
      count: attendances.length,
      attendances,
    });
  } catch (error) {
    console.error('❌ Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance',
      error: error.message,
    });
  }
};

// @desc    Get my attendance (student)
// @route   GET /api/attendance/my
// @access  Private (Student)
exports.getMyAttendance = async (req, res) => {
  try {
    console.log('🔍 Fetching attendance for student:', req.user.name);

    const attendances = await Attendance.find({ studentId: req.user._id })
      .populate('timetableId', 'sessionType date venue startTime endTime')
      .sort({ checkInTime: -1 });

    console.log(`✅ Found ${attendances.length} attendance records`);

    res.json({
      success: true,
      count: attendances.length,
      attendances,
    });
  } catch (error) {
    console.error('❌ Get my attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance',
      error: error.message,
    });
  }
};

// @desc    Update attendance status
// @route   PUT /api/attendance/:id
// @access  Private (Panel, Admin)
exports.updateAttendance = async (req, res) => {
  try {
    const { status, notes } = req.body;

    console.log('📝 Updating attendance:', req.params.id);

    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true, runValidators: true }
    )
      .populate('studentId', 'name matricNumber')
      .populate('timetableId', 'sessionType date');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    console.log('✅ Attendance updated');

    res.json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error('❌ Update attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating attendance',
      error: error.message,
    });
  }
};

// @desc    Delete attendance
// @route   DELETE /api/attendance/:id
// @access  Private (Admin)
exports.deleteAttendance = async (req, res) => {
  try {
    console.log('🗑️  Deleting attendance:', req.params.id);

    const attendance = await Attendance.findByIdAndDelete(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    console.log('✅ Attendance deleted');

    res.json({
      success: true,
      message: 'Attendance record deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting attendance',
      error: error.message,
    });
  }
};

// @desc    Get attendance statistics
// @route   GET /api/attendance/stats
// @access  Private
exports.getAttendanceStats = async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;

    console.log('📊 Calculating attendance statistics');

    const filter = {};
    
    if (studentId) {
      filter.studentId = studentId;
    }

    if (startDate && endDate) {
      filter.checkInTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const total = await Attendance.countDocuments(filter);
    const present = await Attendance.countDocuments({ ...filter, status: 'present' });
    const late = await Attendance.countDocuments({ ...filter, status: 'late' });
    const absent = await Attendance.countDocuments({ ...filter, status: 'absent' });
    const excused = await Attendance.countDocuments({ ...filter, status: 'excused' });

    const stats = {
      total,
      present,
      late,
      absent,
      excused,
      attendanceRate: total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0,
    };

    console.log('✅ Statistics calculated:', stats);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating statistics',
      error: error.message,
    });
  }
};
