const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Timetable = require("../models/Timetable");
const User = require("../models/User");
const Evaluation = require("../models/Evaluation");
const PermissionRequest = require("../models/PermissionRequest");
const SessionBatch = require("../models/SessionBatch");
const Rubric = require("../models/Rubric");
const { toSessionTypeCode } = require("../utils/sessionType");
const {
  buildEvaluationDocsForTimetable,
} = require("../utils/evaluationWorkflow");
const {
  buildValidationItems,
  cleanArray,
  cleanText,
  idString,
  normalizeDateOnly,
  parseTimeToMinutes,
  rangesOverlap,
  validateItems,
} = require("../utils/timetableValidation");
const {
  buildSupervisorConflictMessage,
  hasSupervisorPanelConflict,
} = require("../utils/supervisorConflictValidation");

let fileStorage = {};
try {
  fileStorage = require("../services/fileStorageService");
} catch (_) {
  try {
    fileStorage = require("../services/googleDriveService");
  } catch (_) {
    fileStorage = {};
  }
}

const {
  uploadStoredFile,
  deleteStoredFile,
  getStoredFileInfo,
  streamStoredFile,
  uploadToGoogleDrive,
  deleteFromGoogleDrive,
  streamDocumentFile: streamLegacyFile,
} = fileStorage;

const DEFAULT_BREAK_MINUTES = 5;
const PANEL_REPLACEMENT_MIN_DAYS = 7;
const FILE_VIEW_TICKET_PURPOSE = "session-material-view";
const FILE_VIEW_TICKET_EXPIRES_IN = "2m";

const getJwtSecret = () =>
  process.env.JWT_SECRET || "your-fallback-secret-key";

const makeHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const resolveRubricSessionType = async ({ sessionType, rubricId }) => {
  if (rubricId) {
    const rubric = await Rubric.findById(rubricId).select("sessionType");
    if (!rubric) throw makeHttpError("Selected rubric was not found.");
    return rubric.sessionType;
  }

  const resolved = toSessionTypeCode(sessionType);
  if (!resolved) throw makeHttpError("Invalid session type.");

  const rubricExists = await Rubric.exists({ sessionType: resolved });
  if (!rubricExists) {
    throw makeHttpError("Session type must match an existing rubric.");
  }

  return resolved;
};

const formatDateDisplay = (dateValue) => {
  const dateOnly = normalizeDateOnly(dateValue);

  if (!dateOnly) {
    return { raw: "", display: "", dayName: "" };
  }

  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return { raw: dateOnly, display: dateOnly, dayName: "" };
  }

  const [, year, month, day] = match;
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return {
    raw: `${year}-${month}-${day}`,
    display: `${day}/${month}/${year}`,
    dayName: Number.isNaN(localDate.getTime())
      ? ""
      : localDate.toLocaleDateString("en-MY", { weekday: "long" }),
  };
};

const formatMinutesToTime = (minutes) => {
  const normalized = ((Number(minutes) || 0) % 1440 + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
};

const toPositiveInt = (value, fallback = null) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const toNonNegativeInt = (value, fallback = 0) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const buildBatchId = (batchName, date) => {
  const normalizedName = String(batchName || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 100);
  const normalizedDate = normalizeDateOnly(date).replace(/-/g, "");
  return cleanText(
    `${normalizedName || "BATCH"}${normalizedDate ? `-${normalizedDate}` : ""}`,
    150,
  );
};

const sameId = (a, b) => idString(a) && idString(a) === idString(b);

const sessionHasUser = (values = [], userId) =>
  values.some((value) => sameId(value, userId));

const buildTimetableQueryForViewer = async (user = {}) => {
  const userId = user.id || user._id || user.userId;
  const role = user.role;

  if (role === "student") {
    return { students: userId };
  }

  if (role === "panel") {
    const supervisedStudents = await User.find({ supervisorId: userId })
      .select("_id")
      .lean();
    const supervisedStudentIds = supervisedStudents
      .map((student) => student._id)
      .filter(Boolean);

    if (!supervisedStudentIds.length) {
      return { panels: userId };
    }

    return {
      $or: [{ panels: userId }, { students: { $in: supervisedStudentIds } }],
    };
  }

  return {};
};

const getDocumentUploaderId = (document) => idString(document?.uploadedBy);

const canAccessSessionMaterial = async (timetable, user, document = null) => {
  const userId = user?.id || user?._id;
  if (!user || !userId) return false;
  if (user.role === "admin") return true;
  if (document && sameId(getDocumentUploaderId(document), userId)) return true;
  if (user.role === "student") return sessionHasUser(timetable.students || [], userId);
  if (user.role === "panel") {
    if (sessionHasUser(timetable.panels || [], userId)) return true;

    const studentIds = (timetable.students || []).map(idString).filter(Boolean);
    if (!studentIds.length) return false;

    return Boolean(
      await User.exists({
        _id: { $in: studentIds },
        supervisorId: userId,
      }),
    );
  }
  return false;
};

const findTimetableForStoredFile = async (fileId) =>
  Timetable.findOne({
    $or: [
      { "studentDocuments.driveFileId": fileId },
      { "studentDocuments.fileStorageId": fileId },
    ],
  }).select("_id students panels studentDocuments");

const findDocumentForStoredFile = (timetable, fileId) =>
  timetable?.studentDocuments?.find(
    (doc) => sameId(doc.fileStorageId, fileId) || sameId(doc.driveFileId, fileId),
  );

const documentFileName = async (document, fileId) => {
  const storedInfo =
    !document?.originalFileName && getStoredFileInfo
      ? await getStoredFileInfo(fileId)
      : null;

  return (
    cleanText(
      document?.originalFileName ||
        storedInfo?.originalName ||
        document?.title ||
        "student-material",
      180,
    ) || "student-material"
  );
};

const buildPublicBackendUrl = (req) =>
  String(
    process.env.PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL ||
      `${req.protocol}://${req.get("host")}`,
  ).replace(/\/$/, "");

const buildDocumentViewUrl = (req, fileId, filename, ticket) =>
  `${buildPublicBackendUrl(req)}/api/timetables/documents/file/${encodeURIComponent(
    fileId,
  )}/view/${encodeURIComponent(filename)}?ticket=${encodeURIComponent(ticket)}`;

const resolveTicketUser = async (decoded) => {
  const user = decoded?.userId ? await User.findById(decoded.userId) : null;
  if (!user) return null;

  const deviceId = decoded.deviceId || null;
  if (deviceId) {
    const activeDevice = (user.authenticatedDevices || []).find(
      (device) =>
        String(device.deviceId || "") === String(deviceId) &&
        device.isActive !== false,
    );
    if (!activeDevice) return null;
  }

  return {
    id: String(user._id),
    _id: user._id,
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    deviceId,
  };
};

const streamAuthorizedDocumentFile = async (fileId, user, res) => {
  const streamer = streamStoredFile || streamLegacyFile;
  if (!streamer) {
    return res.status(404).json({
      success: false,
      message: "File streaming is not configured.",
    });
  }

  const timetable = await findTimetableForStoredFile(fileId);
  const document = findDocumentForStoredFile(timetable, fileId);

  if (!timetable || !document) {
    return res.status(404).json({ success: false, message: "Material not found." });
  }

  if (!(await canAccessSessionMaterial(timetable, user, document))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view this material.",
    });
  }

  res.setHeader("Cache-Control", "private, no-store");
  return streamer(fileId, res);
};

const formatTimetable = (t) => {
  const doc = t?.toObject ? t.toObject() : t;
  if (!doc) return null;
  doc.student = Array.isArray(doc.students) && doc.students.length ? doc.students[0] : null;
  doc.panel1Id = Array.isArray(doc.panels) && doc.panels.length ? doc.panels[0] : null;
  doc.panel2Id = Array.isArray(doc.panels) && doc.panels.length > 1 ? doc.panels[1] : null;
  doc.time = doc.startTime;
  return doc;
};

const populateTimetableQuery = (query) =>
  query
    .populate({
      path: "students",
      select: "name userId matricNumber program yearOfStudy researchTitle researchAbstract supervisorId",
      populate: { path: "supervisorId", select: "name userId email" },
    })
    .populate("panels", "name userId email expertiseTags profession")
    .populate("rubricId", "name sessionType")
    .populate("studentDocuments.uploadedBy", "name userId matricNumber email role");

const buildSessionEndTime = ({ startTime, endTime, slotDurationMinutes }) => {
  const cleanEnd = cleanText(endTime, 20);
  if (cleanEnd) return cleanEnd;
  const startMinutes = parseTimeToMinutes(startTime);
  const duration = toPositiveInt(slotDurationMinutes, null);
  if (startMinutes === null || !duration) return "";
  return formatMinutesToTime(startMinutes + duration);
};

const getSessionDateTimeEnd = (session) => {
  const date = normalizeDateOnly(session.date);
  const endTime = cleanText(session.endTime || session.startTime || "23:59", 20);
  const dt = new Date(`${date}T${endTime}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const getSessionDateTimeStart = (session) => {
  const date = normalizeDateOnly(session.date);
  const startTime = cleanText(session.startTime || session.time || "00:00", 20);
  const dt = new Date(`${date}T${startTime}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const assertPanelReplacementWindow = (existingSession, nextPanels) => {
  const oldPanels = (existingSession.panels || []).map(idString).filter(Boolean);
  const newPanels = (nextPanels || []).map(idString).filter(Boolean);
  const changed =
    oldPanels.length !== newPanels.length || oldPanels.some((p, i) => p !== newPanels[i]);

  if (!changed) return;

  const sessionStart = getSessionDateTimeStart(existingSession);
  const now = new Date();
  const minLeadMs = PANEL_REPLACEMENT_MIN_DAYS * 24 * 60 * 60 * 1000;

  if (!sessionStart || sessionStart.getTime() - now.getTime() < minLeadMs) {
    const err = new Error(
      "Panel replacement is only allowed at least 1 week before the session date.",
    );
    err.statusCode = 400;
    throw err;
  }
};

const validateAgainstExisting = async ({ items, excludeSessionIds = [] }) => {
  validateItems(items);

  const studentIds = [...new Set(items.map((item) => item.studentId).filter(Boolean))];
  if (studentIds.length) {
    const students = await User.find({ _id: { $in: studentIds } })
      .select("name supervisorId")
      .lean();
    const studentsById = new Map(
      students.map((student) => [idString(student._id), student]),
    );

    const supervisorConflictErrors = items
      .map((item) => {
        const student = studentsById.get(item.studentId);
        if (!student) return null;
        if (
          !hasSupervisorPanelConflict({
            supervisorId: student.supervisorId,
            panelIds: item.panelIds,
          })
        ) {
          return null;
        }

        return buildSupervisorConflictMessage({
          studentName: student.name,
          context: item.title || "session assignment",
        });
      })
      .filter(Boolean);

    if (supervisorConflictErrors.length) {
      const err = new Error(supervisorConflictErrors.join("\n"));
      err.statusCode = 400;
      err.validationErrors = supervisorConflictErrors;
      throw err;
    }
  }

  const dates = [...new Set(items.map((item) => item.date).filter(Boolean))];
  if (!dates.length) return;

  const exclude = excludeSessionIds.map(idString).filter(Boolean);

  const existing = await Timetable.find({
    ...(exclude.length ? { _id: { $nin: exclude } } : {}),
    status: { $ne: "cancelled" },
  }).select("_id title date startTime endTime students panels status");

  const existingItems = buildValidationItems(
    existing
      .filter((s) => dates.includes(normalizeDateOnly(s.date)))
      .map((s) => ({
        sessionId: s._id,
        title: s.title,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        studentId: s.students?.[0],
        panels: s.panels,
      })),
  );

  const errors = [];
  for (const item of items) {
    const itemStart = parseTimeToMinutes(item.startTime);
    const itemEnd = parseTimeToMinutes(item.endTime);

    for (const existingItem of existingItems) {
      if (item.sessionId && item.sessionId === existingItem.sessionId) continue;
      if (item.date !== existingItem.date) continue;

      if (item.studentId && item.studentId === existingItem.studentId) {
        errors.push(
          `Student conflict: one student can only have one session per day (${item.title} / ${existingItem.title}).`,
        );
      }

      const existingStart = parseTimeToMinutes(existingItem.startTime);
      const existingEnd = parseTimeToMinutes(existingItem.endTime);
      if (
        itemStart === null ||
        itemEnd === null ||
        existingStart === null ||
        existingEnd === null ||
        !rangesOverlap(itemStart, itemEnd, existingStart, existingEnd)
      ) {
        continue;
      }

      const sharedPanels = item.panelIds.filter((panelId) =>
        existingItem.panelIds.includes(panelId),
      );
      sharedPanels.forEach((panelId) => {
        errors.push(
          `Panel conflict: panel ${panelId} is assigned at overlapping time (${item.title} / ${existingItem.title}).`,
        );
      });
    }
  }

  if (errors.length) {
    const err = new Error(errors.join("\n"));
    err.statusCode = 400;
    err.validationErrors = errors;
    throw err;
  }
};

const buildPendingEvaluations = buildEvaluationDocsForTimetable;

const filterPendingEvaluationsAgainstCompleted = (
  candidates = [],
  completedEvaluations = [],
) => {
  const completedPanelIds = new Set(
    completedEvaluations
      .filter((evaluation) => evaluation.formFiller === "Panel")
      .map((evaluation) => idString(evaluation.evaluatorId))
      .filter(Boolean),
  );
  const hasCompletedSupervisor = completedEvaluations.some(
    (evaluation) => evaluation.formFiller === "Supervisor",
  );

  return candidates.filter((candidate) => {
    if (candidate.formFiller === "Supervisor") {
      return !hasCompletedSupervisor;
    }

    return !completedPanelIds.has(idString(candidate.evaluatorId));
  });
};

const buildPayload = async (body, userId) => {
  const sessionType = await resolveRubricSessionType({
    sessionType: body.sessionType,
    rubricId: body.rubricId,
  });
  const startTime = cleanText(body.startTime || body.time, 20);
  const endTime = buildSessionEndTime({
    startTime,
    endTime: body.endTime,
    slotDurationMinutes: body.slotDurationMinutes,
  });
  const date = normalizeDateOnly(body.date);
  const meetingLink = cleanText(body.googleMeetLink || body.venue, 500);
  const panels = cleanArray(body.panels).length
    ? cleanArray(body.panels)
    : [body.panel1Id, body.panel2Id].filter(Boolean);
  const students = cleanArray(body.students).length
    ? cleanArray(body.students)
    : [body.studentId].filter(Boolean);

  if (!date || !startTime || !endTime || !students[0]) {
    throw new Error("Session date, start time, end time, and student are required.");
  }

  return {
    sessionType,
    title: cleanText(body.title || `${sessionType.replaceAll("_", " ")} - Session`, 150),
    description: cleanText(body.description || "", 1000),
    rubricId: body.rubricId || null,
    date,
    startTime,
    endTime,
    venue: meetingLink,
    googleMeetLink: meetingLink,
    students,
    panels,
    status: body.status || "scheduled",
    createdBy: userId,
    batchName: cleanText(body.batchName || "", 100),
    batchId: cleanText(body.batchId || body.batchName || "", 150),
    academicSession: cleanText(body.academicSession || body.semester || "", 100),
    scheduleTitle: cleanText(
      body.scheduleTitle || "Postgraduate Progress Presentation Schedule",
      150,
    ),
    slotDurationMinutes: toPositiveInt(body.slotDurationMinutes, null),
    breakBetweenSlotsMinutes: toNonNegativeInt(
      body.breakBetweenSlotsMinutes,
      DEFAULT_BREAK_MINUTES,
    ),
  };
};

exports.createTimetable = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const payload = await buildPayload(req.body, req.user.id);
    const validationItem = buildValidationItems([
      {
        ...payload,
        studentId: payload.students[0],
        panelIds: payload.panels,
      },
    ]);
    await validateAgainstExisting({ items: validationItem });

    const timetable = await Timetable.create(payload);
    const evaluations = await buildPendingEvaluations(timetable, payload, req.body.semester);
    if (evaluations.length) await Evaluation.insertMany(evaluations);

    const populated = await populateTimetableQuery(Timetable.findById(timetable._id));
    res.status(201).json({ success: true, timetable: formatTimetable(populated) });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Error creating timetable",
      errors: error.validationErrors,
      error: error.message,
    });
  }
};

exports.getTimetables = async (req, res) => {
  try {
    const query = await buildTimetableQueryForViewer(req.user);

    const timetables = await populateTimetableQuery(
      Timetable.find(query).sort({ date: 1, startTime: 1 }),
    );
    const formatted = timetables.map(formatTimetable);
    res.json({ success: true, count: formatted.length, timetables: formatted, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching timetables", error: error.message });
  }
};

exports.getMyTimetable = async (req, res) => {
  try {
    const query = await buildTimetableQueryForViewer(req.user);

    const timetables = await populateTimetableQuery(
      Timetable.find(query).sort({ date: 1, startTime: 1 }),
    );
    const formatted = timetables.map(formatTimetable);
    res.json({ success: true, count: formatted.length, data: formatted, sessions: formatted, timetables: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching timetable", error: error.message });
  }
};

exports.getTimetableById = async (req, res) => {
  try {
    const timetable = await populateTimetableQuery(Timetable.findById(req.params.id));
    if (!timetable) return res.status(404).json({ success: false, message: "Timetable not found" });
    res.json({ success: true, timetable: formatTimetable(timetable) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching timetable", error: error.message });
  }
};

exports.createBulkTimetables = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const {
      sessions = [],
      batchId,
      batchName,
      date,
      startTime,
      googleMeetLink,
      venue,
      academicSession,
      scheduleTitle,
      slotDurationMinutes,
      breakBetweenSlotsMinutes,
      useExistingBatch,
    } = req.body;

    if (!Array.isArray(sessions) || !sessions.length) {
      return res.status(400).json({ success: false, message: "At least one session is required." });
    }

    let selectedBatch = null;
    if (batchId) selectedBatch = await SessionBatch.findOne({ batchId });
    if (useExistingBatch && !selectedBatch) {
      return res.status(404).json({ success: false, message: "Selected batch was not found." });
    }

    const requestedBatchName = cleanText(batchName || "", 100);
    const requestedBatchId = cleanText(batchId || "", 150);
    const effectiveDate = normalizeDateOnly(date || selectedBatch?.date);
    const effectiveStartTime = cleanText(startTime || selectedBatch?.startTime || "09:00", 20);
    const effectiveBatchId = selectedBatch
      ? cleanText(selectedBatch.batchId, 150)
      : requestedBatchId || buildBatchId(requestedBatchName, effectiveDate);
    const effectiveBatchName = selectedBatch
      ? cleanText(selectedBatch.batchName || effectiveBatchId, 100)
      : requestedBatchName || effectiveBatchId;
    const effectiveVenue = cleanText(googleMeetLink || venue || selectedBatch?.googleMeetLink || "", 500);
    const effectiveAcademicSession = cleanText(academicSession || selectedBatch?.academicSession || "", 100);
    const effectiveScheduleTitle = cleanText(
      scheduleTitle || selectedBatch?.scheduleTitle || "Postgraduate Progress Presentation Schedule",
      150,
    );
    const effectiveSlotDuration = toPositiveInt(
      slotDurationMinutes || selectedBatch?.slotDurationMinutes,
      60,
    );
    const effectiveBreak = toNonNegativeInt(
      breakBetweenSlotsMinutes ?? selectedBatch?.breakBetweenSlotsMinutes,
      DEFAULT_BREAK_MINUTES,
    );

    const payloads = await Promise.all(sessions.map(async (s, index) => {
      const rubricId = s.rubricId || req.body.rubricId || selectedBatch?.rubricId || null;
      const sessionType = await resolveRubricSessionType({
        sessionType: s.sessionType || req.body.sessionType || selectedBatch?.sessionType,
        rubricId,
      });
      const rowStart = cleanText(s.time || s.startTime, 20) ||
        formatMinutesToTime(parseTimeToMinutes(effectiveStartTime) + index * (effectiveSlotDuration + effectiveBreak));
      const rowEnd = buildSessionEndTime({
        startTime: rowStart,
        endTime: s.endTime,
        slotDurationMinutes: effectiveSlotDuration,
      });
      const titleStudent = s.studentName ? ` - ${cleanText(s.studentName, 80)}` : "";
      return {
        sessionType,
        rubricId,
        title: cleanText(s.title || `${sessionType.replaceAll("_", " ")}${titleStudent}`, 150),
        date: normalizeDateOnly(s.date || effectiveDate),
        startTime: rowStart,
        endTime: rowEnd,
        venue: cleanText(s.venue || effectiveVenue, 500),
        googleMeetLink: cleanText(s.googleMeetLink || s.venue || effectiveVenue, 500),
        students: [s.studentId].filter(Boolean),
        panels: [s.panel1Id, s.panel2Id].filter(Boolean),
        status: "scheduled",
        createdBy: req.user.id,
        batchId: effectiveBatchId,
        batchName: effectiveBatchName,
        academicSession: effectiveAcademicSession,
        scheduleTitle: effectiveScheduleTitle,
        slotDurationMinutes: effectiveSlotDuration,
        breakBetweenSlotsMinutes: effectiveBreak,
      };
    }));

    const validationItems = buildValidationItems(
      payloads.map((p) => ({ ...p, studentId: p.students[0], panelIds: p.panels })),
    );
    await validateAgainstExisting({ items: validationItems });

    const createdTimetables = await Timetable.insertMany(payloads);
    const evaluationsToInsert = [];
    for (let index = 0; index < createdTimetables.length; index += 1) {
      const pending = await buildPendingEvaluations(
        createdTimetables[index],
        payloads[index],
        req.body.semester,
      );
      evaluationsToInsert.push(...pending);
    }
    if (evaluationsToInsert.length) await Evaluation.insertMany(evaluationsToInsert);

    res.status(201).json({ success: true, count: createdTimetables.length, timetables: createdTimetables.map(formatTimetable) });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Error scheduling sessions",
      errors: error.validationErrors,
      error: error.message,
    });
  }
};

exports.updateTimetable = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can update sessions." });
    }

    const existing = await Timetable.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Timetable not found." });

    const oldPanels = (existing.panels || []).map(idString).filter(Boolean);
    const nextPanels = req.body.panels
      ? cleanArray(req.body.panels)
      : [req.body.panel1Id ?? existing.panels?.[0], req.body.panel2Id ?? existing.panels?.[1]].filter(Boolean);
    const normalizedNextPanels = nextPanels.map(idString).filter(Boolean);
    const panelsChanged =
      oldPanels.length !== normalizedNextPanels.length ||
      oldPanels.some((panelId, index) => panelId !== normalizedNextPanels[index]);
    const removedPanelIds = oldPanels.filter(
      (panelId) => !normalizedNextPanels.includes(panelId),
    );

    if (nextPanels.length && new Set(nextPanels.map(idString)).size !== nextPanels.length) {
      return res.status(400).json({ success: false, message: "Panel 1 and Panel 2 cannot be the same person." });
    }

    assertPanelReplacementWindow(existing, nextPanels);

    const updates = {};
    ["sessionType", "rubricId", "title", "description", "venue", "googleMeetLink", "status", "batchId", "batchName", "academicSession", "scheduleTitle"].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.body.date !== undefined) updates.date = normalizeDateOnly(req.body.date);
    if (req.body.time !== undefined || req.body.startTime !== undefined) {
      updates.startTime = cleanText(req.body.startTime || req.body.time, 20);
    }
    if (req.body.endTime !== undefined) updates.endTime = cleanText(req.body.endTime, 20);
    if (nextPanels.length) updates.panels = nextPanels;
    if (updates.sessionType !== undefined || updates.rubricId !== undefined) {
      updates.sessionType = await resolveRubricSessionType({
        sessionType: updates.sessionType || existing.sessionType,
        rubricId:
          updates.rubricId !== undefined ? updates.rubricId : existing.rubricId,
      });
    }

    const nextPayload = {
      ...existing.toObject(),
      ...updates,
      panels: updates.panels || existing.panels,
      students: existing.students,
    };

    const validationItem = buildValidationItems([
      {
        sessionId: existing._id,
        title: nextPayload.title,
        date: nextPayload.date,
        startTime: nextPayload.startTime,
        endTime: nextPayload.endTime,
        studentId: nextPayload.students?.[0],
        panelIds: nextPayload.panels,
      },
    ]);
    await validateAgainstExisting({ items: validationItem, excludeSessionIds: [existing._id] });

    const updated = await Timetable.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (updates.panels || updates.rubricId || updates.sessionType) {
      if (panelsChanged && removedPanelIds.length) {
        const removedPanelEvaluations = await Evaluation.find({
          sessionId: updated._id,
          formFiller: "Panel",
          evaluatorId: { $in: removedPanelIds },
        })
          .select("_id")
          .lean();

        const removedEvaluationIds = removedPanelEvaluations
          .map((evaluation) => evaluation._id)
          .filter(Boolean);

        if (removedEvaluationIds.length) {
          await PermissionRequest.deleteMany({
            targetEvaluationId: { $in: removedEvaluationIds },
          });
          await Evaluation.deleteMany({
            _id: { $in: removedEvaluationIds },
          });
        }
      }

      await Evaluation.deleteMany({ sessionId: updated._id, status: "PENDING" });

      const completedEvaluations = await Evaluation.find({
        sessionId: updated._id,
        status: "COMPLETED",
      })
        .select("evaluatorId formFiller")
        .lean();

      const pendingCandidates = await buildPendingEvaluations(
        updated,
        {
          students: updated.students,
          panels: updated.panels,
          rubricId: updated.rubricId,
          sessionType: updated.sessionType,
          academicSession: updated.academicSession,
        },
        updated.academicSession,
      );
      const pending = filterPendingEvaluationsAgainstCompleted(
        pendingCandidates,
        completedEvaluations,
      );
      if (pending.length) await Evaluation.insertMany(pending);
    }

    const populated = await populateTimetableQuery(Timetable.findById(updated._id));
    res.json({ success: true, timetable: formatTimetable(populated) });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Error updating timetable",
      errors: error.validationErrors,
      error: error.message,
    });
  }
};

exports.updateBatchTimeFrames = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can update batch time frames." });
    }

    const { batchId } = req.params;
    const { items = [], date } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: "No time-frame items provided." });
    }

    const existingSessions = await Timetable.find({ batchId, _id: { $in: items.map((i) => i.sessionId).filter(Boolean) } });
    const byId = new Map(existingSessions.map((s) => [idString(s._id), s]));

    const validationItems = buildValidationItems(
      items.map((item) => {
        const session = byId.get(idString(item.sessionId));
        return {
          sessionId: item.sessionId,
          title: session?.title || item.title || "Session",
          date: normalizeDateOnly(item.date || date || session?.date),
          startTime: item.startTime || item.time,
          endTime: item.endTime,
          studentId: session?.students?.[0] || item.studentId,
          panelIds: session?.panels || item.panelIds || item.panels,
        };
      }),
    );

    await validateAgainstExisting({
      items: validationItems,
      excludeSessionIds: items.map((i) => i.sessionId),
    });

    let updatedCount = 0;
    for (const item of items) {
      if (!item.sessionId || !item.startTime || !item.endTime) continue;
      const update = {
        startTime: cleanText(item.startTime, 20),
        endTime: cleanText(item.endTime, 20),
      };
      if (item.date || date) update.date = normalizeDateOnly(item.date || date);

      const updated = await Timetable.findOneAndUpdate(
        { _id: item.sessionId, batchId, status: { $ne: "completed" } },
        { $set: update },
        { new: true },
      );
      if (updated) updatedCount += 1;
    }

    res.json({ success: true, message: "Batch time frames updated.", updatedCount });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to update batch time frames.",
      errors: error.validationErrors,
      error: error.message,
    });
  }
};

exports.deleteTimetable = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can delete sessions." });
    }
    await Evaluation.deleteMany({ sessionId: req.params.id, status: "PENDING" });
    await Timetable.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Session deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting timetable", error: error.message });
  }
};

exports.getAvailableBatches = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can view available batches." });
    }

    const sessionAgg = await Timetable.aggregate([
      { $match: { batchId: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: "$batchId",
          batchId: { $first: "$batchId" },
          batchName: { $first: "$batchName" },
          earliestDate: { $min: "$date" },
          date: { $min: "$date" },
          sessionType: { $first: "$sessionType" },
          academicSession: { $first: "$academicSession" },
          scheduleTitle: { $first: "$scheduleTitle" },
          googleMeetLink: { $first: "$googleMeetLink" },
          startTime: { $min: "$startTime" },
          slotDurationMinutes: { $first: "$slotDurationMinutes" },
          breakBetweenSlotsMinutes: { $first: "$breakBetweenSlotsMinutes" },
          sessionCount: { $sum: 1 },
        },
      },
    ]);

    const storedBatches = await SessionBatch.find().lean();
    const map = new Map();

    sessionAgg.forEach((sessionBatch) => {
      map.set(sessionBatch.batchId, {
        ...sessionBatch,
        totalSessions: sessionBatch.sessionCount || 0,
      });
    });

    // Prefer SessionBatch metadata when it exists because it is the batch master.
    // Before this fix, Timetable aggregation overwrote the edited batch date,
    // so the dropdown could show one date while dashboard/print still used the old session date.
    storedBatches.forEach((batch) => {
      const existing = map.get(batch.batchId) || {};
      map.set(batch.batchId, {
        ...existing,
        ...batch,
        totalSessions: existing.sessionCount || existing.totalSessions || 0,
        sessionCount: existing.sessionCount || existing.totalSessions || 0,
        earliestDate: batch.date || existing.earliestDate || existing.date,
        date: batch.date || existing.date || existing.earliestDate,
        googleMeetLink: batch.googleMeetLink || existing.googleMeetLink || existing.venue || "",
      });
    });

    const batches = [...map.values()].sort(
      (a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0),
    );

    res.json({ success: true, batches });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load batches", error: error.message });
  }
};

const buildBatchSchedule = async (batchId) => {
  const [batch, sessions] = await Promise.all([
    SessionBatch.findOne({ batchId }).lean(),
    populateTimetableQuery(Timetable.find({ batchId }).sort({ date: 1, startTime: 1 })),
  ]);

  if (!sessions.length && !batch) return null;

  const first = sessions[0] || {};
  const dateSource = batch?.date || first.date;
  const dateInfo = formatDateDisplay(dateSource);

  const batchName = batch?.batchName || first.batchName || batchId;
  const academicSession = batch?.academicSession || first.academicSession || "";
  const scheduleTitle =
    batch?.scheduleTitle || first.scheduleTitle || "Postgraduate Progress Presentation Schedule";
  const googleMeetLink = batch?.googleMeetLink || first.googleMeetLink || first.venue || "";
  const sessionType = batch?.sessionType || first.sessionType || "";
  const rubricName = batch?.rubricId?.name || first.rubricId?.name || "";

  return {
    title: scheduleTitle,
    batchId,
    batchName,
    date: dateInfo.raw,
    dateDisplay: dateInfo.display,
    dayName: dateInfo.dayName,
    academicSession,
    scheduleTitle,
    googleMeetLink,
    sessionType,
    rubricName,
    generatedAt: new Date(),
    rows: sessions.map((s, index) => {
      const student = s.students?.[0] || {};
      const researchTitle = student.researchTitle || s.title || "";
      return {
        no: index + 1,
        time: `${s.startTime || ""} - ${s.endTime || ""}`,
        name: student.name || "-",
        matricNumber: student.matricNumber || student.userId || "-",
        matricNo: student.matricNumber || student.userId || "-",
        yearOfStudy: student.yearOfStudy || "",
        program: student.program || "-",
        examiner1: s.panels?.[0]?.name || "-",
        examiner2: s.panels?.[1]?.name || "-",
        supervisor: student.supervisorId?.name || "-",
        researchTitle,
        title: researchTitle,
        titleOfResearch: researchTitle,
      };
    }),
  };
};

exports.getBatchPrintSchedule = async (req, res) => {
  try {
    const schedule = await buildBatchSchedule(req.params.batchId);
    if (!schedule) return res.status(404).json({ success: false, message: "Batch schedule not found." });
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load batch schedule", error: error.message });
  }
};

exports.getBatchPrintSchedules = async (req, res) => {
  try {
    const ids = String(req.query.batchIds || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!ids.length) return res.status(400).json({ success: false, message: "batchIds is required." });
    const schedules = [];
    for (const id of ids) {
      const schedule = await buildBatchSchedule(id);
      if (schedule) schedules.push(schedule);
    }
    res.json({ success: true, schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load batch schedules", error: error.message });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return res.status(404).json({ success: false, message: "Session not found." });
    if (!(await canAccessSessionMaterial(timetable, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You can only upload materials for your own session.",
      });
    }
    if (!req.file) return res.status(400).json({ success: false, message: "Please choose a file to upload." });

    const uploader = uploadStoredFile || uploadToGoogleDrive;
    if (!uploader) throw new Error("File storage service is not configured.");

    const uploaded = await uploader(req.file);
    const origin = process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const url = /^https?:\/\//i.test(uploaded.webViewLink || "")
      ? uploaded.webViewLink
      : `${origin}${String(uploaded.webViewLink || uploaded.webContentLink || "").startsWith("/") ? "" : "/"}${uploaded.webViewLink || uploaded.webContentLink}`;

    const document = {
      title: cleanText(req.body.title || req.file.originalname, 150),
      url,
      fileStorageId: uploaded.id,
      driveFileId: uploaded.id,
      originalFileName: cleanText(
        uploaded.originalName || req.file.originalname || uploaded.name || "",
        180,
      ),
      mimeType: uploaded.mimeType || req.file.mimetype,
      source: uploaded.source || "gridfs",
      type: cleanText(req.body.type || "other", 50),
      uploadedBy: req.user.id,
      fileSize: String(uploaded.size || req.file.size || ""),
      description: cleanText(req.body.description || "", 500),
    };

    timetable.studentDocuments.push(document);
    await timetable.save();

    const updated = await populateTimetableQuery(Timetable.findById(timetable._id));
    res.status(201).json({ success: true, message: "Material uploaded successfully.", timetable: formatTimetable(updated) });
  } catch (error) {
    console.error("Upload document error:", error);
    res.status(500).json({ success: false, message: "Failed to upload material.", error: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return res.status(404).json({ success: false, message: "Session not found." });
    const doc = timetable.studentDocuments.id(req.params.documentId);
    if (!doc) return res.status(404).json({ success: false, message: "Material not found." });
    if (!(await canAccessSessionMaterial(timetable, req.user, doc))) {
      return res.status(403).json({
        success: false,
        message: "You can only delete materials you uploaded.",
      });
    }

    const remover = deleteStoredFile || deleteFromGoogleDrive;
    if (remover && (doc.fileStorageId || doc.driveFileId)) await remover(doc.fileStorageId || doc.driveFileId);
    doc.deleteOne();
    await timetable.save();
    const updated = await populateTimetableQuery(Timetable.findById(timetable._id));
    res.json({ success: true, message: "Material deleted successfully.", timetable: formatTimetable(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete material.", error: error.message });
  }
};

exports.streamDocumentFile = async (req, res) => {
  try {
    await streamAuthorizedDocumentFile(req.params.fileId, req.user, res);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load file.", error: error.message });
  }
};

exports.createDocumentFileViewTicket = async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const timetable = await findTimetableForStoredFile(fileId);
    const document = findDocumentForStoredFile(timetable, fileId);

    if (!timetable || !document) {
      return res.status(404).json({ success: false, message: "Material not found." });
    }

    if (!(await canAccessSessionMaterial(timetable, req.user, document))) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this material.",
      });
    }

    const filename = await documentFileName(document, fileId);
    const ticket = jwt.sign(
      {
        purpose: FILE_VIEW_TICKET_PURPOSE,
        fileId,
        userId: req.user.id,
        deviceId: req.user.deviceId || null,
      },
      getJwtSecret(),
      { expiresIn: FILE_VIEW_TICKET_EXPIRES_IN },
    );

    res.json({
      success: true,
      url: buildDocumentViewUrl(req, fileId, filename, ticket),
      filename,
      expiresIn: FILE_VIEW_TICKET_EXPIRES_IN,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to prepare file viewer.",
      error: error.message,
    });
  }
};

exports.streamDocumentFileWithTicket = async (req, res) => {
  try {
    const ticket = String(req.query.ticket || "");
    if (!ticket) {
      return res.status(401).json({
        success: false,
        code: "NO_FILE_TICKET",
        message: "File view ticket is required.",
      });
    }

    const decoded = jwt.verify(ticket, getJwtSecret());
    if (
      decoded.purpose !== FILE_VIEW_TICKET_PURPOSE ||
      String(decoded.fileId || "") !== String(req.params.fileId || "")
    ) {
      return res.status(403).json({
        success: false,
        message: "Invalid file view ticket.",
      });
    }

    const user = await resolveTicketUser(decoded);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "File view ticket is no longer valid.",
      });
    }

    await streamAuthorizedDocumentFile(req.params.fileId, user, res);
  } catch (error) {
    const isExpired = error.name === "TokenExpiredError";
    res.status(isExpired ? 401 : 500).json({
      success: false,
      message: isExpired
        ? "File view ticket expired. Please open the material again."
        : "Failed to load file.",
      error: error.message,
    });
  }
};

exports.addPanelNotes = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return res.status(404).json({ success: false, message: "Session not found." });
    timetable.panelNotes = timetable.panelNotes || [];
    timetable.panelNotes.push({
      panelId: req.user.id,
      note: cleanText(req.body.note || req.body.notes || "", 2000),
      createdAt: new Date(),
    });
    await timetable.save();
    res.json({ success: true, message: "Panel note saved." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to save panel note.", error: error.message });
  }
};
