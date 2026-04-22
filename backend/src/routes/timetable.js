const express = require("express");
const router = express.Router();
const { authenticateToken, requireRole } = require("../middleware/auth");
const {
  createTimetable,
  getTimetables,
  getMyTimetable,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
  assignPanelToStudent,
  uploadDocument,
  deleteDocument,
  addPanelNotes,
  createBulkTimetables,
  // You will need to create this in your controller later:
  // createBulkTimetables
} = require("../controllers/timetableController");

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// VIEWING ROUTES (All Authenticated Users)
// ==========================================
router.get("/", getTimetables); // Controller should filter based on role involvement
router.get("/my", getMyTimetable); // For Students and Panels to see their assigned sessions
router.get("/:id", getTimetableById);

// ==========================================
// DOCUMENT & NOTES ROUTES
// ==========================================
// Students upload their proposal/progress documents
router.post("/:id/documents", requireRole("student", "admin"), uploadDocument);
router.delete(
  "/:id/documents/:documentId",
  requireRole("student", "admin"),
  deleteDocument,
);

// Panels leave notes during the session
router.post("/:id/notes", requireRole("panel", "admin"), addPanelNotes);

// ==========================================
// EXPERTISE & PANEL MATCHING ROUTES
// ==========================================
const expertiseService = require("../services/expertiseService");

// Get expertise for a specific panel
router.get("/expertise/:userId", requireRole("admin"), async (req, res) => {
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

// Get panel recommendations for a student based on research title
router.post("/match-expertise", requireRole("admin"), async (req, res) => {
  try {
    const { researchTitle, studentId } = req.body;

    if (!researchTitle) {
      return res.status(400).json({
        success: false,
        message: "Research title is required",
      });
    }

    // Get all panels
    const User = require("../models/User");
    const panels = await User.find({ role: "panel" }).select("userId name");

    // Fetch expertise for each panel
    const panelsWithExpertise = await Promise.all(
      panels.map(async (panel) => {
        const expertise = await expertiseService.fetchUserExpertise(
          panel.userId,
        );
        return {
          ...panel.toObject(),
          expertise,
        };
      }),
    );

    // Get recommendations
    const recommendations = expertiseService.getPanelRecommendations(
      researchTitle,
      panelsWithExpertise,
    );

    // Filter out student's supervisor if provided
    let filteredRecommendations = recommendations;
    if (studentId) {
      const student = await User.findById(studentId).populate("supervisorId");
      if (student && student.supervisorId) {
        filteredRecommendations = recommendations.filter(
          (rec) =>
            rec.panelId.toString() !== student.supervisorId._id.toString(),
        );
      }
    }

    res.json({
      success: true,
      researchTitle,
      recommendations: filteredRecommendations,
      totalPanels: panels.length,
      matchedPanels: filteredRecommendations.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error matching expertise",
      error: error.message,
    });
  }
});

// ==========================================
// SCHEDULING & ADMIN ROUTES (STRICT)
// ==========================================
// Only Admins can create, update, or delete sessions
router.post("/", requireRole("admin"), createTimetable);
router.put("/:id", requireRole("admin"), updateTimetable);
router.delete("/:id", requireRole("admin"), deleteTimetable);
router.post("/bulk", requireRole("admin"), createBulkTimetables);

// Panel Assignment (Admin only) - Maps 2 panels to 1 student
router.post("/assign-panel", requireRole("admin"), assignPanelToStudent);

module.exports = router;
