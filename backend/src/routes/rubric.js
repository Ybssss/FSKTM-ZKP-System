// src/routes/rubric.js
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const Rubric = require("../models/Rubric");
const { toSessionTypeCode } = require("../utils/sessionType");
const cleanText = (value = "", max = 1000) =>
  String(value)
    .normalize("NFKC")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const allowedCriterionTypes = ["quantitative", "qualitative"];

const normalizeMaxScore = (value, type) => {
  if (type === "qualitative") return 0;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;

  return Math.min(Math.max(Math.round(parsed), 1), 5);
};

const buildRubricPayload = (body) => {
  const name = cleanText(body.name, 150);
  const sessionType = toSessionTypeCode(body.sessionType || name);

  if (!name) {
    throw new Error("Rubric name is required.");
  }

  if (!sessionType) {
    throw new Error("Invalid rubric session type.");
  }

  const criteria = Array.isArray(body.criteria)
    ? body.criteria.map((criterion, index) => {
        const type = allowedCriterionTypes.includes(criterion.type)
          ? criterion.type
          : "quantitative";

        return {
          key: cleanText(criterion.key || `criterion_${index + 1}`, 80),
          title: cleanText(criterion.title, 250),
          type,
          weight: Number(criterion.weight || 0),
          maxScore: normalizeMaxScore(criterion.maxScore, type),
          description: cleanText(criterion.description || "", 1000),
          outstanding: cleanText(criterion.outstanding || "", 2000),
          exemplary: cleanText(criterion.exemplary || "", 2000),
          proficient: cleanText(criterion.proficient || "", 2000),
          satisfactory: cleanText(criterion.satisfactory || "", 2000),
          foundational: cleanText(criterion.foundational || "", 2000),
          novice: cleanText(criterion.novice || "", 2000),
        };
      })
    : [];

  return {
    name,
    sessionType,
    criteria,
  };
};

router.use(authenticateToken);

// @desc    Get all rubrics
// @route   GET /api/rubrics
// @access  Private
router.get("/", async (req, res) => {
  try {
    const rubrics = await Rubric.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: rubrics.length,
      data: rubrics, // Provided both 'data' and 'rubrics' keys
      rubrics: rubrics, // to ensure your frontend api.js doesn't break
    });
  } catch (error) {
    console.error("Get rubrics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching rubrics",
    });
  }
});

// @desc    Get single rubric
// @route   GET /api/rubrics/:id
// @access  Private
router.get("/:id", async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.id);

    if (!rubric) {
      return res.status(404).json({
        success: false,
        message: "Rubric not found",
      });
    }

    res.json({
      success: true,
      data: rubric,
      rubric: rubric,
    });
  } catch (error) {
    console.error("Get rubric error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching rubric",
    });
  }
});

// @desc    Create rubric
// @route   POST /api/rubrics
// @access  Private (Admin, Panel)
router.post("/", async (req, res) => {
  try {
    // Role check
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can create rubrics",
      });
    }

    console.log("📝 Creating rubric:", req.body.name);

    const rubricPayload = buildRubricPayload(req.body);
    const rubric = await Rubric.create(rubricPayload);

    console.log("✅ Rubric created:", rubric._id);

    res.status(201).json({
      success: true,
      data: rubric,
      rubric: rubric,
    });
  } catch (error) {
    console.error("Create rubric error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A rubric with this session type already exists.",
        error: error.message,
      });
    }

    res.status(error.message?.includes("required") || error.message?.includes("Invalid") ? 400 : 500).json({
      success: false,
      message: "Error creating rubric",
      error: error.message,
    });
  }
});

// @desc    Update rubric
// @route   PUT /api/rubrics/:id
// @access  Private (Admin, Panel)
router.put("/:id", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update rubrics",
      });
    }

    console.log("📝 Updating rubric:", req.params.id);

    const rubricPayload = buildRubricPayload(req.body);

    const rubric = await Rubric.findByIdAndUpdate(
      req.params.id,
      rubricPayload,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!rubric) {
      return res.status(404).json({
        success: false,
        message: "Rubric not found",
      });
    }

    console.log("✅ Rubric updated");

    res.json({
      success: true,
      data: rubric,
      rubric: rubric,
    });
  } catch (error) {
    console.error("Update rubric error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A rubric with this session type already exists.",
        error: error.message,
      });
    }

    res.status(error.message?.includes("required") || error.message?.includes("Invalid") ? 400 : 500).json({
      success: false,
      message: "Error updating rubric",
      error: error.message,
    });
  }
});

// @desc    Delete rubric
// @route   DELETE /api/rubrics/:id
// @access  Private (Admin only)
router.delete("/:id", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete rubrics",
      });
    }

    console.log("🗑️ Deleting rubric:", req.params.id);

    const rubric = await Rubric.findByIdAndDelete(req.params.id);

    if (!rubric) {
      return res.status(404).json({
        success: false,
        message: "Rubric not found",
      });
    }

    console.log("✅ Rubric deleted");

    res.json({
      success: true,
      message: "Rubric deleted successfully",
    });
  } catch (error) {
    console.error("Delete rubric error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting rubric",
    });
  }
});

module.exports = router;
