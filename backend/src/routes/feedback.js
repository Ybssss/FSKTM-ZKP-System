const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const feedbackController = require('../controllers/feedbackController');

// Protect all routes
router.use(authenticateToken);

// Search feedback
router.get('/search', feedbackController.searchFeedback);

// Get all semesters
router.get('/semesters', feedbackController.getSemesters);

// Get feedback statistics
router.get('/stats', feedbackController.getFeedbackStats);

// Get recent feedback
router.get('/recent', feedbackController.getRecentFeedback);

module.exports = router;
