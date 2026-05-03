const express = require("express");
const router = express.Router();
const evaluationController = require("../controllers/evaluationController");

// Submit an evaluation (Scored or Qualitative)
router.post("/submit", evaluationController.submitEvaluation);

// Search old comments (For the Admin Dashboard)
router.get("/search", evaluationController.searchHistoricalComments);

module.exports = router;
