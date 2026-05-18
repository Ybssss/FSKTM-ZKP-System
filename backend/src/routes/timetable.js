const express = require("express");
const router = express.Router();
const { authenticateToken, requireRole } = require("../middleware/auth");
const evaluationController = require("../controllers/evaluationController");
const multer = require("multer");
const os = require("os");

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
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only PDF, DOC, DOCX, PPT, PPTX, PNG, and JPG files are allowed.",
        ),
      );
    }

    cb(null, true);
  },
});

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

router.use(authenticateToken);

router.get("/my", getMyTimetable);

router.post("/bulk", requireRole(["admin"]), createBulkTimetables);
router.post("/create", requireRole(["admin"]), createTimetable);
router.delete("/:id", requireRole(["admin"]), deleteTimetable);

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
