const express = require("express");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
const os = require("os");
const { authenticateToken, requireRole } = require("../middleware/auth");

const {
  createTimetable,
  getTimetables,
  getMyTimetable,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
  uploadDocument,
  deleteDocument,
  addPanelNotes,
  createBulkTimetables,
  getAvailableBatches,
  getBatchPrintSchedule,
  getBatchPrintSchedules,
  updateBatchTimeFrames,
  streamDocumentFile,
  streamDocumentFileWithTicket,
  createDocumentFileViewTicket,
} = require("../controllers/timetableController");

const matchingController = require("../controllers/matchingController");
const User = require("../models/User");

const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
];

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024),
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only PDF, DOC, DOCX, PPT, PPTX, PNG, and JPG files are allowed."));
    }
    cb(null, true);
  },
});

router.get("/documents/file/:fileId/view/:filename", streamDocumentFileWithTicket);

router.use(authenticateToken);

router.get("/my", getMyTimetable);
router.get("/documents/file/:fileId", streamDocumentFile);
router.post("/documents/file/:fileId/view-ticket", createDocumentFileViewTicket);

router.post("/bulk", requireRole(["admin"]), createBulkTimetables);
router.post("/create", requireRole(["admin"]), createTimetable);

router.post(
  "/:id/documents",
  requireRole(["student", "admin"]),
  upload.single("file"),
  uploadDocument,
);

router.delete(
  "/:id/documents/:documentId",
  requireRole(["student", "admin"]),
  deleteDocument,
);

router.post("/:id/notes", requireRole(["panel", "admin"]), addPanelNotes);

router.get("/expertise/:userId", requireRole(["admin"]), async (req, res) => {
  try {
    const panelQuery = {
      role: { $in: ["panel", "admin"] },
      $or: [{ userId: req.params.userId }],
    };

    if (mongoose.Types.ObjectId.isValid(req.params.userId)) {
      panelQuery.$or.push({ _id: req.params.userId });
    }

    const panel = await User.findOne(panelQuery)
      .select("userId expertiseTags")
      .lean();

    if (!panel) {
      return res.status(404).json({
        success: false,
        message: "Panel not found.",
      });
    }

    const expertise = Array.isArray(panel.expertiseTags)
      ? panel.expertiseTags.filter(Boolean)
      : [];

    res.json({
      success: true,
      userId: panel.userId,
      expertise,
      count: expertise.length,
      source: "database",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error reading expertise", error: error.message });
  }
});

router.post("/match-expertise", requireRole(["admin"]), matchingController.matchExpertise);

router.get("/batches", requireRole(["admin"]), getAvailableBatches);
router.get("/batches/print", requireRole(["admin"]), getBatchPrintSchedules);
router.get("/batches/:batchId/print", requireRole(["admin"]), getBatchPrintSchedule);
router.post("/batches/:batchId/time-frames", requireRole(["admin"]), updateBatchTimeFrames);

router.put("/:id", requireRole(["admin"]), updateTimetable);
router.delete("/:id", requireRole(["admin"]), deleteTimetable);

router.get("/", requireRole(["admin"]), getTimetables);
router.get("/:id", getTimetableById);

module.exports = router;
