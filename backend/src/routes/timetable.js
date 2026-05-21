const express = require("express");
const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs");

const router = express.Router();
const { authenticateToken, requireRole } = require("../middleware/auth");
const evaluationController = require("../controllers/evaluationController");

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
} = require("../controllers/timetableController");

const matchingController = require("../controllers/matchingController");
const expertiseService = require("../services/expertiseService");

const uploadDir = path.join(os.tmpdir(), "fsktm-zkp-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

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
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safeName = String(file.originalname || "upload")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(-120);
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        "Unsupported file type. Please upload PDF, Word, PowerPoint, Excel, text, PNG, JPG, or WebP files.",
      ),
    );
  },
});

const handleUploadErrors = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const statusCode = error instanceof multer.MulterError ? 400 : 415;
    res.status(statusCode).json({
      success: false,
      message: error.message || "File upload failed.",
    });
  });
};

router.use(authenticateToken);

router.get("/my", getMyTimetable);

router.post("/bulk", requireRole(["admin"]), createBulkTimetables);
router.post("/create", requireRole(["admin"]), createTimetable);
router.delete("/:id", requireRole(["admin"]), deleteTimetable);

router.post(
  "/:id/documents",
  requireRole(["student", "admin"]),
  handleUploadErrors,
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
    res.json({ success: true, userId, expertise, count: expertise.length });
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
router.get("/", requireRole(["admin"]), getTimetables);
router.get("/:id", getTimetableById);

router.post("/submit", evaluationController.submitEvaluation);
router.get("/search", evaluationController.searchHistoricalComments);
router.get("/", evaluationController.getAllEvaluations);

module.exports = router;
