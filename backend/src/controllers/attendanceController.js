const Attendance = require("../models/Attendance");
const Timetable = require("../models/Timetable");
const User = require("../models/User");

const toSessionBoundary = (dateValue, timeValue, fallbackHour = 23, fallbackMinute = 59) => {
  const boundary = new Date(dateValue);

  if (Number.isNaN(boundary.getTime())) {
    return null;
  }

  const parsedTime = String(timeValue || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);

  if (!parsedTime) {
    boundary.setHours(fallbackHour, fallbackMinute, 59, 999);
    return boundary;
  }

  let [, rawHours, rawMinutes, meridiem] = parsedTime;
  let hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (meridiem) {
    const upperMeridiem = meridiem.toUpperCase();
    if (upperMeridiem === "PM" && hours < 12) hours += 12;
    if (upperMeridiem === "AM" && hours === 12) hours = 0;
  }

  boundary.setHours(hours, minutes, 59, 999);
  return boundary;
};

const buildDerivedAbsentRecord = (studentId, timetable) => ({
  _id: `derived-absent-${timetable._id}`,
  studentId,
  timetableId: timetable,
  checkInTime: null,
  status: "absent",
  verificationMethod: "automatic",
  notes: "No attendance was recorded for this completed session.",
  createdAt: timetable.date,
  updatedAt: timetable.date,
  isDerivedAbsent: true,
});

exports.markAttendance = async (req, res) => {
  if (!["admin", "panel"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only admin or panel can mark attendance manually.",
    });
  }
  try {
    const {
      timetableId,
      studentId,
      verificationMethod = "manual",
      notes,
      status = "present",
    } = req.body;

    if (!timetableId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Timetable ID and Student ID are required",
      });
    }

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable entry not found",
      });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const existing = await Attendance.findOne({ timetableId, studentId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked for this session",
        attendance: existing,
      });
    }

    const attendance = await Attendance.create({
      studentId,
      timetableId,
      checkInTime: new Date(),
      status,
      verificationMethod,
      notes: notes || `Marked by ${req.user.name}`,
    });

    const populated = await Attendance.findById(attendance._id)
      .populate("studentId", "name matricNumber")
      .populate("timetableId", "sessionType date venue");

    res.status(201).json({
      success: true,
      attendance: populated,
    });
  } catch (error) {
    console.error("Mark attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Error marking attendance",
      error: error.message,
    });
  }
};

exports.getAttendanceByTimetable = async (req, res) => {
  try {
    const attendances = await Attendance.find({ timetableId: req.params.id })
      .populate("studentId", "name matricNumber email")
      .sort({ checkInTime: -1 });

    res.json({
      success: true,
      count: attendances.length,
      attendances,
    });
  } catch (error) {
    console.error("Get attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching attendance",
      error: error.message,
    });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    const now = new Date();

    const [attendances, completedTimetables] = await Promise.all([
      Attendance.find({ studentId })
        .populate({
          path: "timetableId",
          select: "sessionType title batchName date venue startTime endTime rubricId",
          populate: { path: "rubricId", select: "name" },
        })
        .sort({ checkInTime: -1 })
        .lean(),
      Timetable.find({ students: studentId })
        .populate("rubricId", "name")
        .lean(),
    ]);

    const attendanceByTimetableId = new Map(
      attendances
        .filter((record) => record?.timetableId?._id)
        .map((record) => [String(record.timetableId._id), record]),
    );

    const derivedAbsentRecords = completedTimetables
      .filter((timetable) => timetable?._id)
      .filter((timetable) => !attendanceByTimetableId.has(String(timetable._id)))
      .filter((timetable) => {
        const sessionBoundary = toSessionBoundary(
          timetable.date,
          timetable.endTime || timetable.startTime,
        );
        return sessionBoundary && sessionBoundary <= now;
      })
      .map((timetable) => buildDerivedAbsentRecord(studentId, timetable));

    const mergedAttendances = [...attendances, ...derivedAbsentRecords].sort(
      (left, right) => {
        const leftTime = new Date(
          left.checkInTime || left.timetableId?.date || left.createdAt || 0,
        ).getTime();
        const rightTime = new Date(
          right.checkInTime || right.timetableId?.date || right.createdAt || 0,
        ).getTime();
        return rightTime - leftTime;
      },
    );

    res.json({
      success: true,
      count: mergedAttendances.length,
      attendances: mergedAttendances,
    });
  } catch (error) {
    console.error("Get my attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching attendance",
      error: error.message,
    });
  }
};

exports.updateAttendance = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true, runValidators: true },
    )
      .populate("studentId", "name matricNumber")
      .populate("timetableId", "sessionType date");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error("Update attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating attendance",
      error: error.message,
    });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Delete attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting attendance",
      error: error.message,
    });
  }
};

exports.getAttendanceStats = async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;

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
    const present = await Attendance.countDocuments({
      ...filter,
      status: "present",
    });
    const late = await Attendance.countDocuments({ ...filter, status: "late" });
    const absent = await Attendance.countDocuments({
      ...filter,
      status: "absent",
    });
    const excused = await Attendance.countDocuments({
      ...filter,
      status: "excused",
    });

    const stats = {
      total,
      present,
      late,
      absent,
      excused,
      attendanceRate:
        total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0,
    };

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get attendance stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating statistics",
      error: error.message,
    });
  }
};
