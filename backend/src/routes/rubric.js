// src/routes/rubric.js
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const Rubric = require("../models/Rubric");

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
    if (req.user.role !== "admin" && req.user.role !== "panel") {
      return res.status(403).json({
        success: false,
        message: "Only admins and panels can create rubrics",
      });
    }

    console.log("📝 Creating rubric:", req.body.name);

    const rubric = await Rubric.create(req.body);

    console.log("✅ Rubric created:", rubric._id);

    res.status(201).json({
      success: true,
      data: rubric,
      rubric: rubric,
    });
  } catch (error) {
    console.error("Create rubric error:", error);
    res.status(500).json({
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
    if (req.user.role !== "admin" && req.user.role !== "panel") {
      return res.status(403).json({
        success: false,
        message: "Only admins and panels can update rubrics",
      });
    }

    console.log("📝 Updating rubric:", req.params.id);

    const rubric = await Rubric.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

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
    res.status(500).json({
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
