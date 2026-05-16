const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const feedbackController = require("../controllers/feedbackController");

// Protect all routes
router.use(authenticateToken);
router.post(
  "/permissions/request",
  authenticateToken,
  feedbackController.requestAccess,
);
router.get(
  "/permissions/my",
  authenticateToken,
  feedbackController.getMyPermissions,
);

// Search feedback
router.get("/search", feedbackController.searchFeedback);

// Get all semesters
router.get("/semesters", feedbackController.getSemesters);

// Get feedback statistics
router.get("/stats", feedbackController.getFeedbackStats);

// Get recent feedback
router.get("/recent", feedbackController.getRecentFeedback);

// Admin Global Permission Routes
router.get(
  "/permissions/all",
  authenticateToken,
  feedbackController.getAllPermissions,
);
router.post(
  "/permissions/respond",
  authenticateToken,
  feedbackController.respondToRequest,
);

module.exports = router;
