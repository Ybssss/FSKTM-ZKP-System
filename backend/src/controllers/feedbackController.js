const Evaluation = require("../models/Evaluation");
const User = require("../models/User");
const PermissionRequest = require("../models/PermissionRequest");

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
      const students = await User.find({
        role: "student",
        $or: [
          { name: new RegExp(query, "i") },
          { matricNumber: new RegExp(query, "i") },
          { userId: new RegExp(query, "i") },
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
      .populate("studentId", "name matricNumber program email")
      .populate("evaluatorId", "name email")
      .populate("rubricId", "name")
      .sort({ date: -1 });

    console.log(`✅ Found ${evaluations.length} evaluations`);

    res.json({
      success: true,
      count: evaluations.length,
      evaluations,
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
      .populate("rubricId", "name")
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
    const { targetEvaluationId, owningPanelId, studentId } = req.body;

    // Safely extract the ID of the person making the request
    const requestingPanelId = req.user.id || req.user._id || req.user.userId;

    // Prevent duplicate spam requests
    const existing = await PermissionRequest.findOne({
      requestingPanelId,
      targetEvaluationId,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You already have a request submitted for this document.",
      });
    }

    const newReq = new PermissionRequest({
      requestingPanelId,
      targetEvaluationId,
      owningPanelId,
      studentId,
    });

    await newReq.save();

    res.json({
      success: true,
      message: "Permission requested successfully.",
      permission: newReq,
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

// @desc    Get my permission requests
// @route   GET /api/feedback/permissions/my
// @access  Private (Panels)
exports.getMyPermissions = async (req, res) => {
  try {
    const requestingPanelId = req.user.id || req.user._id || req.user.userId;
    const requests = await PermissionRequest.find({ requestingPanelId });

    res.json({ success: true, requests });
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
    // Only Admins or Superadmins can perform this global action
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const { requestId, action } = req.body; // action = "APPROVED" or "REJECTED"

    const request = await PermissionRequest.findById(requestId);
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });

    request.status = action;
    await request.save();

    res.json({ success: true, message: `Request has been ${action}.` });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error.", error: error.message });
  }
};

// @desc    Admin fetches ALL pending requests globally
// @route   GET /api/feedback/permissions/all
// @access  Private (Admin only)
exports.getAllPermissions = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }
    const requests = await PermissionRequest.find()
      .populate("requestingPanelId", "name email")
      .populate("studentId", "name matricNumber")
      .populate({
        path: "targetEvaluationId",
        select: "sessionType semester",
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch permissions." });
  }
};
