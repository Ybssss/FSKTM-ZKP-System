// src/controllers/evaluationController.js
const Evaluation = require("../models/Evaluation");
const Session = require("../models/Session");
const { calculateUTHMGrade } = require("../utils/gradeCalculator");

// ==========================================
// 1. GET ALL EVALUATIONS
// ==========================================
exports.getAllEvaluations = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id || req.user.userId;
    const role = req.user.role;

    let query = {};
    if (role === "panel") query = { evaluatorId: userId };
    else if (role === "student") query = { studentId: userId };

    const evaluations = await Evaluation.find(query)
      .populate("studentId", "name email")
      .populate("evaluatorId", "name email")
      .populate("sessionId", "semester sessionType")
      .populate("rubricId", "name criteria")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: evaluations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 2. SUBMIT EVALUATION
// ==========================================
exports.submitEvaluation = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const evaluatorId = req.user._id || req.user.id || req.user.userId;

    // Find the Pending Evaluation that was created by the Admin
    const evaluation = await Evaluation.findOne({ sessionId, evaluatorId });

    if (!evaluation) {
      return res
        .status(404)
        .json({ error: "Pending evaluation not found for this session." });
    }

    if (evaluation.status === "COMPLETED") {
      return res
        .status(400)
        .json({ error: "You have already submitted this evaluation." });
    }

    // Update with the submitted data based on session type
    if (evaluation.sessionType === "PROGRESS_ASSESSMENT") {
      evaluation.summaryOfProgress = req.body.summaryOfProgress;
      evaluation.commentsForImprovement = req.body.commentsForImprovement;
      evaluation.overallSuggestions = req.body.overallSuggestions;
    } else {
      evaluation.scores = req.body.scores;
      evaluation.totalMarks = req.body.totalMarks;
      evaluation.overallComments = req.body.overallComments;
    }

    // Mark as COMPLETED
    evaluation.status = "COMPLETED";
    await evaluation.save();

    res
      .status(200)
      .json({
        success: true,
        message: "Evaluation submitted successfully.",
        data: evaluation,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 3. SEARCH HISTORICAL COMMENTS (Dr. Samihah's Feature)
// ==========================================
exports.searchHistoricalComments = async (req, res) => {
  try {
    const { searchQuery } = req.query;

    if (!searchQuery) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // MongoDB Full-Text Search across historical evaluations
    const results = await Evaluation.find({
      $text: { $search: searchQuery },
    })
      .sort({ score: { $meta: "textScore" } }) // Sorts by best match
      .populate("sessionId", "semester sessionType")
      .populate("evaluatorId", "name"); // Fetch panel's name

    res.status(200).json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
