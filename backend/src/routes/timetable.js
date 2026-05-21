const express = require("express");
const router = express.Router();
const multer = require("multer");
const os = require("os");
const path = require("path");

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
  streamDocumentFile,
  addPanelNotes,
  createBulkTimetables,
  getAvailableBatches,
  getBatchPrintSchedules,
  getBatchPrintSchedule,
  reorderBatchTimeFrames,
} = require("../controllers/timetableController");

const matchingController = require("../controllers/matchingController");
const expertiseService = require("../services/expertiseService");

const maxFileSize = Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024);

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const upload = multer({
  dest: path.join(os.tmpdir(), "fsktm-timetable-documents"),
  limits: {
    fileSize: maxFileSize,
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }

    cb(
      new Error(
        "Unsupported file type. Please upload PDF, Word, PowerPoint, Excel, text, or image files.",
      ),
    );
  },
});

const handleSingleDocumentUpload = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to read uploaded file.",
    });
  });
};

// Public file stream route. This mirrors your previous Google Drive "anyone with link"
// behavior while storing the actual file in MongoDB GridFS.
router.get("/documents/file/:fileId", streamDocumentFile);

router.use(authenticateToken);

router.get("/my", getMyTimetable);

router.get("/batches", requireRole(["admin"]), getAvailableBatches);
router.get("/batches/print", requireRole(["admin"]), getBatchPrintSchedules);
router.post(
  "/batches/reorder-timeframes",
  requireRole(["admin"]),
  reorderBatchTimeFrames,
);
router.get(
  "/batches/:batchId/print",
  requireRole(["admin"]),
  getBatchPrintSchedule,
);

router.post("/bulk", requireRole(["admin"]), createBulkTimetables);
router.post("/create", requireRole(["admin"]), createTimetable);

router.post(
  "/:id/documents",
  requireRole(["student", "admin"]),
  handleSingleDocumentUpload,
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
    const { userId } = req.params;
    const expertise = await expertiseService.fetchUserExpertise(userId);

    res.json({
      success: true,
      userId,
      expertise,
      count: expertise.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching expertise",
      error: error.message,
    });
  }
});

router.post(
  "/match-expertise",
  requireRole(["admin"]),
  matchingController.matchExpertise,
);

router.put("/:id", requireRole(["admin"]), updateTimetable);
router.delete("/:id", requireRole(["admin"]), deleteTimetable);
router.get("/", requireRole(["admin"]), getTimetables);
router.get("/:id", getTimetableById);

module.exports = router;
