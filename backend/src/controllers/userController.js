const User = require("../models/User");
const { logActivity } = require("../utils/logger");
const { sendRegistrationEmail } = require("../utils/mailer"); // ✅ Import Mailer

const queueRegistrationEmail = ({
  email,
  name,
  userId,
  code,
  isReset = false,
}) => {
  const receiver = String(email || "")
    .trim()
    .toLowerCase();

  const status = {
    queued: Boolean(receiver),
    sent: false,
    error: null,
    receiver,
    messageId: null,
  };

  if (!receiver) return status;

  sendRegistrationEmail(receiver, name, userId, code, isReset)
    .then((mailResult) => {
      console.log(
        `${isReset ? "Reset" : "Registration"} email sent:`,
        mailResult,
      );
    })
    .catch((emailError) => {
      console.error(
        `${isReset ? "Reset" : "Registration"} email failed:`,
        emailError.message || emailError,
      );
    });

  return status;
};

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
      researchAbstract,
      supervisorId,
      expertiseTags,
    } = req.body;
    const creatorRole = req.user.role;

    if (creatorRole !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to create users." });
    }

    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    const cleanUserId =
      role === "student"
        ? String(matricNumber || "")
            .replace(/\s+/g, "")
            .toUpperCase()
        : String(userId || "")
            .replace(/\s+/g, "")
            .trim();

    if (!cleanUserId) {
      return res.status(400).json({
        success: false,
        message:
          role === "student"
            ? "Matric Number is required for students."
            : "User ID is required.",
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ userId: cleanUserId }, { email: cleanEmail }],
    });
    if (existingUser)
      return res
        .status(400)
        .json({ success: false, message: "User ID or Email already exists." });

    const registrationCode =
      "REG-" + Math.floor(100000 + Math.random() * 900000);

    const cleanExpertiseTags = Array.isArray(expertiseTags)
      ? expertiseTags.map((tag) => String(tag || "").trim()).filter(Boolean)
      : typeof expertiseTags === "string"
        ? expertiseTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

    const newUser = new User({
      userId: cleanUserId,
      name: String(name || "").trim(),
      email: cleanEmail,
      role,
      registrationCode,

      ...(role === "student" && {
        matricNumber: String(matricNumber || "")
          .replace(/\s+/g, "")
          .toUpperCase(),
        program,
        researchTitle: String(researchTitle || "")
          .replace(/[<>]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 300),
        researchAbstract: String(researchAbstract || "")
          .normalize("NFKC")
          .replace(/[<>]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 5000),
        supervisorId: supervisorId || null,
      }),

      ...(["panel", "admin"].includes(role) && {
        expertiseTags: cleanExpertiseTags,
      }),
    });

    await newUser.save();

    const emailStatus = queueRegistrationEmail({
      email: cleanEmail,
      name: newUser.name,
      userId: newUser.userId,
      code: registrationCode,
      isReset: false,
    });

    if (logActivity)
      await logActivity(
        req.user.userId,
        "USER_CREATED",
        `Created new ${role} account: ${userId}`,
        req,
      );

    res.status(201).json({
      success: true,
      message: emailStatus.queued
        ? "User created successfully. Registration email is being sent."
        : "User created successfully. No receiver email was provided.",
      user: newUser,
      registrationCode,
      emailStatus,
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

    if (creatorRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to reset this user.",
      });
    }

    const newRegistrationCode =
      "REG-" + Math.floor(100000 + Math.random() * 900000);

    userToReset.zkpRegistered = false;
    userToReset.zkpPublicKey = undefined;
    userToReset.registrationCode = newRegistrationCode;
    userToReset.authenticatedDevices = [];

    await userToReset.save();

    const emailStatus = queueRegistrationEmail({
      email: userToReset.email,
      name: userToReset.name,
      userId: userToReset.userId,
      code: newRegistrationCode,
      isReset: true,
    });

    res.json({
      success: true,
      message: emailStatus.queued
        ? "User ZKP identity reset successfully. Reset email is being sent."
        : "User ZKP identity reset successfully. No receiver email was provided.",
      registrationCode: newRegistrationCode,
      name: userToReset.name,
      userId: userToReset.userId,
      emailStatus,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to reset user." });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const students = await User.find({ role: "student" })
      .select(
        "name email userId matricNumber program researchTitle researchAbstract supervisorId assignedPanels",
      )
      .populate("supervisorId", "name email")
      .populate("assignedPanels.panelId", "name email expertiseTags");

    const panels = await User.find({
      role: { $in: ["panel", "admin"] },
    }).select("name email userId expertiseTags assignedStudents");

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

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔴 Added expertiseTags so the array can be saved
    const {
      name,
      email,
      matricNumber,
      program,
      researchTitle,
      researchAbstract,
      supervisorId,
      profession,
      role,
      expertiseTags,
    } = req.body;

    const updateData = {
      name,
      email,
      matricNumber,
      program,
      researchTitle,
      researchAbstract:
        researchAbstract !== undefined
          ? String(researchAbstract || "")
              .normalize("NFKC")
              .replace(/[<>]/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 5000)
          : undefined,
      supervisorId,
      profession,
      expertiseTags,
    };

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    if (role && req.user.role === "admin") {
      updateData.role = role;
    }

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update user." });
  }
};

exports.unassignPanel = async (req, res) => {
  try {
    const { studentId, panelId } = req.body;

    if (!studentId || !panelId) {
      return res.status(400).json({
        success: false,
        message: "studentId and panelId are required",
      });
    }

    const User = require("../models/User"); // Ensure User model is loaded

    // 1. Remove panel from student's assignedPanels array
    await User.findByIdAndUpdate(studentId, {
      $pull: { assignedPanels: panelId },
    });

    // 2. Remove student from panel's assignedStudents array
    await User.findByIdAndUpdate(panelId, {
      $pull: { assignedStudents: studentId },
    });

    res.status(200).json({
      success: true,
      message: "Successfully unassigned panel from student.",
    });
  } catch (error) {
    console.error("Unassign Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during unassignment." });
  }
};
