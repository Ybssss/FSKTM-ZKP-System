const User = require("../models/User");
const { logActivity } = require("../utils/logger");
const { sendRegistrationEmail } = require("../utils/mailer"); // ✅ Import Mailer

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .populate({ path: "supervisorId", select: "name email userId" }) // 👈 Explicitly populate SV
      .lean()
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const {
      userId,
      name,
      email,
      role,
      matricNumber,
      program,
      researchTitle,
      supervisorId,
    } = req.body;
    const creatorRole = req.user.role;

    if (creatorRole === "admin" && ["superadmin", "admin"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Admins cannot create other Admins.",
      });
    }
    if (creatorRole !== "superadmin" && creatorRole !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to create users." });
    }

    const existingUser = await User.findOne({ $or: [{ userId }, { email }] });
    if (existingUser)
      return res
        .status(400)
        .json({ success: false, message: "User ID or Email already exists." });

    const registrationCode =
      "REG-" + Math.floor(100000 + Math.random() * 900000);

    const newUser = new User({
      userId,
      name,
      email,
      role,
      registrationCode,
      ...(role === "student" && {
        matricNumber,
        program,
        researchTitle,
        supervisorId,
      }),
    });

    await newUser.save();

    // ✅ Send Welcome Email
    sendRegistrationEmail(email, name, userId, registrationCode, false);

    if (logActivity)
      await logActivity(
        req.user.userId,
        "USER_CREATED",
        `Created new ${role} account: ${userId}`,
        req,
      );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: newUser,
      registrationCode,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
};

exports.resetZkpRegistration = async (req, res) => {
  try {
    const { userId } = req.params;
    const creatorRole = req.user.role;

    const userToReset = await User.findOne({ userId });
    if (!userToReset)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });

    if (
      creatorRole === "admin" &&
      ["superadmin", "admin"].includes(userToReset.role)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to reset this user." });
    }

    const newRegistrationCode =
      "REG-" + Math.floor(100000 + Math.random() * 900000);

    userToReset.zkpRegistered = false;
    userToReset.zkpPublicKey = undefined;
    userToReset.registrationCode = newRegistrationCode;
    userToReset.authenticatedDevices = [];

    await userToReset.save();

    // ✅ Send Reset Email
    sendRegistrationEmail(
      userToReset.email,
      userToReset.name,
      userToReset.userId,
      newRegistrationCode,
      true,
    );

    res.json({
      success: true,
      message: "User ZKP identity reset successfully.",
      registrationCode: newRegistrationCode,
      name: userToReset.name,
      userId: userToReset.userId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to reset user." });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    // Safely fetch students and populate their supervisor's name
    const students = await User.find({ role: "student" })
      .select(
        "name email userId matricNumber program researchTitle supervisorId",
      )
      .populate("supervisorId", "name email");

    // Safely fetch panels
    const panels = await User.find({ role: "panel" }).select(
      "name email userId expertiseTags",
    );

    res.status(200).json({
      success: true,
      students: students || [],
      panels: panels || [],
    });
  } catch (error) {
    console.error("🔥 Get Assignments Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// src/controllers/userController.js (add to bottom)

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, matricNumber, program, researchTitle } = req.body;

    // Only allow editing safe fields (prevent role/ZKP tampering here)
    const user = await User.findByIdAndUpdate(
      id,
      { name, email, matricNumber, program, researchTitle },
      { new: true, runValidators: true },
    );

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update user." });
  }
};
