const express = require("express");
const router = express.Router();
const { authenticateToken, requireRole } = require("../middleware/auth");
const evaluationController = require("../controllers/evaluationController");

// Import our updated bulletproof timetable controller
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

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// VIEWING ROUTES (All Authenticated Users)
// ==========================================

// 1. Get Sessions (Uses the bulletproof query we wrote)
router.get("/my", authenticateToken, getMyTimetable);

// 2. Create Bulk Sessions (Uses the auto-evaluate generator!)
router.post(
  "/bulk",
  authenticateToken,
  requireRole("admin", "superadmin"),
  createBulkTimetables,
);

// 3. Create Single Session
router.post(
  "/create",
  authenticateToken,
  requireRole("admin", "superadmin"),
  createTimetable,
);

// 4. Delete Session (Deletes linked evaluations too!)
router.delete(
  "/:id",
  authenticateToken,
  requireRole("admin", "superadmin"),
  deleteTimetable,
);

// ==========================================
// DOCUMENT & NOTES ROUTES
// ==========================================
router.post("/:id/documents", requireRole("student", "admin"), uploadDocument);
router.delete(
  "/:id/documents/:documentId",
  requireRole("student", "admin"),
  deleteDocument,
);
router.post("/:id/notes", requireRole("panel", "admin"), addPanelNotes);

// ==========================================
// EXPERTISE & PANEL MATCHING ROUTES
// ==========================================
router.get(
  "/expertise/:userId",
  requireRole("admin", "superadmin"),
  async (req, res) => {
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
  },
);

// AI Gemini Panel Matcher
router.post(
  "/match-expertise",
  requireRole("admin", "superadmin"),
  matchingController.matchExpertise,
);

// ==========================================
// SCHEDULING & ADMIN ROUTES (STRICT)
// ==========================================

// Update Timetable (Contains the Magic Panel Swap logic!)
router.put(
  "/:id",
  authenticateToken,
  requireRole("admin", "superadmin"),
  updateTimetable,
);

// Backup GET routes
router.get(
  "/",
  authenticateToken,
  requireRole("admin", "superadmin"),
  getTimetables,
);
router.get("/:id", authenticateToken, getTimetableById);

// ==========================================
// EVALUATION ROUTES
// ==========================================
router.post(
  "/submit",
  authenticateToken,
  evaluationController.submitEvaluation,
);
router.get(
  "/search",
  authenticateToken,
  evaluationController.searchHistoricalComments,
);
router.get("/", authenticateToken, evaluationController.getAllEvaluations);

module.exports = router;
