const express = require("express");
const router = express.Router();
const { authenticateToken, requireRole } = require("../middleware/auth");
const Evaluation = require("../models/Evaluation"); // Moved to top
const {
  createEvaluation,
  getEvaluations,
  getEvaluationById,
  updateEvaluation,
  deleteEvaluation,
} = require("../controllers/evaluationController");

// All routes require authentication
router.use(authenticateToken);

// GET ALL: Visibility should be handled inside getEvaluations controller,
// OR we can restrict this route to Admins/Coordinators only if it returns everything.
router.get("/", getEvaluations);

// GET STUDENT EVALUATIONS: Enforcing confidentiality rules
router.get("/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const userRole = req.user.role;
    let query = { studentId };

    // 🔒 STRICT VISIBILITY RULES
    if (userRole === "student") {
      // FIX: Safely check against all possible ID variations in the JWT Token
      // This ensures we match whether the token uses the Mongo _id or the custom userId
      const isOwner =
        studentId === String(req.user.id) ||
        studentId === String(req.user._id) ||
        studentId === String(req.user.userId);

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized access to other student records",
        });
      }
    } else if (userRole === "panel") {
      // Panels can ONLY view evaluations they authored
      query.evaluatorId = req.user.id || req.user._id;
    }
    // Admins and Coordinators bypass these restrictions and see everything for that student

    const evaluations = await Evaluation.find(query)
      .populate("evaluatorId", "name userId")
      .populate("studentId", "name matricNumber")
      .populate("rubricId", "name criteria")
      .sort({ createdAt: -1 });

    res.json({ success: true, evaluations });
  } catch (error) {
    console.error("Get student evaluations error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch student evaluations",
        error: error.message,
      });
  }
});

// GET SINGLE: Controller must also enforce visibility rules!
router.get("/:id", getEvaluationById);

// CREATE & UPDATE: Only panels (and maybe admins) can evaluate
router.post("/", requireRole("panel", "admin"), createEvaluation);
router.put("/:id", requireRole("panel", "admin"), updateEvaluation);

// DELETE: Strictly Admins only
router.delete("/:id", requireRole("admin"), deleteEvaluation);

module.exports = router;
