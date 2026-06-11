const QRCode = require("qrcode");
const crypto = require("crypto");
const Timetable = require("../models/Timetable");
const Attendance = require("../models/Attendance");

const cleanAttendanceCode = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "");

const parseAttendanceInput = (body = {}) => {
  const rawValue =
    body.token ||
    body.code ||
    body.pin ||
    body.attendanceCode ||
    body.qrToken ||
    body.rawValue ||
    body.value ||
    body.data ||
    "";

  let timetableId = body.timetableId || body.sessionId || "";
  let submittedToken = cleanAttendanceCode(rawValue);

  if (!submittedToken) {
    return { timetableId, submittedToken };
  }

  try {
    const parsed = JSON.parse(submittedToken);
    if (parsed && typeof parsed === "object") {
      timetableId = timetableId || parsed.timetableId || parsed.sessionId || "";
      submittedToken = cleanAttendanceCode(parsed.token || parsed.code || parsed.pin);
    }
  } catch (_) {
    // Plain PIN or URL, continue.
  }

  if (!submittedToken) {
    return { timetableId, submittedToken };
  }

  try {
    const parsedUrl = new URL(submittedToken);
    timetableId =
      timetableId ||
      parsedUrl.searchParams.get("timetableId") ||
      parsedUrl.searchParams.get("sessionId") ||
      "";
    submittedToken = cleanAttendanceCode(
      parsedUrl.searchParams.get("token") ||
        parsedUrl.searchParams.get("code") ||
        parsedUrl.searchParams.get("pin"),
    );
  } catch (_) {
    // Not a URL.
  }

  return { timetableId, submittedToken };
};

exports.generateQRCode = async (req, res) => {
  if (!["admin", "panel"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only admin or panel can generate attendance QR codes.",
    });
  }
  try {
    const { timetableId } = req.params;

    const timetable = await Timetable.findById(timetableId)
      .populate("students", "name matricNumber email")
      .populate("panels", "name email userId");

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable entry not found",
      });
    }

    const isAssignedPanel = Array.isArray(timetable.panels)
      ? timetable.panels.some(
          (panel) => String(panel._id || panel) === String(req.user.id),
        )
      : false;

    if (req.user.role === "panel" && !isAssignedPanel) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this session.",
      });
    }

    const token = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const qrData = JSON.stringify({
      type: "FSKTM_ATTENDANCE",
      timetableId: String(timetable._id),
      token,
      expiresAt: expiresAt.toISOString(),
    });

    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: "H",
      type: "image/png",
      quality: 0.95,
      margin: 1,
      width: 300,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Persist the token on the timetable so later verification can compare the scanned payload.
    timetable.qrCode = token;
    timetable.qrExpiresAt = expiresAt;
    timetable.qrGeneratedAt = new Date();
    await timetable.save();

    res.json({
      success: true,
      qrCode: qrCodeDataURL,
      token,
      expiresAt,
      timetable: {
        id: timetable._id,
        sessionType: timetable.sessionType,
        date: timetable.date,
        venue: timetable.venue,
        student: timetable.students?.[0]?.name || "",
      },
    });
  } catch (error) {
    console.error("Generate QR code error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating QR code",
      error: error.message,
    });
  }
};

exports.verifyQRCode = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can mark attendance using QR code.",
      });
    }

    const studentId = req.user.id;
    const { timetableId, submittedToken } = parseAttendanceInput(req.body);

    if (!submittedToken) {
      return res.status(400).json({
        success: false,
        message: "Attendance code or QR token is required.",
      });
    }

    const query = timetableId
      ? { _id: timetableId, qrCode: submittedToken, students: studentId }
      : { qrCode: submittedToken, students: studentId };

    const timetable = await Timetable.findOne(query).sort({
      qrGeneratedAt: -1,
    });

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired attendance QR code.",
      });
    }

    if (
      timetable.qrExpiresAt &&
      new Date(timetable.qrExpiresAt).getTime() < Date.now()
    ) {
      return res.status(401).json({
        success: false,
        message: "Attendance QR code has expired.",
      });
    }

    const assignedStudentIds = Array.isArray(timetable.students)
      ? timetable.students.map((id) => String(id))
      : [];

    if (!assignedStudentIds.includes(String(studentId))) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this session.",
      });
    }

    const existing = await Attendance.findOne({
      timetableId: timetable._id,
      studentId,
    })
      .populate("studentId", "name matricNumber email")
      .populate(
        "timetableId",
        "title sessionType date startTime endTime venue",
      );

    if (existing) {
      return res.json({
        success: true,
        message: "Attendance already marked for this session.",
        attendance: existing,
      });
    }

    const attendance = await Attendance.create({
      studentId,
      timetableId: timetable._id,
      checkInTime: new Date(),
      status: "present",
      verificationMethod: "qr-code",
      notes: "Marked by student QR scan",
    });

    const populated = await Attendance.findById(attendance._id)
      .populate("studentId", "name matricNumber email")
      .populate(
        "timetableId",
        "title sessionType date startTime endTime venue",
      );

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully.",
      attendance: populated,
    });
  } catch (error) {
    console.error("Verify QR code error:", error);

    if (error.code === 11000) {
      return res.json({
        success: true,
        message: "Attendance already marked for this session.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error verifying QR code.",
      error: error.message,
    });
  }
};

exports.getQRCode = async (req, res) => {
  try {
    const { timetableId } = req.params;

    const timetable = await Timetable.findById(timetableId);

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable entry not found",
      });
    }

    if (!timetable.qrCode) {
      return res.status(404).json({
        success: false,
        message: "QR code not generated yet",
      });
    }

    // Rebuild the same payload so the client can display the current QR code again.
    const qrData = JSON.stringify({
      type: "FSKTM_ATTENDANCE",
      timetableId: String(timetable._id),
      token: timetable.qrCode,
      expiresAt: timetable.qrExpiresAt?.toISOString?.() || null,
    });

    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: "H",
      type: "image/png",
      quality: 0.95,
      margin: 1,
      width: 300,
    });

    res.json({
      success: true,
      qrCode: qrCodeDataURL,
      token: timetable.qrCode,
      expiresAt: timetable.qrExpiresAt,
    });
  } catch (error) {
    console.error("Get QR code error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving QR code",
      error: error.message,
    });
  }
};
