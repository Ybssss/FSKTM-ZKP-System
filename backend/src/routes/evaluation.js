// backend/src/routes/evaluation.js
const express = require("express");
const router = express.Router();
const evaluationController = require("../controllers/evaluationController");
const { authenticateToken } = require("../middleware/auth");
const Evaluation = require("../models/Evaluation"); // 🔴 REQUIRED for the student route

// 1. Get all evaluations (For the EvaluationPage dashboard)
router.get("/", authenticateToken, evaluationController.getAllEvaluations);

// 2. Submit an evaluation (Scored or Qualitative)
router.post(
  "/submit",
  authenticateToken,
  evaluationController.submitEvaluation,
);

// 3. Search old comments (For the Admin Dashboard)
router.get(
  "/search",
  authenticateToken,
  evaluationController.searchHistoricalComments,
);

// 🔴 NEW: Get evaluations strictly by student ID (Fixes 404 on Student Progress/Reports page)
router.get("/student/:studentId", authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.studentId;

    // Ensure panels can only see their own students' evals, and students can only see their own
    if (
      req.user.role === "student" &&
      req.user.id !== studentId &&
      req.user.userId !== studentId
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied. You can only view your own records.",
        });
    }

    const evaluations = await Evaluation.find({ studentId })
      .populate("evaluatorId", "name email")
      .populate("rubricId", "name criteria")
      .populate("studentId", "name matricNumber researchTitle")
      .sort({ createdAt: -1 });

    res.json({ success: true, evaluations });
  } catch (error) {
    console.error("Fetch Student Evaluations Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch evaluations",
        error: error.message,
      });
  }
});

// 4. Permission-based routes
router.post(
  "/request-access",
  authenticateToken,
  evaluationController.requestAccess,
);
router.get(
  "/pending-requests",
  authenticateToken,
  evaluationController.getPendingApprovals,
);
router.post(
  "/respond-request",
  authenticateToken,
  evaluationController.respondToRequest,
);

module.exports = router;
