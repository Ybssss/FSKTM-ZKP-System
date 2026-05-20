const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const feedbackController = require("../controllers/feedbackController");

// Protect all routes
router.use(authenticateToken);

// Permission request routes
router.post("/permissions/request", feedbackController.requestAccess);

router.post(
  "/permissions/request-student-history",
  feedbackController.requestStudentHistoryAccess,
);

router.get("/permissions/my", feedbackController.getMyPermissions);

router.get("/permissions/incoming", feedbackController.getIncomingPermissions);

router.get("/permissions/all", feedbackController.getAllPermissions);

router.post("/permissions/respond", feedbackController.respondToRequest);

router.post("/permissions/withdraw", feedbackController.withdrawPermission);

// Search feedback
router.get("/search", feedbackController.searchFeedback);

// Get all semesters
router.get("/semesters", feedbackController.getSemesters);

// Get feedback statistics
router.get("/stats", feedbackController.getFeedbackStats);

// Get recent feedback
router.get("/recent", feedbackController.getRecentFeedback);

module.exports = router;
