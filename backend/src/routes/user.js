const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const User = require("../models/User");
const userController = require("../controllers/userController");

router.get("/assignments", authenticateToken, userController.getAssignments);
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
    res.status(500).json({
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
      return res.status(403).json({
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

    // The frontend now safely handles the raw arrays.
    const users = await User.find()
      .select("-passwordHash")
      .sort({ createdAt: -1 });

    res.json({ success: true, users });
  } catch (error) {
    console.error("GET /users error:", error);
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
});

// ==========================================
// 3. POST / PUT / DELETE ROUTES
// ==========================================

// Connect it to controller so it ACTUALLY triggers the mailer!
router.post("/", userController.createUser);

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

    const { studentId, panelIds, panelId, startDate, endDate } = req.body;

    const student = await User.findById(studentId);
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    // Normalize input to an array
    let panelsToProcess = panelIds ? panelIds : panelId ? [panelId] : [];

    if (panelsToProcess.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No panels provided to assign" });
    }

    // IDIOT-PROOFING: Strictly slice the array to a maximum of 2 panels
    if (panelsToProcess.length > 2) {
      panelsToProcess = panelsToProcess.slice(0, 2);
    }

    // STEP 1: CLEANUP OLD ASSIGNMENTS (Atomic Bulk Update)
    // We safely extract old IDs and remove this student from ALL of them instantly.
    if (student.assignedPanels && student.assignedPanels.length > 0) {
      const oldPanelIds = student.assignedPanels.map(
        (p) => p.panelId?._id || p.panelId || p,
      );

      await User.updateMany(
        { _id: { $in: oldPanelIds } },
        { $pull: { assignedStudents: studentId } },
      );
    }

    // STEP 2: PREPARE NEW ARRAY & UPDATE PANELS
    const newPanelsArray = [];

    for (const pId of panelsToProcess) {
      // Use atomic $addToSet so we don't need to call .save() manually
      await User.findByIdAndUpdate(pId, {
        $addToSet: { assignedStudents: studentId },
      });

      // Prepare the exact object to save into the student's document
      newPanelsArray.push({
        panelId: pId,
        startDate: startDate || new Date(),
        endDate: endDate || null,
      });
    }

    // STEP 3: WIPE AND REPLACE STUDENT'S ARRAY ATOMICALLY
    // Using $set guarantees Mongoose replaces the array exactly as we built it
    await User.findByIdAndUpdate(studentId, {
      $set: { assignedPanels: newPanelsArray },
    });

    res.json({
      success: true,
      message: "Panels correctly assigned (Max 2 enforced).",
    });
  } catch (error) {
    console.error("Assign Panel Error:", error);
    res.status(500).json({
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
