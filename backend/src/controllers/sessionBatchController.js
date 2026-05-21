const SessionBatch = require("../models/SessionBatch");

const cleanText = (value = "", max = 500) =>
  String(value)
    .normalize("NFKC")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const allowedSessionTypes = [
  "PROPOSAL_DEFENSE",
  "PROGRESS_ASSESSMENT",
  "PRE_VIVA",
];

const normalizeDateOnly = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  return raw.includes("T") ? raw.slice(0, 10) : raw;
};

exports.createBatch = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const {
      batchName,
      batchId,
      academicSession,
      scheduleTitle,
      sessionType,
      rubricId,
      date,
      startTime,
      slotDurationMinutes,
      breakBetweenSlotsMinutes,
      googleMeetLink,
      status,
    } = req.body;

    if (
      !batchName ||
      !batchId ||
      !sessionType ||
      !date ||
      !startTime ||
      !googleMeetLink
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Batch name, batch ID, session type, date, start time, and Google Meet link are required.",
      });
    }

    if (!allowedSessionTypes.includes(sessionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session type.",
      });
    }

    const batch = await SessionBatch.create({
      batchName: cleanText(batchName, 100),
      batchId: cleanText(batchId, 150),
      academicSession: cleanText(academicSession || "", 100),
      scheduleTitle: cleanText(
        scheduleTitle || "Postgraduate Progress Presentation Schedule",
        150,
      ),
      sessionType,
      rubricId: rubricId || null,
      date: normalizeDateOnly(date),
      startTime: cleanText(startTime, 20),
      slotDurationMinutes: Number(slotDurationMinutes || 60),
      breakBetweenSlotsMinutes: Number(breakBetweenSlotsMinutes ?? 5),
      googleMeetLink: cleanText(googleMeetLink, 500),
      status: status || "active",
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, batch });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Batch ID already exists. Please use another Batch ID.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create batch.",
      error: error.message,
    });
  }
};

exports.getBatches = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const batches = await SessionBatch.find()
      .populate("rubricId", "name sessionType")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, batches });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load batches.",
      error: error.message,
    });
  }
};

exports.getBatchById = async (req, res) => {
  try {
    const batch = await SessionBatch.findOne({ batchId: req.params.batchId })
      .populate("rubricId", "name sessionType")
      .populate("createdBy", "name email");

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    res.json({ success: true, batch });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load batch.",
      error: error.message,
    });
  }
};

exports.updateBatch = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const updates = {};

    [
      "batchName",
      "academicSession",
      "scheduleTitle",
      "sessionType",
      "rubricId",
      "date",
      "startTime",
      "slotDurationMinutes",
      "breakBetweenSlotsMinutes",
      "googleMeetLink",
      "status",
    ].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (updates.batchName)
      updates.batchName = cleanText(updates.batchName, 100);
    if (updates.academicSession)
      updates.academicSession = cleanText(updates.academicSession, 100);
    if (updates.scheduleTitle)
      updates.scheduleTitle = cleanText(updates.scheduleTitle, 150);
    if (updates.googleMeetLink)
      updates.googleMeetLink = cleanText(updates.googleMeetLink, 500);
    if (updates.date) updates.date = normalizeDateOnly(updates.date);

    const batch = await SessionBatch.findOneAndUpdate(
      { batchId: req.params.batchId },
      updates,
      { new: true },
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    res.json({ success: true, batch });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update batch.",
      error: error.message,
    });
  }
};
