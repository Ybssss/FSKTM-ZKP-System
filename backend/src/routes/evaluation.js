const express = require("express");
const router = express.Router();
const evaluationController = require("../controllers/evaluationController");
const { authenticateToken } = require("../middleware/auth");

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
