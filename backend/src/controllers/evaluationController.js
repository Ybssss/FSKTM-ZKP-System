const Evaluation = require("../models/Evaluation");
const { calculateUTHMGrade } = require("../utils/gradeCalculator");
const PermissionRequest = require("../models/PermissionRequest");
const Timetable = require("../models/Timetable");
const {
  buildEvaluationOutcomeMap,
  ensureSupervisorEvaluationsForViewer,
  getEvaluationGroupKey,
  sanitizeEvaluationForStudent,
} = require("../utils/evaluationWorkflow");

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const calculateWeightedTotalMarks = (criteria = [], scores = {}) => {
  const total = criteria.reduce((sum, criterion) => {
    const key = criterion.key;
    const weight = Math.max(toFiniteNumber(criterion.weight, 0), 0);
    const maxScore = Math.max(toFiniteNumber(criterion.maxScore, 5), 1);

    if (!key || weight <= 0) return sum;

    const score = clamp(toFiniteNumber(scores[key], 0), 0, maxScore);
    return sum + (score / maxScore) * weight;
  }, 0);

  return Number(total.toFixed(2));
};

// --- 1. Filter getAllEvaluations based on Permissions ---
exports.getAllEvaluations = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id || req.user.userId;
    const role = req.user.role;

    await ensureSupervisorEvaluationsForViewer(req.user);

    let query = {};
    if (role === "panel") query = { evaluatorId: userId };
    else if (role === "student") query = { studentId: userId };

    const evaluations = await Evaluation.find(query)
      .populate({
        path: "studentId",
        select:
          "name email matricNumber program researchTitle researchAbstract supervisorId",
        strictPopulate: false,
      })
      .populate({
        path: "evaluatorId",
        select: "name email userId role expertiseTags",
        strictPopulate: false,
      })
      .populate({
        path: "sessionId",
        select:
          "title semester sessionType date venue startTime endTime studentDocuments",
        strictPopulate: false,
        populate: {
          path: "studentDocuments.uploadedBy",
          select: "name userId matricNumber email role",
        },
      })
      .populate({
        path: "rubricId",
        select: "name sessionType criteria",
        strictPopulate: false,
      })
      .sort({ createdAt: -1 });

    if (role === "student") {
      const outcomes = buildEvaluationOutcomeMap(evaluations);
      const sanitizedEvaluations = evaluations.map((evaluation) =>
        sanitizeEvaluationForStudent(
          evaluation,
          outcomes.get(getEvaluationGroupKey(evaluation)),
        ),
      );

      return res.status(200).json({ success: true, data: sanitizedEvaluations });
    }

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
    const { sessionId, evaluationId } = req.body;
    const evaluatorId = req.user._id || req.user.id || req.user.userId;

    // Find the Pending Evaluation that was created by the Admin
    const evaluation = await Evaluation.findOne(
      evaluationId
        ? { _id: evaluationId, evaluatorId }
        : { sessionId, evaluatorId },
    );

    if (!evaluation) {
      return res
        .status(404)
        .json({ error: "Pending evaluation not found for this evaluator." });
    }

    if (evaluation.status === "COMPLETED" && !evaluation.isUnlocked) {
      return res.status(400).json({
        success: false,
        error:
          "This evaluation is locked. Please request unlock approval before revising.",
      });
    }

    await evaluation.populate("rubricId", "criteria");
    const criteria = evaluation.rubricId?.criteria || [];
    const quantitativeCriteria = criteria.filter(
      (criterion) => criterion.type === "quantitative",
    );
    const qualitativeCriteria = criteria.filter(
      (criterion) => criterion.type === "qualitative",
    );
    const qualitativeFeedback = req.body.qualitativeFeedback || {};

    if (quantitativeCriteria.length) {
      const submittedScores = req.body.scores || {};
      evaluation.scores = submittedScores;
      evaluation.totalMarks = calculateWeightedTotalMarks(
        quantitativeCriteria,
        submittedScores,
      );
    }

    evaluation.qualitativeFeedback = qualitativeFeedback;
    evaluation.overallComments = req.body.overallComments;
    evaluation.summaryOfProgress =
      req.body.summaryOfProgress ||
      qualitativeFeedback.prog_1_summary ||
      qualitativeFeedback[qualitativeCriteria[0]?.key] ||
      "";
    evaluation.commentsForImprovement =
      req.body.commentsForImprovement ||
      qualitativeFeedback.prog_2_improve ||
      qualitativeFeedback[qualitativeCriteria[1]?.key] ||
      "";
    evaluation.overallSuggestions =
      req.body.overallSuggestions ||
      qualitativeFeedback.prog_3_suggest ||
      qualitativeFeedback[qualitativeCriteria[2]?.key] ||
      "";

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

const getAuthUserId = (req) => req.user.id || req.user._id;

const isSameId = (a, b) => String(a || "") === String(b || "");

const hasUserId = (items = [], userId) =>
  items.some((item) => isSameId(item?._id || item, userId));

exports.getSessionEvaluations = async (req, res) => {
  try {
    const viewerId = getAuthUserId(req);
    const viewerRole = req.user.role;
    const { sessionId } = req.params;

    const timetable = await Timetable.findById(sessionId)
      .select("students panels")
      .populate("students", "supervisorId");

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    const isAdmin = viewerRole === "admin";
    const isAssignedPanel =
      viewerRole === "panel" && hasUserId(timetable.panels || [], viewerId);
    const isSupervisor =
      viewerRole === "panel" &&
      (timetable.students || []).some((student) =>
        isSameId(student?.supervisorId, viewerId),
      );

    if (!isAdmin && !isAssignedPanel && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this session's evaluations.",
      });
    }

    const evaluations = await Evaluation.find({ sessionId })
      .populate({
        path: "studentId",
        select:
          "name email matricNumber program researchTitle researchAbstract supervisorId",
        strictPopulate: false,
      })
      .populate({
        path: "evaluatorId",
        select: "name email userId expertiseTags",
        strictPopulate: false,
      })
      .populate({
        path: "sessionId",
        select: "title semester sessionType date startTime endTime venue",
        strictPopulate: false,
      })
      .populate({
        path: "rubricId",
        select: "name sessionType criteria",
        strictPopulate: false,
      })
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      evaluations,
      data: evaluations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch session evaluations.",
      error: error.message,
    });
  }
};

exports.getEvaluationById = async (req, res) => {
  try {
    const viewerId = getAuthUserId(req);
    const viewerRole = req.user.role;

    const evaluation = await Evaluation.findById(req.params.id)
      .populate(
        "studentId",
        "name email matricNumber program researchTitle researchAbstract supervisorId",
      )
      .populate("evaluatorId", "name email userId expertiseTags")
      .populate("rubricId", "name sessionType criteria")
      .populate({
        path: "sessionId",
        select:
          "title sessionType date startTime endTime venue studentDocuments",
        populate: {
          path: "studentDocuments.uploadedBy",
          select: "name userId matricNumber email role",
        },
      });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: "Evaluation not found.",
      });
    }

    const evaluatorId = evaluation.evaluatorId?._id || evaluation.evaluatorId;
    const studentId = evaluation.studentId?._id || evaluation.studentId;

    const isAdmin = viewerRole === "admin";
    const isOwnerPanel = isSameId(evaluatorId, viewerId);
    const isStudentOwner =
      viewerRole === "student" && isSameId(studentId, viewerId);
    const sessionRefId = evaluation.sessionId?._id || evaluation.sessionId;
    const isAssignedSessionPanel =
      viewerRole === "panel" &&
      sessionRefId &&
      Boolean(
        await Timetable.exists({
          _id: sessionRefId,
          panels: viewerId,
        }),
      );

    const approvedPermission = await PermissionRequest.findOne({
      requestingPanelId: viewerId,
      targetEvaluationId: evaluation._id,
      status: "APPROVED",
    }).select("_id");

    const hasApprovedAccess = Boolean(approvedPermission);

    if (
      !isAdmin &&
      !isOwnerPanel &&
      !isStudentOwner &&
      !hasApprovedAccess &&
      !isAssignedSessionPanel
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this evaluation.",
      });
    }

    const doc =
      viewerRole === "student"
        ? sanitizeEvaluationForStudent(
            evaluation,
            buildEvaluationOutcomeMap(
              await Evaluation.find({ studentId })
                .select(
                  "sessionId sessionType semester status totalMarks scores rubricId",
                )
                .populate({
                  path: "rubricId",
                  select: "criteria",
                  strictPopulate: false,
                }),
            ).get(getEvaluationGroupKey(evaluation)),
          )
        : evaluation.toObject();
    doc.accessGranted = true;

    res.json({
      success: true,
      evaluation: doc,
      data: doc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch evaluation.",
      error: error.message,
    });
  }
};
