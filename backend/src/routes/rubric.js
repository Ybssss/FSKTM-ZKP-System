// src/routes/rubric.js
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const Rubric = require("../models/Rubric");
const Evaluation = require("../models/Evaluation");
const Timetable = require("../models/Timetable");
const SessionBatch = require("../models/SessionBatch");
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

  return Math.max(Math.round(parsed), 1);
};

const buildScoreDescriptions = (criterion, maxScore) => {
  const descriptions = {};
  const directDescriptions =
    criterion?.scoreDescriptions && typeof criterion.scoreDescriptions === "object"
      ? criterion.scoreDescriptions
      : {};

  for (let score = 0; score <= maxScore; score += 1) {
    const rawValue =
      directDescriptions[String(score)] ??
      directDescriptions[score];
    const cleaned = cleanText(rawValue || "", 2000);

    if (cleaned) {
      descriptions[String(score)] = cleaned;
    }
  }

  return descriptions;
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
        const maxScore = normalizeMaxScore(criterion.maxScore, type);
        const scoreDescriptions =
          type === "quantitative"
            ? buildScoreDescriptions(criterion, maxScore)
            : {};

        return {
          key: cleanText(criterion.key || `criterion_${index + 1}`, 80),
          title: cleanText(criterion.title, 250),
          type,
          weight: Number(criterion.weight || 0),
          maxScore,
          description: cleanText(criterion.description || "", 1000),
          scoreDescriptions,
        };
      })
    : [];

  return {
    name,
    sessionType,
    originalSessionType: sessionType,
    criteria,
  };
};

const buildArchivedSessionType = (sessionType, rubricId) =>
  `${String(sessionType || "RUBRIC")
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 24)}__OBSOLETE__${String(rubricId || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-10)
    .toUpperCase()}`;

const getRubricUsage = async (rubricId) => {
  const [linkedEvaluationCount, linkedSessionCount, linkedBatchCount] =
    await Promise.all([
      Evaluation.countDocuments({ rubricId }),
      Timetable.countDocuments({ rubricId }),
      SessionBatch.countDocuments({ rubricId }),
    ]);

  const totalLinkedCount =
    linkedEvaluationCount + linkedSessionCount + linkedBatchCount;

  return {
    linkedEvaluationCount,
    linkedSessionCount,
    linkedBatchCount,
    totalLinkedCount,
    hasLinkedRecords: totalLinkedCount > 0,
    canDeletePermanently: totalLinkedCount === 0,
  };
};

const serializeRubric = async (rubric) => {
  const usage = await getRubricUsage(rubric._id);

  return {
    ...rubric.toObject(),
    ...usage,
  };
};

router.use(authenticateToken);

// @desc    Get all rubrics
// @route   GET /api/rubrics
// @access  Private
router.get("/", async (req, res) => {
  try {
    const includeObsolete =
      String(req.query.includeObsolete || "").toLowerCase() === "true" &&
      req.user.role === "admin";
    const filter = includeObsolete ? {} : { isObsolete: { $ne: true } };
    const rubrics = await Rubric.find(filter).sort({
      isObsolete: 1,
      createdAt: -1,
    });
    const serializedRubrics = await Promise.all(rubrics.map(serializeRubric));

    res.json({
      success: true,
      count: serializedRubrics.length,
      data: serializedRubrics,
      rubrics: serializedRubrics,
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

    const serializedRubric = await serializeRubric(rubric);

    res.json({
      success: true,
      data: serializedRubric,
      rubric: serializedRubric,
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

    const rubricPayload = buildRubricPayload(req.body);
    const rubric = await Rubric.create(rubricPayload);
    const serializedRubric = await serializeRubric(rubric);

    res.status(201).json({
      success: true,
      data: serializedRubric,
      rubric: serializedRubric,
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

    const existingRubric = await Rubric.findById(req.params.id);

    if (!existingRubric) {
      return res.status(404).json({
        success: false,
        message: "Rubric not found",
      });
    }

    if (existingRubric.isObsolete) {
      return res.status(409).json({
        success: false,
        message:
          "Obsolete rubrics cannot be edited. Restore it first or create a new rubric instead.",
      });
    }

    const usage = await getRubricUsage(existingRubric._id);
    if (usage.hasLinkedRecords) {
      return res.status(409).json({
        success: false,
        message:
          "This rubric is already linked to existing sessions, batches, or evaluations. Editing it would change existing records. Create a new rubric instead.",
        ...usage,
      });
    }

    const rubricPayload = buildRubricPayload(req.body);

    const rubric = await Rubric.findByIdAndUpdate(
      req.params.id,
      rubricPayload,
      {
        new: true,
        runValidators: true,
      },
    );

    const serializedRubric = await serializeRubric(rubric);

    res.json({
      success: true,
      data: serializedRubric,
      rubric: serializedRubric,
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

// @desc    Mark rubric as obsolete
// @route   PATCH /api/rubrics/:id/obsolete
// @access  Private (Admin only)
router.patch("/:id/obsolete", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can move rubrics to obsolete.",
      });
    }

    const rubric = await Rubric.findById(req.params.id);

    if (!rubric) {
      return res.status(404).json({
        success: false,
        message: "Rubric not found",
      });
    }

    if (!rubric.isObsolete) {
      const canonicalSessionType =
        rubric.originalSessionType || rubric.sessionType;
      rubric.originalSessionType = canonicalSessionType;
      rubric.sessionType = buildArchivedSessionType(
        canonicalSessionType,
        rubric._id,
      );
      rubric.isObsolete = true;
      rubric.obsoleteAt = new Date();
      await rubric.save();
    }

    const serializedRubric = await serializeRubric(rubric);

    res.json({
      success: true,
      message: "Rubric moved to Obsolete successfully.",
      data: serializedRubric,
      rubric: serializedRubric,
    });
  } catch (error) {
    console.error("Obsolete rubric error:", error);
    res.status(500).json({
      success: false,
      message: "Error moving rubric to obsolete.",
    });
  }
});

// @desc    Restore obsolete rubric
// @route   PATCH /api/rubrics/:id/restore
// @access  Private (Admin only)
router.patch("/:id/restore", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can restore rubrics.",
      });
    }

    const rubric = await Rubric.findById(req.params.id);

    if (!rubric) {
      return res.status(404).json({
        success: false,
        message: "Rubric not found",
      });
    }

    const restoredSessionType = rubric.originalSessionType || rubric.sessionType;
    const conflict = await Rubric.findOne({
      _id: { $ne: rubric._id },
      isObsolete: { $ne: true },
      sessionType: restoredSessionType,
    }).select("_id name");

    if (conflict) {
      return res.status(409).json({
        success: false,
        message:
          "An active rubric already uses this session type. Rename or remove the conflicting active rubric first.",
      });
    }

    rubric.sessionType = restoredSessionType;
    rubric.originalSessionType = restoredSessionType;
    rubric.isObsolete = false;
    rubric.obsoleteAt = null;
    await rubric.save();

    const serializedRubric = await serializeRubric(rubric);

    res.json({
      success: true,
      message: "Rubric restored successfully.",
      data: serializedRubric,
      rubric: serializedRubric,
    });
  } catch (error) {
    console.error("Restore rubric error:", error);
    res.status(500).json({
      success: false,
      message: "Error restoring rubric.",
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

    const rubric = await Rubric.findById(req.params.id);

    if (!rubric) {
      return res.status(404).json({
        success: false,
        message: "Rubric not found",
      });
    }

    const usage = await getRubricUsage(rubric._id);

    if (usage.hasLinkedRecords) {
      return res.status(409).json({
        success: false,
        message:
          "This rubric is linked to existing evaluations, sessions, or batches. Move it to Obsolete instead of deleting it.",
        ...usage,
      });
    }

    if (!rubric.isObsolete) {
      return res.status(409).json({
        success: false,
        message:
          "Move the rubric to Obsolete first. Only unlinked rubrics in the Obsolete tab can be deleted permanently.",
      });
    }

    await Rubric.deleteOne({ _id: rubric._id });

    res.json({
      success: true,
      message: "Rubric deleted permanently.",
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
