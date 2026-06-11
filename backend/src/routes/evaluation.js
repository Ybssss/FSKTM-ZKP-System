const express = require("express");
const router = express.Router();
const evaluationController = require("../controllers/evaluationController");
const { authenticateToken } = require("../middleware/auth");
const Evaluation = require("../models/Evaluation");
const {
  buildEvaluationOutcomeMap,
  ensureSupervisorEvaluations,
  getEvaluationGroupKey,
  sanitizeEvaluationForStudent,
} = require("../utils/evaluationWorkflow");

router.get("/", authenticateToken, evaluationController.getAllEvaluations);

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

router.get(
  "/session/:sessionId",
  authenticateToken,
  evaluationController.getSessionEvaluations,
);

// Students can only see their own published outcomes from this route.
router.get("/student/:studentId", authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const isStudentRequester = req.user.role === "student";

    if (isStudentRequester) {
      const loggedInId = (req.user.id || req.user._id).toString();
      const requestedId = studentId.toString();

      if (loggedInId !== requestedId && req.user.userId !== requestedId) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own records.",
        });
      }
    }

    await ensureSupervisorEvaluations({ studentIds: [studentId] });

    const evaluations = await Evaluation.find({ studentId })
      .populate("evaluatorId", "name email userId role")
      .populate("rubricId", "name criteria")
      .populate("studentId", "name matricNumber researchTitle")
      .populate("sessionId", "title date sessionType academicSession batchName")
      .sort({ createdAt: -1 });

    if (isStudentRequester) {
      const outcomes = buildEvaluationOutcomeMap(evaluations);
      const sanitizedEvaluations = evaluations.map((evaluation) =>
        sanitizeEvaluationForStudent(
          evaluation,
          outcomes.get(getEvaluationGroupKey(evaluation)),
        ),
      );

      return res.json({ success: true, evaluations: sanitizedEvaluations });
    }

    res.json({ success: true, evaluations });
  } catch (error) {
    console.error("Fetch Student Evaluations Error:", error);
    res.status(500).json({
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

router.get("/:id", authenticateToken, evaluationController.getEvaluationById);

module.exports = router;
