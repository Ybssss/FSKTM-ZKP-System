const Evaluation = require("../models/Evaluation");
const User = require("../models/User");
const PermissionRequest = require("../models/PermissionRequest");
const crypto = require("crypto");
const Timetable = require("../models/Timetable");
const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanText = (value = "") =>
  String(value)
    .normalize("NFKC")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getAuthUserId = (req) => req.user.id || req.user._id;

const isSameId = (a, b) => String(a || "") === String(b || "");

const hasActivePermissionStatus = ["PENDING", "APPROVED"];

const STUDENT_SELECT =
  "name matricNumber userId program yearOfStudy email researchTitle supervisorId";
const EVALUATOR_SELECT = "name email userId role profession expertiseTags";
const RUBRIC_SELECT = "name sessionType criteria";
const SESSION_SELECT =
  "title sessionType date startTime endTime venue googleMeetLink batchId batchName academicSession scheduleTitle status studentDocuments students panels rubricId";

const attachSessionInfo = (evaluation) => {
  if (!evaluation) return evaluation;

  const session = evaluation.sessionId;
  if (session && typeof session === "object") {
    evaluation.sessionInfo = {
      _id: session._id,
      title: session.title || "",
      sessionType: session.sessionType || evaluation.sessionType || "",
      date: session.date || null,
      startTime: session.startTime || "",
      endTime: session.endTime || "",
      venue: session.venue || "",
      googleMeetLink: session.googleMeetLink || "",
      batchId: session.batchId || "",
      batchName: session.batchName || "",
      academicSession: session.academicSession || evaluation.semester || "",
      scheduleTitle: session.scheduleTitle || "",
      status: session.status || "",
      studentDocuments: session.studentDocuments || [],
      students: session.students || [],
      panels: session.panels || [],
    };
  }

  return evaluation;
};

const normalizePermissionRecord = (request) => {
  if (!request) return request;
  const doc = request.toObject ? request.toObject() : request;
  if (doc.targetEvaluationId && typeof doc.targetEvaluationId === "object") {
    doc.targetEvaluationId = attachSessionInfo(doc.targetEvaluationId);
  }
  return doc;
};

const detailedPermissionPopulate = (query) =>
  query
    .populate("requestingPanelId", EVALUATOR_SELECT)
    .populate("studentId", STUDENT_SELECT)
    .populate("owningPanelId", EVALUATOR_SELECT)
    .populate("approvedBy", EVALUATOR_SELECT)
    .populate("withdrawnBy", EVALUATOR_SELECT)
    .populate({
      path: "targetEvaluationId",
      select:
        "sessionType semester status totalMarks createdAt updatedAt rubricId evaluatorId studentId sessionId scores qualitativeFeedback overallComments summaryOfProgress commentsForImprovement overallSuggestions formFiller isUnlocked",
      populate: [
        { path: "studentId", select: STUDENT_SELECT },
        { path: "evaluatorId", select: EVALUATOR_SELECT },
        { path: "rubricId", select: RUBRIC_SELECT },
        {
          path: "sessionId",
          select: SESSION_SELECT,
          populate: {
            path: "studentDocuments.uploadedBy",
            select: "name userId matricNumber email role",
          },
        },
      ],
    })
    .populate({
      path: "currentSessionId",
      select: SESSION_SELECT,
    });

const canRequesterAccessStudent = async ({
  requester,
  requesterId,
  studentId,
  currentSessionId,
}) => {
  if (requester.role === "admin") return true;

  const assignedByUserModel = requester.assignedStudents?.some(
    (assignedStudentId) => isSameId(assignedStudentId, studentId),
  );

  if (assignedByUserModel) return true;

  if (!currentSessionId) return false;

  const matchingCurrentSession = await Timetable.findOne({
    _id: currentSessionId,
    students: studentId,
    panels: requesterId,
  }).select("_id");

  return Boolean(matchingCurrentSession);
};

// @desc    Search feedback/evaluations
// @route   GET /api/feedback/search
// @access  Private
exports.searchFeedback = async (req, res) => {
  try {
    const { query, semester, studentId } = req.query;

    console.log("🔍 Searching feedback:", { query, semester, studentId });

    const filter = {};

    // Search by student name or matric number
    if (query && query.trim() !== "") {
      const safeQuery = escapeRegex(cleanText(query)).slice(0, 80);

      const students = await User.find({
        role: "student",
        $or: [
          { name: new RegExp(safeQuery, "i") },
          { matricNumber: new RegExp(safeQuery, "i") },
          { userId: new RegExp(safeQuery, "i") },
        ],
      }).select("_id");

      if (students.length > 0) {
        filter.studentId = { $in: students.map((s) => s._id) };
      } else {
        // No students found matching query
        console.log("⚠️  No students found matching query");
        return res.json({
          success: true,
          count: 0,
          evaluations: [],
        });
      }
    }

    // Filter by semester
    if (semester && semester.trim() !== "") {
      filter.semester = semester;
    }

    // Filter by specific student
    if (studentId && studentId.trim() !== "") {
      filter.studentId = studentId;
    }

    console.log("📊 Search filter:", JSON.stringify(filter, null, 2));

    const evaluations = await Evaluation.find(filter)
      .populate("studentId", STUDENT_SELECT)
      .populate("evaluatorId", EVALUATOR_SELECT)
      .populate("rubricId", RUBRIC_SELECT)
      .populate({
        path: "sessionId",
        select: SESSION_SELECT,
        populate: {
          path: "studentDocuments.uploadedBy",
          select: "name userId matricNumber email role",
        },
      })
      .sort({ date: -1 })
      .lean();

    const viewerId = req.user.id || req.user._id;
    const viewerRole = req.user.role;

    const approvedPermissions = await PermissionRequest.find({
      requestingPanelId: viewerId,
      targetEvaluationId: {
        $in: evaluations.map((ev) => ev._id),
      },
      status: "APPROVED",
    })
      .select("targetEvaluationId")
      .lean();

    const approvedEvaluationIds = new Set(
      approvedPermissions.map((permission) =>
        String(permission.targetEvaluationId),
      ),
    );

    const protectedEvaluations = evaluations.map((ev) => {
      ev = attachSessionInfo(ev);
      const evaluatorId = ev.evaluatorId?._id || ev.evaluatorId;
      const studentOwnerId = ev.studentId?._id || ev.studentId;

      const isAdmin = viewerRole === "admin";
      const isOwnerPanel = String(evaluatorId) === String(viewerId);
      const isStudentOwner =
        viewerRole === "student" && String(studentOwnerId) === String(viewerId);
      const hasApprovedAccess = approvedEvaluationIds.has(String(ev._id));

      const canViewProtectedContent =
        isAdmin || isOwnerPanel || isStudentOwner || hasApprovedAccess;

      const studentDocuments = ev.sessionId?.studentDocuments || [];

      ev.accessGranted = canViewProtectedContent;
      ev.studentDocumentsCount = studentDocuments.length;

      if (!canViewProtectedContent) {
        ev.scores = undefined;
        ev.qualitativeFeedback = undefined;
        ev.overallComments = undefined;
        ev.summaryOfProgress = undefined;
        ev.commentsForImprovement = undefined;
        ev.overallSuggestions = undefined;
        ev.totalMarks = undefined;
        ev.status = undefined;

        if (ev.sessionId) {
          ev.sessionId.studentDocuments = [];
        }
      }

      return ev;
    });

    console.log(`✅ Found ${protectedEvaluations.length} evaluations`);

    res.json({
      success: true,
      count: protectedEvaluations.length,
      evaluations: protectedEvaluations,
    });
  } catch (error) {
    console.error("❌ Search feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching feedback",
      error: error.message,
    });
  }
};

// @desc    Get all unique semesters
// @route   GET /api/feedback/semesters
// @access  Private
exports.getSemesters = async (req, res) => {
  try {
    console.log("📅 Fetching all semesters");

    const semesters = await Evaluation.distinct("semester");

    console.log(`✅ Found ${semesters.length} semesters`);

    res.json({
      success: true,
      count: semesters.length,
      semesters: semesters.sort(),
    });
  } catch (error) {
    console.error("❌ Get semesters error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching semesters",
      error: error.message,
    });
  }
};

// @desc    Get feedback statistics
// @route   GET /api/feedback/stats
// @access  Private
exports.getFeedbackStats = async (req, res) => {
  try {
    const { studentId, semester } = req.query;

    console.log("📊 Calculating feedback statistics");

    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (semester) filter.semester = semester;

    const total = await Evaluation.countDocuments(filter);

    const avgScoreResult = await Evaluation.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          averageScore: { $avg: "$overallScore" },
          minScore: { $min: "$overallScore" },
          maxScore: { $max: "$overallScore" },
        },
      },
    ]);

    const stats = {
      total,
      averageScore:
        avgScoreResult.length > 0
          ? Math.round(avgScoreResult[0].averageScore * 10) / 10
          : 0,
      minScore: avgScoreResult.length > 0 ? avgScoreResult[0].minScore : 0,
      maxScore: avgScoreResult.length > 0 ? avgScoreResult[0].maxScore : 0,
    };

    console.log("✅ Statistics calculated:", stats);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("❌ Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating statistics",
      error: error.message,
    });
  }
};

// @desc    Get recent feedback
// @route   GET /api/feedback/recent
// @access  Private
exports.getRecentFeedback = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log("🔍 Fetching recent feedback");

    const evaluations = await Evaluation.find()
      .populate("studentId", "name matricNumber")
      .populate("evaluatorId", "name")
      .populate("rubricId", RUBRIC_SELECT)
      .sort({ date: -1 })
      .limit(parseInt(limit));

    console.log(`✅ Found ${evaluations.length} recent evaluations`);

    res.json({
      success: true,
      count: evaluations.length,
      evaluations,
    });
  } catch (error) {
    console.error("❌ Get recent feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent feedback",
      error: error.message,
    });
  }
};

// @desc    Request permission to view historical evaluation
// @route   POST /api/feedback/permissions/request
// @access  Private (Panels)
exports.requestAccess = async (req, res) => {
  try {
    const { targetEvaluationId, currentSessionId } = req.body;
    const requestingPanelId = getAuthUserId(req);

    if (!targetEvaluationId) {
      return res.status(400).json({
        success: false,
        message: "Target evaluation is required.",
      });
    }

    const targetEvaluation = await Evaluation.findById(targetEvaluationId)
      .select("studentId evaluatorId sessionId status")
      .populate("sessionId", "students panels");

    if (!targetEvaluation) {
      return res.status(404).json({
        success: false,
        message: "Target evaluation not found.",
      });
    }

    if (targetEvaluation.status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Only completed historical evaluations can be requested.",
      });
    }

    const studentId = targetEvaluation.studentId;
    const owningPanelId = targetEvaluation.evaluatorId;

    if (isSameId(owningPanelId, requestingPanelId)) {
      return res.status(400).json({
        success: false,
        message: "You already own this evaluation record.",
      });
    }

    const requester = await User.findById(requestingPanelId).select(
      "role assignedStudents",
    );

    if (!requester) {
      return res.status(404).json({
        success: false,
        message: "Requesting user not found.",
      });
    }

    if (!["admin", "panel"].includes(requester.role)) {
      return res.status(403).json({
        success: false,
        message: "Only panels or admins can request historical access.",
      });
    }

    const existing = await PermissionRequest.findOne({
      requestingPanelId,
      targetEvaluationId,
      status: { $in: hasActivePermissionStatus },
    });

    if (existing?.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Access has already been granted for this evaluation.",
      });
    }

    if (existing?.status === "PENDING") {
      return res.status(400).json({
        success: false,
        message: "You already have a pending request for this evaluation.",
      });
    }

    const permission = await PermissionRequest.create({
      requestingPanelId,
      targetEvaluationId,
      owningPanelId,
      studentId,
      currentSessionId: currentSessionId || null,
      scope: "SINGLE_EVALUATION",
      reason: cleanText(
        req.body.reason ||
          "Need to review historical context for current evaluation.",
      ),
    });

    res.json({
      success: true,
      message: "Permission requested successfully.",
      permission,
    });
  } catch (error) {
    console.error("Request Access Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to request access.",
      error: error.message,
    });
  }
};

exports.requestStudentHistoryAccess = async (req, res) => {
  try {
    const { studentId, currentSessionId } = req.body;
    const requestingPanelId = getAuthUserId(req);

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required.",
      });
    }

    const requester = await User.findById(requestingPanelId).select(
      "role assignedStudents",
    );

    if (!requester) {
      return res.status(404).json({
        success: false,
        message: "Requesting user not found.",
      });
    }

    if (!["admin", "panel"].includes(requester.role)) {
      return res.status(403).json({
        success: false,
        message: "Only panels or admins can request historical access.",
      });
    }

    const isAssignedToStudent = await canRequesterAccessStudent({
      requester,
      requesterId: requestingPanelId,
      studentId,
      currentSessionId,
    });

    if (!isAssignedToStudent) {
      return res.status(403).json({
        success: false,
        message:
          "You can only request historical access for students currently assigned to you.",
      });
    }

    const evaluationFilter = {
      studentId,
      status: "COMPLETED",
    };

    if (currentSessionId) {
      evaluationFilter.sessionId = { $ne: currentSessionId };
    }

    const historicalEvaluations = await Evaluation.find(evaluationFilter)
      .select("_id evaluatorId studentId sessionId status")
      .lean();

    const requestableEvaluations = historicalEvaluations.filter(
      (evaluation) => !isSameId(evaluation.evaluatorId, requestingPanelId),
    );

    if (requestableEvaluations.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No requestable historical evaluations found. You may already own all available records.",
      });
    }

    const targetEvaluationIds = requestableEvaluations.map(
      (evaluation) => evaluation._id,
    );

    const existingActiveRequests = await PermissionRequest.find({
      requestingPanelId,
      targetEvaluationId: { $in: targetEvaluationIds },
      status: { $in: hasActivePermissionStatus },
    })
      .select("targetEvaluationId status")
      .lean();

    const existingActiveIds = new Set(
      existingActiveRequests.map((request) =>
        String(request.targetEvaluationId),
      ),
    );

    const batchId = crypto.randomUUID();

    const permissionDocs = requestableEvaluations
      .filter((evaluation) => !existingActiveIds.has(String(evaluation._id)))
      .map((evaluation) => ({
        requestingPanelId,
        targetEvaluationId: evaluation._id,
        owningPanelId: evaluation.evaluatorId,
        studentId: evaluation.studentId,
        currentSessionId: currentSessionId || null,
        batchId,
        scope: "STUDENT_HISTORY",
        reason: cleanText(
          req.body.reason ||
            "Need to review all previous evaluations and materials for current assigned evaluation.",
        ),
      }));

    if (permissionDocs.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "All available historical evaluations already have pending or approved access requests.",
      });
    }

    const permissions = await PermissionRequest.insertMany(permissionDocs, {
      ordered: false,
    });

    res.json({
      success: true,
      message: `Created ${permissions.length} historical access request(s).`,
      batchId,
      createdCount: permissions.length,
      skippedCount: requestableEvaluations.length - permissions.length,
      permissions,
    });
  } catch (error) {
    console.error("Request Student History Access Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to request student history access.",
      error: error.message,
    });
  }
};

exports.requestUnlockEvaluation = async (req, res) => {
  try {
    const requesterId = getAuthUserId(req);
    const { targetEvaluationId, reason } = req.body;

    if (!targetEvaluationId) {
      return res.status(400).json({
        success: false,
        message: "Target evaluation is required.",
      });
    }

    const evaluation = await Evaluation.findById(targetEvaluationId).select(
      "studentId evaluatorId status isUnlocked",
    );

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: "Evaluation not found.",
      });
    }

    if (evaluation.status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Only completed evaluations can be requested for unlock.",
      });
    }

    if (!isSameId(evaluation.evaluatorId, requesterId)) {
      return res.status(403).json({
        success: false,
        message:
          "Only the original evaluator can request revision access for this evaluation.",
      });
    }

    if (evaluation.isUnlocked) {
      return res.status(400).json({
        success: false,
        message: "This evaluation is already unlocked for revision.",
      });
    }

    const existing = await PermissionRequest.findOne({
      requestingPanelId: requesterId,
      targetEvaluationId,
      scope: "UNLOCK_EVALUATION",
      status: { $in: ["PENDING", "APPROVED"] },
    });

    if (existing?.status === "PENDING") {
      return res.status(400).json({
        success: false,
        message: "You already have a pending unlock request.",
      });
    }

    if (existing?.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Unlock request has already been approved.",
      });
    }

    const permission = await PermissionRequest.create({
      requestingPanelId: requesterId,
      targetEvaluationId,
      owningPanelId: evaluation.evaluatorId,
      studentId: evaluation.studentId,
      scope: "UNLOCK_EVALUATION",
      reason: cleanText(
        reason || "Need to revise submitted evaluation scores or remarks.",
      ),
    });

    res.json({
      success: true,
      message: "Unlock request sent to administration.",
      permission,
    });
  } catch (error) {
    console.error("Request Unlock Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to request unlock.",
      error: error.message,
    });
  }
};

// @desc    Get my permission requests
// @route   GET /api/feedback/permissions/my
// @access  Private (Panels)
exports.getMyPermissions = async (req, res) => {
  try {
    const requestingPanelId = getAuthUserId(req);
    const requestedStatus = cleanText(req.query.status || "", 20);

    const filter = { requestingPanelId };
    if (["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"].includes(requestedStatus)) {
      filter.status = requestedStatus;
    }

    const requests = await detailedPermissionPopulate(
      PermissionRequest.find(filter),
    ).sort({ createdAt: -1 });

    res.json({ success: true, count: requests.length, requests: requests.map(normalizePermissionRecord) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch permissions.",
      error: error.message,
    });
  }
};

// @desc    Admin explicitly responds to a permission/unlock request
// @route   POST /api/feedback/permissions/respond
// @access  Private (Admin only)
exports.respondToRequest = async (req, res) => {
  try {
    const responderId = getAuthUserId(req);
    const { requestId, action } = req.body;

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Use APPROVED or REJECTED.",
      });
    }

    const request = await PermissionRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Only PENDING requests can be responded to. Current status: ${request.status}.`,
      });
    }

    const isAdmin = req.user.role === "admin";
    const isOriginalOwner = isSameId(request.owningPanelId, responderId);
    const isUnlockRequest = request.scope === "UNLOCK_EVALUATION";

    if (isUnlockRequest && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin can approve or reject evaluation unlock requests.",
      });
    }

    if (!isUnlockRequest && !isAdmin && !isOriginalOwner) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin or the original evaluation owner can respond to this request.",
      });
    }

    const updatedRequest = await PermissionRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          status: action,
          approvedBy: action === "APPROVED" ? responderId : null,
          approvedAt: action === "APPROVED" ? new Date() : null,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (isUnlockRequest && action === "APPROVED") {
      await Evaluation.findByIdAndUpdate(request.targetEvaluationId, {
        $set: {
          isUnlocked: true,
          unlockedBy: responderId,
          unlockedAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      message: `Request has been ${action}.`,
      request: updatedRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};


exports.unlockOwnEvaluation = async (req, res) => {
  try {
    const actorId = getAuthUserId(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Evaluation ID is required.",
      });
    }

    const evaluation = await Evaluation.findById(id);

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: "Evaluation not found.",
      });
    }

    if (evaluation.status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Only completed evaluations need to be unlocked for editing.",
      });
    }

    const isAdmin = req.user.role === "admin";
    const isOriginalEvaluator = isSameId(evaluation.evaluatorId, actorId);

    if (!isAdmin && !isOriginalEvaluator) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin or the original evaluator can unlock this evaluation.",
      });
    }

    if (isAdmin && !isOriginalEvaluator) {
      return res.status(403).json({
        success: false,
        message:
          "Admin can directly unlock only evaluations authored by themselves. Other evaluators must request unlock approval.",
      });
    }

    const updatedEvaluation = await Evaluation.findByIdAndUpdate(
      id,
      {
        $set: {
          isUnlocked: true,
          unlockedBy: actorId,
          unlockedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    );

    res.json({
      success: true,
      message: "Evaluation unlocked. You can now edit and resubmit it.",
      evaluation: updatedEvaluation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to unlock evaluation.",
      error: error.message,
    });
  }
};

exports.getIncomingPermissions = async (req, res) => {
  try {
    const viewerId = getAuthUserId(req);
    const requestedStatus = cleanText(req.query.status || "PENDING", 20);

    const allowedStatuses = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"];
    const status = allowedStatuses.includes(requestedStatus)
      ? requestedStatus
      : "PENDING";

    const filter =
      req.user.role === "admin"
        ? { status }
        : req.user.role === "panel"
          ? {
              owningPanelId: viewerId,
              status,
              requestingPanelId: { $ne: viewerId },
              scope: { $ne: "UNLOCK_EVALUATION" },
            }
          : null;

    if (!filter) {
      return res.status(403).json({
        success: false,
        message:
          "Only admins and panels can view incoming permission requests.",
      });
    }

    const requests = await detailedPermissionPopulate(
      PermissionRequest.find(filter),
    ).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: requests.length,
      requests: requests.map(normalizePermissionRecord),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch incoming permission requests.",
      error: error.message,
    });
  }
};

exports.withdrawPermission = async (req, res) => {
  try {
    const actorId = getAuthUserId(req);
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required.",
      });
    }

    const request = await PermissionRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Permission request not found.",
      });
    }

    if (request.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Only APPROVED permissions can be withdrawn.",
      });
    }

    const isAdmin = req.user.role === "admin";
    const isOriginalOwner = isSameId(request.owningPanelId, actorId);

    if (!isAdmin && !isOriginalOwner) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin or the original evaluation owner can withdraw this permission.",
      });
    }

    const updatedRequest = await PermissionRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          status: "WITHDRAWN",
          withdrawnBy: actorId,
          withdrawnAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    res.json({
      success: true,
      message: "Permission withdrawn successfully.",
      request: updatedRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to withdraw permission.",
      error: error.message,
    });
  }
};

// @desc    Admin fetches ALL pending requests globally
// @route   GET /api/feedback/permissions/all
// @access  Private (Admin only)
exports.getAllPermissions = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const requestedStatus = cleanText(req.query.status || "", 20);
    const filter = {};
    if (["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"].includes(requestedStatus)) {
      filter.status = requestedStatus;
    }

    const requests = await detailedPermissionPopulate(
      PermissionRequest.find(filter),
    ).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: requests.length,
      requests: requests.map(normalizePermissionRecord),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch permissions.",
      error: error.message,
    });
  }
};
