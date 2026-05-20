const Evaluation = require("../models/Evaluation");
const Session = require("../models/Session");
const { calculateUTHMGrade } = require("../utils/gradeCalculator");
const PermissionRequest = require("../models/PermissionRequest");

// --- 1. Filter getAllEvaluations based on Permissions ---
exports.getAllEvaluations = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id || req.user.userId;
    const role = req.user.role;

    let query = {};
    if (role === "panel") query = { evaluatorId: userId };
    else if (role === "student") query = { studentId: userId };

    const evaluations = await Evaluation.find(query)
      .populate({
        path: "studentId",
        select: "name email matricNumber researchTitle supervisorId",
        strictPopulate: false,
      })
      .populate({
        path: "evaluatorId",
        select: "name email expertiseTags",
        strictPopulate: false,
      })
      .populate({
        path: "sessionId",
        select: "semester sessionType date venue",
        strictPopulate: false,
      })
      .populate({
        path: "rubricId",
        select: "name sessionType criteria",
        strictPopulate: false,
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: evaluations });
  } catch (error) {
    console.error("Evaluation Fetch Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 2. Request Access ---
exports.requestAccess = async (req, res) => {
  try {
    const requestingPanelId = req.user._id || req.user.id;
    const { targetEvaluationId } = req.body;

    const evaluation = await Evaluation.findById(targetEvaluationId);
    if (!evaluation)
      return res.status(404).json({ error: "Evaluation not found." });

    const newReq = await PermissionRequest.create({
      requestingPanelId,
      targetEvaluationId,
      studentId: evaluation.studentId,
      owningPanelId: evaluation.evaluatorId, // The person who wrote it
      reason: req.body.reason || "Requesting access for historical context.",
    });

    res.status(201).json({
      success: true,
      message: "Request sent to the original evaluator.",
    });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(400)
        .json({ error: "You already requested access to this." });
    res.status(500).json({ error: error.message });
  }
};

// --- 3. View My Pending Approvals ---
exports.getPendingApprovals = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const requests = await PermissionRequest.find({
      owningPanelId: userId,
      status: "PENDING",
    })
      .populate("requestingPanelId", "name email")
      .populate("studentId", "name")
      .populate({ path: "targetEvaluationId", select: "sessionType semester" });

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 4. Approve/Reject Request ---
exports.respondToRequest = async (req, res) => {
  try {
    const { requestId, action } = req.body; // action: 'APPROVED' or 'REJECTED'
    const userId = req.user._id || req.user.id;

    const permissionReq = await PermissionRequest.findOneAndUpdate(
      { _id: requestId, owningPanelId: userId },
      { status: action },
      { new: true },
    );

    if (!permissionReq)
      return res.status(404).json({ error: "Request not found." });

    res
      .status(200)
      .json({ success: true, message: `Request has been ${action}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    if (evaluation.status === "COMPLETED" && !evaluation.isUnlocked) {
      return res.status(400).json({
        success: false,
        error:
          "This evaluation is locked. Please request unlock approval before revising.",
      });
    }

    // Update with the submitted data based on session type
    // 2. Update with the submitted data
    if (evaluation.sessionType === "PROGRESS_ASSESSMENT") {
      evaluation.summaryOfProgress = req.body.summaryOfProgress;
      evaluation.commentsForImprovement = req.body.commentsForImprovement;
      evaluation.overallSuggestions = req.body.overallSuggestions;
    } else {
      evaluation.scores = req.body.scores;
      evaluation.qualitativeFeedback = req.body.qualitativeFeedback;
      evaluation.totalMarks = req.body.totalMarks;
      evaluation.overallComments = req.body.overallComments;
    }

    // Mark as COMPLETED
    evaluation.status = "COMPLETED";
    evaluation.isUnlocked = false;
    evaluation.lastRelockedAt = new Date();

    const savedEvaluation = await evaluation.save();

    // Re-populate for the frontend report view
    const completedEval = await Evaluation.findById(savedEvaluation._id)
      .populate("studentId", "name matricNumber program")
      .populate("evaluatorId", "name")
      .populate("rubricId", "name");

    res.status(200).json({
      success: true,
      message: "Evaluation submitted successfully.",
      data: evaluation,
      data: completedEval,
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
