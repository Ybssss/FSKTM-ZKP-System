const express = require("express");
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

router.use(authenticateToken);

router.get("/my", getMyTimetable);

router.post("/bulk", requireRole(["admin"]), createBulkTimetables);
router.post("/create", requireRole(["admin"]), createTimetable);
router.delete("/:id", requireRole(["admin"]), deleteTimetable);

router.post(
  "/:id/documents",
  requireRole(["student", "admin"]),
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
    res
      .status(500)
      .json({
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
