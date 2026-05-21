const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const User = require("../models/User");
const userController = require("../controllers/userController");

router.get("/assignments", authenticateToken, userController.getAssignments);
router.use(authenticateToken);

router.get("/my-students", async (req, res) => {
  try {
    const myId = req.user.id || req.user.userId || req.user._id;
    if (req.user.role !== "panel" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only panels can view assigned students",
      });
    }
    const panel = await User.findById(myId)
      .populate(
        "assignedStudents",
        "name userId email matricNumber program researchTitle researchAbstract supervisorId",
      )
      .select("assignedStudents");
    res.json({ success: true, students: panel?.assignedStudents || [] });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch assigned students" });
  }
});

router.get("/", async (req, res) => {
  try {
    const allowedRoles = ["admin", "panel"];
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied." });
    }
    const users = await User.find()
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
});

router.patch("/me/research-abstract", async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can update their own research abstract.",
      });
    }

    const researchAbstract = String(req.body.researchAbstract || "")
      .normalize("NFKC")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (researchAbstract.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Research abstract must not exceed 5000 characters.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { researchAbstract } },
      { new: true, runValidators: true },
    )
      .select(
        "name userId email role matricNumber program researchTitle researchAbstract supervisorId assignedPanels zkpRegistered",
      )
      .populate("supervisorId", "name userId email")
      .populate("assignedPanels.panelId", "name userId email");

    res.json({
      success: true,
      message: "Research abstract updated successfully.",
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update research abstract.",
      error: error.message,
    });
  }
});

// Student: get own profile with supervisor populated
router.get("/me/profile", async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(
        "name userId email role matricNumber program researchTitle researchAbstract supervisorId assignedPanels zkpRegistered",
      )
      .populate("supervisorId", "name userId email")
      .populate("assignedPanels.panelId", "name userId email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile.",
      error: error.message,
    });
  }
});

// Student: update own research project title only
router.patch("/me/research-title", async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can update their own research project title.",
      });
    }

    const rawTitle =
      typeof req.body.researchTitle === "string" ? req.body.researchTitle : "";

    const researchTitle = rawTitle
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();

    if (!researchTitle) {
      return res.status(400).json({
        success: false,
        message: "Research project title cannot be empty.",
      });
    }

    if (researchTitle.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Research project title must be at least 5 characters.",
      });
    }

    if (researchTitle.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Research project title must not exceed 300 characters.",
      });
    }

    const currentUser = await User.findById(req.user.id).select(
      "researchTitle role",
    );

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (currentUser.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can update their own research project title.",
      });
    }

    const currentTitle = String(currentUser.researchTitle || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();

    if (currentTitle === researchTitle) {
      return res.status(400).json({
        success: false,
        message: "No changes detected. Please edit the title before saving.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          researchTitle,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select(
        "name userId email role matricNumber program researchTitle researchAbstract supervisorId assignedPanels zkpRegistered",
      )
      .populate("supervisorId", "name userId email")
      .populate("assignedPanels.panelId", "name userId email");

    res.json({
      success: true,
      message: "Research project title updated successfully.",
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update research project title.",
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
});

// Connect to controller for creation
router.post("/", userController.createUser);

router.put("/:id", userController.updateUser);

router.delete("/:id", async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res
        .status(403)
        .json({ success: false, message: "Access denied." });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

router.post("/:userId/reset-zkp", userController.resetZkpRegistration);

router.post("/assign-panel", async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res
        .status(403)
        .json({ success: false, message: "Only admins can assign panels" });

    const { studentId, panelIds, panelId, startDate, endDate } = req.body;
    const student = await User.findById(studentId);
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    let panelsToProcess = panelIds ? panelIds : panelId ? [panelId] : [];
    if (panelsToProcess.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No panels provided to assign" });
    if (panelsToProcess.length > 2)
      panelsToProcess = panelsToProcess.slice(0, 2);

    if (student.assignedPanels && student.assignedPanels.length > 0) {
      const oldPanelIds = student.assignedPanels.map(
        (p) => p.panelId?._id || p.panelId || p,
      );
      await User.updateMany(
        { _id: { $in: oldPanelIds } },
        { $pull: { assignedStudents: studentId } },
      );
    }

    const newPanelsArray = [];
    for (const pId of panelsToProcess) {
      await User.findByIdAndUpdate(pId, {
        $addToSet: { assignedStudents: studentId },
      });
      newPanelsArray.push({
        panelId: pId,
        startDate: startDate || new Date(),
        endDate: endDate || null,
      });
    }

    await User.findByIdAndUpdate(studentId, {
      $set: { assignedPanels: newPanelsArray },
    });

    res.json({
      success: true,
      message:
        "Default panels updated for future scheduling only. Existing scheduled sessions and evaluations were not changed.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to assign panel",
      error: error.message,
    });
  }
});

router.post("/unassign-panel", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can unassign panels",
      });
    }

    const { studentId, panelId } = req.body;

    if (!studentId || !panelId) {
      return res.status(400).json({
        success: false,
        message: "Student ID and panel ID are required.",
      });
    }

    await User.findByIdAndUpdate(studentId, {
      $pull: {
        assignedPanels: {
          panelId,
        },
      },
    });

    await User.findByIdAndUpdate(panelId, {
      $pull: {
        assignedStudents: studentId,
      },
    });

    res.json({
      success: true,
      message:
        "Default panel removed for future scheduling only. Existing scheduled sessions and evaluations were not changed.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to unassign panel",
      error: error.message,
    });
  }
});

router.post("/sync-assignments", async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ success: false, message: "Access denied" });
  res.json({ success: true, message: "Assignments synced" });
});

module.exports = router;
