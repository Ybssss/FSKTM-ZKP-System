const Timetable = require("../models/Timetable");
const User = require("../models/User");
const Evaluation = require("../models/Evaluation");
const cleanText = (value = "", max = 500) =>
  String(value)
    .normalize("NFKC")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const cleanArray = (value) =>
  Array.isArray(value) ? value.filter(Boolean) : [];

const allowedSessionTypes = [
  "PROPOSAL_DEFENSE",
  "PROGRESS_ASSESSMENT",
  "PRE_VIVA",
];

const allowedSessionStatuses = [
  "scheduled",
  "ongoing",
  "completed",
  "cancelled",
];

const DEFAULT_BREAK_MINUTES = 5;

const toPositiveInt = (value, fallback = null) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNonNegativeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizeDateOnly = (value) => {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) return "";

  return raw.includes("T") ? raw.slice(0, 10) : raw;
};

const parseTimeToMinutes = (timeValue) => {
  const raw = String(timeValue || "").trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
};

const formatMinutesToTime = (minutes) => {
  const normalizedMinutes = minutes % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const ensureNotBackdated = (dateValue, startTime) => {
  const dateOnly = normalizeDateOnly(dateValue);
  const startMinutes = parseTimeToMinutes(startTime);

  if (!dateOnly) {
    throw new Error("Session date is required.");
  }

  if (startMinutes === null) {
    throw new Error("Valid session start time is required.");
  }

  const sessionStart = new Date(`${dateOnly}T${startTime}:00`);

  if (Number.isNaN(sessionStart.getTime())) {
    throw new Error("Invalid session date or start time.");
  }

  if (sessionStart <= new Date()) {
    throw new Error(
      "Session cannot be scheduled in the past. Today is allowed only if the start time is still in the future.",
    );
  }
};

const buildPendingEvaluations = (timetable, payload, semester) => {
  const studentId = payload.students?.[0];

  if (!studentId || !Array.isArray(payload.panels)) return [];

  return payload.panels.filter(Boolean).map((evaluatorId) => ({
    sessionId: timetable._id,
    studentId,
    evaluatorId,
    rubricId: payload.rubricId,
    semester: semester || payload.semester || "",
    sessionType: payload.sessionType,
    status: "PENDING",
  }));
};

const buildTimetablePayload = (body, userId) => {
  const sessionType = cleanText(body.sessionType, 50);

  if (!allowedSessionTypes.includes(sessionType)) {
    throw new Error("Invalid session type.");
  }

  const status = allowedSessionStatuses.includes(body.status)
    ? body.status
    : "scheduled";

  const date = normalizeDateOnly(body.date);
  const startTime = cleanText(body.startTime || body.time, 20);
  const slotDuration = toPositiveInt(body.slotDurationMinutes, null);
  let endTime = cleanText(body.endTime, 20);

  if (!endTime && slotDuration) {
    const startMinutes = parseTimeToMinutes(startTime);
    if (startMinutes !== null) {
      endTime = formatMinutesToTime(startMinutes + slotDuration);
    }
  }

  if (!endTime) {
    throw new Error(
      "Session end time is required or slot duration must be provided.",
    );
  }

  ensureNotBackdated(date, startTime);

  const meetingLink = cleanText(body.googleMeetLink || body.venue, 500);
  const batchName = cleanText(body.batchName || "", 100);

  return {
    sessionType,
    title: cleanText(body.title || `${sessionType} Session`, 150),
    description: cleanText(body.description || "", 1000),
    date,
    startTime,
    endTime,
    venue: meetingLink,
    googleMeetLink: meetingLink,
    batchName,
    batchId: cleanText(body.batchId || batchName, 120),
    slotDurationMinutes: slotDuration,
    breakBetweenSlotsMinutes: toNonNegativeInt(
      body.breakBetweenSlotsMinutes,
      DEFAULT_BREAK_MINUTES,
    ),
    rubricId: body.rubricId,
    students: cleanArray(body.students).length
      ? cleanArray(body.students)
      : [body.studentId].filter(Boolean),

    panels: cleanArray(body.panels).length
      ? cleanArray(body.panels)
      : [body.panel1Id, body.panel2Id].filter(Boolean),
    status,
    createdBy: userId,
    academicSession: cleanText(body.academicSession || "", 100),
    scheduleTitle: cleanText(
      body.scheduleTitle || "Postgraduate Progress Presentation Schedule",
      150,
    ),
  };
};
const {
  uploadToGoogleDrive,
  deleteFromGoogleDrive,
} = require("../services/googleDriveService");

exports.createTimetable = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const payload = buildTimetablePayload(req.body, req.user.id);
    const timetable = await Timetable.create(payload);

    const evaluationsToInsert = buildPendingEvaluations(
      timetable,
      payload,
      req.body.semester,
    );

    if (evaluationsToInsert.length > 0) {
      await Evaluation.insertMany(evaluationsToInsert);
    }

    res.status(201).json({
      success: true,
      timetable: formatTimetable(timetable),
      evaluationsCreated: evaluationsToInsert.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating timetable",
      error: error.message,
    });
  }
};

// 🔴 FORMAT DATA FOR REACT FRONTEND
const formatTimetable = (t) => {
  const doc = t.toObject ? t.toObject() : t;

  // React wants "student", "panel1Id", "panel2Id". We extract them from the MongoDB Arrays.
  doc.student =
    doc.students && doc.students.length > 0 ? doc.students[0] : null;
  doc.panel1Id = doc.panels && doc.panels.length > 0 ? doc.panels[0] : null;
  doc.panel2Id = doc.panels && doc.panels.length > 1 ? doc.panels[1] : null;

  return doc;
};

exports.getTimetables = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "student") query.students = req.user.id;
    else if (req.user.role === "panel") query.panels = req.user.id;

    const timetables = await Timetable.find(query)
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      )
      .sort({ date: -1, startTime: -1 });

    const formatted = timetables.map(formatTimetable);
    res.json({ success: true, count: formatted.length, timetables: formatted });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching timetables" });
  }
};

exports.getMyTimetable = async (req, res) => {
  try {
    let query = {};
    const myId = req.user.id || req.user.userId || req.user._id;

    if (req.user.role === "student") {
      query.students = myId;
    } else if (req.user.role === "panel") {
      query.panels = myId;
    } else if (req.user.role === "admin") {
      query = {};
    }

    const timetables = await Timetable.find(query)
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      )
      .sort({ date: -1, startTime: -1 });

    const formatted = timetables.map(formatTimetable);
    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
      sessions: formatted,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching timetable" });
  }
};

exports.getTimetableById = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id)
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      );

    if (!timetable)
      return res
        .status(404)
        .json({ success: false, message: "Timetable not found" });
    res.json({ success: true, timetable: formatTimetable(timetable) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching timetable" });
  }
};

// 🔴 BULK SCHEDULE GENERATOR
exports.createBulkTimetables = async (req, res) => {
  try {
    const {
      sessions,
      batchName,
      batchId,
      googleMeetLink,
      venue,
      date,
      startTime,
      slotDurationMinutes,
      breakBetweenSlotsMinutes,
      semester,
      academicSession,
      scheduleTitle,
    } = req.body;

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one session is required for bulk scheduling.",
      });
    }

    const duration = toPositiveInt(slotDurationMinutes, null);
    const breakMinutes = toNonNegativeInt(
      breakBetweenSlotsMinutes,
      DEFAULT_BREAK_MINUTES,
    );

    const baseStartTime = cleanText(
      startTime || sessions[0]?.startTime || sessions[0]?.time || "",
      20,
    );
    const baseStartMinutes = parseTimeToMinutes(baseStartTime);

    const batchMeetingLink = cleanText(googleMeetLink || venue || "", 500);
    const cleanBatchName = cleanText(batchName || "", 100);
    const cleanBatchId = cleanText(
      batchId || `${cleanBatchName}-${batchMeetingLink}`,
      150,
    );

    const timetablesToInsert = sessions.map((s, index) => {
      const sessionType = cleanText(s.sessionType, 50);

      if (!allowedSessionTypes.includes(sessionType)) {
        throw new Error(`Invalid session type at row ${index + 1}.`);
      }

      const sessionDate = normalizeDateOnly(s.date || date);

      let slotStartTime = cleanText(s.startTime || s.time || "", 20);
      let slotEndTime = cleanText(s.endTime || "", 20);

      if (!slotStartTime && baseStartMinutes !== null && duration) {
        slotStartTime = formatMinutesToTime(
          baseStartMinutes + index * (duration + breakMinutes),
        );
      }

      if (!slotEndTime && slotStartTime && duration) {
        const slotStartMinutes = parseTimeToMinutes(slotStartTime);
        slotEndTime = formatMinutesToTime(slotStartMinutes + duration);
      }

      ensureNotBackdated(sessionDate, slotStartTime);

      if (!slotEndTime) {
        throw new Error(
          `End time is missing at row ${index + 1}. Provide end time or slot duration.`,
        );
      }

      return {
        sessionType,
        rubricId: s.rubricId,
        title: cleanText(
          s.title || `${sessionType.replaceAll("_", " ")} Session`,
          150,
        ),
        date: sessionDate,
        startTime: slotStartTime,
        endTime: slotEndTime,
        venue: cleanText(s.venue || s.googleMeetLink || batchMeetingLink, 500),
        googleMeetLink: cleanText(
          s.googleMeetLink || s.venue || batchMeetingLink,
          500,
        ),
        batchName: cleanText(s.batchName || cleanBatchName, 100),
        batchId: cleanText(s.batchId || cleanBatchId, 150),
        slotDurationMinutes: duration,
        breakBetweenSlotsMinutes: breakMinutes,
        students: [s.studentId].filter(Boolean),
        panels: [s.panel1Id, s.panel2Id].filter(Boolean),
        status: "scheduled",
        createdBy: req.user.id,
        academicSession: cleanText(
          s.academicSession || academicSession || "",
          100,
        ),
        scheduleTitle: cleanText(
          s.scheduleTitle ||
            scheduleTitle ||
            "Postgraduate Progress Presentation Schedule",
          150,
        ),
      };
    });

    const createdTimetables = await Timetable.insertMany(timetablesToInsert);

    const evaluationsToInsert = [];

    for (let i = 0; i < createdTimetables.length; i++) {
      const session = createdTimetables[i];
      const payload = timetablesToInsert[i];

      evaluationsToInsert.push(
        ...buildPendingEvaluations(session, payload, semester),
      );
    }

    if (evaluationsToInsert.length > 0) {
      await Evaluation.insertMany(evaluationsToInsert);
    }

    res.status(201).json({
      success: true,
      count: createdTimetables.length,
      evaluationsCreated: evaluationsToInsert.length,
      batchName: cleanBatchName,
      batchId: cleanBatchId,
      breakBetweenSlotsMinutes: breakMinutes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error scheduling",
      error: error.message,
    });
  }
};

const formatPrintDate = (dateValue) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return {
      raw: "",
      display: "",
      dayName: "",
    };
  }

  return {
    raw: date.toISOString().slice(0, 10),
    display: date.toLocaleDateString("en-GB"),
    dayName: date.toLocaleDateString("en-MY", { weekday: "long" }),
  };
};

const formatPrintTime = (timeValue) => {
  const raw = String(timeValue || "").trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) return raw;

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);

  return date
    .toLocaleTimeString("en-MY", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace("AM", "am")
    .replace("PM", "pm");
};

exports.getBatchPrintSchedule = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can export or print batch schedules.",
      });
    }

    const batchId = decodeURIComponent(req.params.batchId || "").trim();

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Batch ID is required.",
      });
    }

    const sessions = await Timetable.find({ batchId })
      .populate({
        path: "students",
        select:
          "name userId matricNumber yearOfStudy program researchTitle supervisorId",
        populate: {
          path: "supervisorId",
          select: "name userId email",
        },
      })
      .populate("panels", "name userId email")
      .populate("rubricId", "name sessionType")
      .sort({ date: 1, startTime: 1 });

    if (!sessions.length) {
      return res.status(404).json({
        success: false,
        message: "No sessions found for this batch.",
      });
    }

    const first = sessions[0];
    const dateInfo = formatPrintDate(first.date);

    const rows = sessions.map((session, index) => {
      const student = session.students?.[0] || {};
      const examiner1 = session.panels?.[0] || {};
      const examiner2 = session.panels?.[1] || {};
      const supervisor = student.supervisorId || {};

      return {
        no: index + 1,
        time: `${formatPrintTime(session.startTime)} – ${formatPrintTime(
          session.endTime,
        )}`,
        name: student.name || "",
        matricNumber: student.matricNumber || student.userId || "",
        yearOfStudy: student.yearOfStudy || "",
        program: student.program || "",
        examiner1: examiner1.name || "",
        examiner2: examiner2.name || "",
        supervisor: supervisor.name || "",
        researchTitle: student.researchTitle || "",
      };
    });

    res.json({
      success: true,
      schedule: {
        title:
          first.scheduleTitle || "Postgraduate Progress Presentation Schedule",
        academicSession:
          first.academicSession || req.query.academicSession || "",
        batchId: first.batchId,
        batchName: first.batchName || first.batchId,
        date: dateInfo.raw,
        dateDisplay: dateInfo.display,
        dayName: dateInfo.dayName,
        googleMeetLink: first.googleMeetLink || first.venue || "",
        sessionType: first.sessionType,
        rubricName: first.rubricId?.name || "",
        generatedAt: new Date(),
        rows,
      },
    });
  } catch (error) {
    console.error("Batch print schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate batch print schedule.",
      error: error.message,
    });
  }
};

exports.updateTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    if (req.body.sessionType) {
      const sessionType = cleanText(req.body.sessionType, 50);
      if (!allowedSessionTypes.includes(sessionType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid session type.",
        });
      }
      updates.sessionType = sessionType;
    }

    if (req.body.title !== undefined) {
      updates.title = cleanText(req.body.title, 150);
    }

    if (req.body.description !== undefined) {
      updates.description = cleanText(req.body.description, 1000);
    }

    if (req.body.date !== undefined) {
      updates.date = req.body.date;
    }

    if (req.body.startTime !== undefined) {
      updates.startTime = cleanText(req.body.startTime, 20);
    }

    if (req.body.time !== undefined) {
      updates.startTime = cleanText(req.body.time, 20);
    }

    if (req.body.endTime !== undefined) {
      updates.endTime = cleanText(req.body.endTime, 20);
    }

    if (req.body.venue !== undefined) {
      updates.venue = cleanText(req.body.venue, 500);
    }

    if (req.body.rubricId !== undefined) {
      updates.rubricId = req.body.rubricId;
    }

    if (req.body.panel1Id !== undefined) {
      updates.panel1Id = req.body.panel1Id;
    }

    if (req.body.panel2Id !== undefined) {
      updates.panel2Id = req.body.panel2Id;
    }

    if (req.body.status !== undefined) {
      if (!allowedSessionStatuses.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid session status.",
        });
      }
      updates.status = req.body.status;
    }
    const existingSession = await Timetable.findById(id);

    if (!existingSession) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found.",
      });
    }

    if (req.body.googleMeetLink !== undefined) {
      updates.googleMeetLink = cleanText(req.body.googleMeetLink, 500);
      updates.venue = updates.googleMeetLink;
    }

    if (req.body.batchName !== undefined) {
      updates.batchName = cleanText(req.body.batchName, 100);
    }

    if (req.body.batchId !== undefined) {
      updates.batchId = cleanText(req.body.batchId, 150);
    }

    if (req.body.slotDurationMinutes !== undefined) {
      updates.slotDurationMinutes = toPositiveInt(
        req.body.slotDurationMinutes,
        existingSession?.slotDurationMinutes || null,
      );
    }

    if (req.body.breakBetweenSlotsMinutes !== undefined) {
      updates.breakBetweenSlotsMinutes = toNonNegativeInt(
        req.body.breakBetweenSlotsMinutes,
        DEFAULT_BREAK_MINUTES,
      );
    }
    const effectiveDate = updates.date || existingSession.date;
    const effectiveStartTime = updates.startTime || existingSession.startTime;

    if (updates.date || updates.startTime) {
      ensureNotBackdated(effectiveDate, effectiveStartTime);
    }

    // Reconstruct the array for updating
    const oldP1 = existingSession.panels?.[0]?.toString();
    const oldP2 = existingSession.panels?.[1]?.toString();

    if (updates.panel1Id || updates.panel2Id) {
      updates.panels = [
        updates.panel1Id || oldP1,
        updates.panel2Id || oldP2,
      ].filter(Boolean);
    }
    if (updates.time) updates.startTime = updates.time;

    const updatedSession = await Timetable.findByIdAndUpdate(id, updates, {
      new: true,
    });

    // Panel Swaps
    if (updates.panel1Id && oldP1 && updates.panel1Id !== oldP1) {
      await Evaluation.findOneAndUpdate(
        { sessionId: id, evaluatorId: oldP1, status: "PENDING" },
        {
          evaluatorId: updates.panel1Id,
          rubricId: updates.rubricId || existingSession.rubricId,
        },
      );
    }
    if (updates.panel2Id && oldP2 && updates.panel2Id !== oldP2) {
      await Evaluation.findOneAndUpdate(
        { sessionId: id, evaluatorId: oldP2, status: "PENDING" },
        {
          evaluatorId: updates.panel2Id,
          rubricId: updates.rubricId || existingSession.rubricId,
        },
      );
    }
    if (updates.rubricId) {
      const evaluationUpdate = {
        rubricId: updates.rubricId,
      };

      if (updates.sessionType) {
        evaluationUpdate.sessionType = updates.sessionType;
      }

      await Evaluation.updateMany(
        { sessionId: id, status: "PENDING" },
        evaluationUpdate,
      );
    }

    res.json({ success: true, timetable: formatTimetable(updatedSession) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating timetable",
      error: error.message,
    });
  }
};

exports.deleteTimetable = async (req, res) => {
  try {
    await Evaluation.deleteMany({ sessionId: req.params.id });
    await Timetable.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error deleting timetable" });
  }
};

// Required placeholders for routing
exports.uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, description } = req.body;

    const timetable = await Timetable.findById(id).select("students status");

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    const userId = String(req.user.id || req.user._id);
    const isAdmin = req.user.role === "admin";
    const isAssignedStudent = timetable.students.some(
      (studentId) => String(studentId) === userId,
    );

    if (!isAdmin && !isAssignedStudent) {
      return res.status(403).json({
        success: false,
        message:
          "Only the assigned student can upload materials for this session.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please choose a file to upload.",
      });
    }

    const cleanTitle = String(title || req.file.originalname || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: "Document title is required.",
      });
    }

    if (cleanTitle.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Document title must not exceed 120 characters.",
      });
    }

    const allowedTypes = ["report", "slides", "supplementary", "other"];
    const cleanType = allowedTypes.includes(type) ? type : "other";

    const uploaded = await uploadToGoogleDrive(req.file);

    const documentRecord = {
      title: cleanTitle,
      url: uploaded.webViewLink,
      driveFileId: uploaded.id,
      mimeType: uploaded.mimeType || req.file.mimetype,
      source: "google-drive",
      type: cleanType,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
      fileSize: uploaded.size
        ? `${uploaded.size} bytes`
        : `${req.file.size} bytes`,
      description: cleanText(description || "", 500),
    };

    const updatedTimetable = await Timetable.findByIdAndUpdate(
      id,
      {
        $push: {
          studentDocuments: documentRecord,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      );

    res.json({
      success: true,
      message: "Material uploaded to Google Drive successfully.",
      timetable: formatTimetable(updatedTimetable),
      document: documentRecord,
    });
  } catch (error) {
    console.error("Upload document error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to upload material.",
      error: error.message,
    });
  }
};
exports.deleteDocument = async (req, res) => {
  try {
    const { id, documentId } = req.params;

    const timetable = await Timetable.findById(id).select("studentDocuments");

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    const targetDocument = timetable.studentDocuments.id(documentId);

    if (!targetDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const userId = String(req.user.id || req.user._id);
    const isAdmin = req.user.role === "admin";
    const isOwner =
      targetDocument.uploadedBy && String(targetDocument.uploadedBy) === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You can only delete materials uploaded by yourself.",
      });
    }

    await deleteFromGoogleDrive(targetDocument.driveFileId);

    const updatedTimetable = await Timetable.findByIdAndUpdate(
      id,
      {
        $pull: {
          studentDocuments: {
            _id: documentId,
          },
        },
      },
      {
        new: true,
      },
    )
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      );

    res.json({
      success: true,
      message: "Material deleted successfully.",
      timetable: formatTimetable(updatedTimetable),
    });
  } catch (error) {
    console.error("Delete document error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete material.",
      error: error.message,
    });
  }
};
exports.addPanelNotes = async (req, res) => {
  res.json({ success: true });
};
