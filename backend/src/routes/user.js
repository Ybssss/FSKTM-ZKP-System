const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const User = require("../models/User");

router.use(authenticateToken);

// ==========================================
// 1. SPECIFIC GET ROUTES (MUST BE AT THE TOP!)
// ==========================================

// Get panel assignments overview (for Admin Bulk Scheduling)
router.get("/assignments", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    const students = await User.find({ role: "student" })
      .populate("assignedPanels.panelId", "name userId email")
      .select("name userId matricNumber assignedPanels");

    const panels = await User.find({ role: { $in: ["panel", "admin"] } })
      .populate("assignedStudents", "name userId matricNumber")
      .select("name userId email assignedStudents");

    res.json({ success: true, students, panels });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch assignments",
        error: error.message,
      });
  }
});

// Get my assigned students (for panels)
router.get("/my-students", async (req, res) => {
  try {
    const myId = req.user.id || req.user.userId || req.user._id;
    if (req.user.role !== "panel" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Only panels can view assigned students",
        });
    }
    const panel = await User.findById(myId)
      .populate(
        "assignedStudents",
        "name userId email matricNumber program researchTitle supervisor",
      )
      .select("assignedStudents");
    res.json({ success: true, students: panel?.assignedStudents || [] });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch assigned students" });
  }
});

// Get all users
router.get("/", async (req, res) => {
  try {
    const allowedRoles = ["superadmin", "admin", "panel", "coordinator"];
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
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch users",
        error: error.message,
      });
  }
});

// ==========================================
// 2. DYNAMIC ID ROUTE (MUST BE BELOW SPECIFIC ROUTES)
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch user",
        error: error.message,
      });
  }
});

// ==========================================
// 3. POST / PUT / DELETE ROUTES
// ==========================================

router.post("/", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin")
      return res
        .status(403)
        .json({ success: false, message: "Access denied." });
    const existingUser = await User.findOne({ userId: req.body.userId });
    if (existingUser)
      return res
        .status(400)
        .json({ success: false, message: "User ID already exists" });

    const registrationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const user = new User({
      ...req.body,
      registrationCode,
      zkpRegistered: false,
    });
    await user.save();

    res
      .status(201)
      .json({ success: true, message: "User created", user, registrationCode });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to create user",
        error: error.message,
      });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin")
      return res
        .status(403)
        .json({ success: false, message: "Access denied." });
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");
    res.json({ success: true, message: "User updated successfully", user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin")
      return res
        .status(403)
        .json({ success: false, message: "Access denied." });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

router.post("/:userId/reset-zkp", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin")
      return res
        .status(403)
        .json({ success: false, message: "Access denied." });
    const targetUser = await User.findOne({ userId: req.params.userId });
    if (!targetUser)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const registrationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    targetUser.zkpPublicKey = null;
    targetUser.zkpRegistered = false;
    targetUser.zkpChallenge = null;
    targetUser.registrationCode = registrationCode;
    if (typeof targetUser.logoutAllDevices === "function")
      targetUser.logoutAllDevices();
    await targetUser.save();

    res.json({
      success: true,
      message: "ZKP reset successfully",
      userId: targetUser.userId,
      name: targetUser.name,
      registrationCode,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to reset ZKP" });
  }
});

// ==========================================
// 4. PANEL ASSIGNMENTS
// ==========================================
router.post("/assign-panel", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin")
      return res
        .status(403)
        .json({ success: false, message: "Only admins can assign panels" });
    const { studentId, panelIds, startDate, endDate } = req.body;

    const student = await User.findById(studentId);
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    for (const pId of panelIds) {
      const panel = await User.findById(pId);
      if (panel) {
        if (!panel.assignedStudents) panel.assignedStudents = [];
        if (!panel.assignedStudents.includes(studentId)) {
          panel.assignedStudents.push(studentId);
          await panel.save();
        }

        if (!student.assignedPanels) student.assignedPanels = [];
        if (
          !student.assignedPanels.some((ap) => ap.panelId.toString() === pId)
        ) {
          student.assignedPanels.push({
            panelId: pId,
            startDate: startDate || new Date(),
            endDate: endDate || null,
          });
        }
      }
    }
    await student.save();
    res.json({ success: true, message: "Panels assigned successfully" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to assign panel",
        error: error.message,
      });
  }
});

router.post("/unassign-panel", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin")
      return res
        .status(403)
        .json({ success: false, message: "Only admins can unassign panels" });
    const { studentId, panelId } = req.body;

    const student = await User.findById(studentId);
    if (student) {
      student.assignedPanels =
        student.assignedPanels?.filter(
          (ap) => ap.panelId.toString() !== panelId,
        ) || [];
      await student.save();
    }
    const panel = await User.findById(panelId);
    if (panel) {
      panel.assignedStudents =
        panel.assignedStudents?.filter((sid) => sid.toString() !== studentId) ||
        [];
      await panel.save();
    }
    res.json({ success: true, message: "Panel unassigned successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to unassign panel" });
  }
});

router.post("/sync-assignments", async (req, res) => {
  if (req.user.role !== "admin" && req.user.role !== "superadmin")
    return res.status(403).json({ success: false, message: "Access denied" });
  res.json({ success: true, message: "Assignments synced" });
});

module.exports = router;
