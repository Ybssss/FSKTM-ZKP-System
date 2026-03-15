const Evaluation = require("../models/Evaluation");
const Rubric = require("../models/Rubric");
const User = require("../models/User");

// @desc    Create evaluation
// @route   POST /api/evaluations
// @access  Private (Admin/Panel)
exports.createEvaluation = async (req, res) => {
  try {
    const {
      studentId,
      rubricId,
      semester,
      sessionType,
      scores,
      strengths,
      weaknesses,
      recommendations,
      overallComments,
      overallScore,
      remarks, // Added remarks support
    } = req.body;

    if (!studentId || !rubricId || !semester || !scores) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // 🚀 NEW: PREVENT DUPLICATE SUBMISSIONS
    const existingEvaluation = await Evaluation.findOne({
      studentId,
      evaluatorId: req.user.id, // The current lecturer
      sessionType,
      semester,
    });

    if (existingEvaluation) {
      return res.status(400).json({
        success: false,
        message: `You have already evaluated this student for ${sessionType} in ${semester}. Please edit your existing record in Historical Feedback instead of creating a new one.`,
      });
    }

    const rubric = await Rubric.findById(rubricId);
    if (!rubric)
      return res
        .status(404)
        .json({ success: false, message: "Rubric not found" });

    const criteriaIds = rubric.criteria.map((c) => c._id.toString());
    const scoreKeys = Object.keys(scores);

    const missingCriteria = criteriaIds.filter((id) => !scoreKeys.includes(id));
    if (missingCriteria.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide scores for all criteria",
        missingCriteria,
      });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    const evaluation = await Evaluation.create({
      studentId,
      evaluatorId: req.user.id,
      rubricId,
      semester,
      sessionType,
      scores,
      overallScore: overallScore || 0,
      strengths,
      weaknesses,
      recommendations,
      overallComments: overallComments || remarks, // Save remarks
      status: "submitted",
    });

    await evaluation.populate([
      { path: "studentId", select: "name userId matricNumber program" },
      { path: "evaluatorId", select: "name userId" },
      { path: "rubricId", select: "name criteria" },
    ]);

    res.status(201).json({ success: true, evaluation });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating evaluation",
      error: error.message,
    });
  }
};

// @desc    Get all evaluations (Handles dashboard lists)
// @route   GET /api/evaluations
// @access  Private
exports.getEvaluations = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "student") {
      query.studentId = req.user.id;
    } else if (["panel", "coordinator"].includes(req.user.role)) {
      query.evaluatorId = req.user.id;
    }
    // Admin and Coordinator leave query as {} to see everything

    const evaluations = await Evaluation.find(query)
      .populate("studentId", "name userId matricNumber program researchTitle")
      .populate("evaluatorId", "name userId")
      .populate("rubricId", "name criteria")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: evaluations.length, evaluations });
  } catch (error) {
    console.error("❌ Get evaluations error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching evaluations",
      error: error.message,
    });
  }
};

// @desc    Get evaluation by ID
// @route   GET /api/evaluations/:id
// @access  Private
exports.getEvaluationById = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id)
      .populate("studentId", "name userId matricNumber program researchTitle")
      .populate("evaluatorId", "name userId email")
      .populate("rubricId", "name description criteria");

    if (!evaluation) {
      return res
        .status(404)
        .json({ success: false, message: "Evaluation not found" });
    }

    // 🔒 STRICT RULE CHECKING
    if (req.user.role === "student") {
      if (evaluation.studentId._id.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You can only view your own evaluations.",
        });
      }
    } else if (["panel", "coordinator"].includes(req.user.role)) {
      if (evaluation.evaluatorId._id.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You can only view evaluations you created.",
        });
      }
    }
    // Admin and Coordinator bypass these checks and can view any ID

    res.json({ success: true, evaluation });
  } catch (error) {
    console.error("❌ Get evaluation error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching evaluation",
      error: error.message,
    });
  }
};

// @desc    Update evaluation
// @route   PUT /api/evaluations/:id
// @access  Private (Admin/Panel)
exports.updateEvaluation = async (req, res) => {
  try {
    let evaluation = await Evaluation.findById(req.params.id);

    if (!evaluation) {
      return res
        .status(404)
        .json({ success: false, message: "Evaluation not found" });
    }

    // Check if user can edit (admin can edit any, panel can only edit own)
    if (
      ["panel", "coordinator"].includes(req.user.role) &&
      evaluation.evaluatorId.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own evaluations",
      });
    }

    // Coordinators and Students cannot edit
    if (["student"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Your role is not authorized to edit evaluations.",
      });
    }

    evaluation = await Evaluation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("studentId", "name userId matricNumber")
      .populate("evaluatorId", "name userId")
      .populate("rubricId", "name criteria");

    res.json({ success: true, evaluation });
  } catch (error) {
    console.error("❌ Update evaluation error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating evaluation",
      error: error.message,
    });
  }
};

// @desc    Delete evaluation
// @route   DELETE /api/evaluations/:id
// @access  Private (Admin Only)
exports.deleteEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);

    if (!evaluation) {
      return res
        .status(404)
        .json({ success: false, message: "Evaluation not found" });
    }

    // STRICT ROLE CHECK (Reinforcing the router middleware)
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can delete evaluations.",
      });
    }

    await evaluation.deleteOne();
    res.json({ success: true, message: "Evaluation deleted successfully" });
  } catch (error) {
    console.error("❌ Delete evaluation error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting evaluation",
      error: error.message,
    });
  }
};
