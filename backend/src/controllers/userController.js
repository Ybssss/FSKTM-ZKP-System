const User = require("../models/User");

const SAFE_USER_SELECT =
  "name userId email role matricNumber program yearOfStudy profession profileImageUrl researchTitle researchAbstract supervisorId assignedStudents assignedPanels expertiseTags zkpRegistered createdAt updatedAt";
const { logActivity } = require("../utils/logger");
const {
  getEmailConfigStatus,
  sendRegistrationEmail,
} = require("../utils/mailer");
const {
  buildSupervisorConflictMessage,
  hasSupervisorPanelConflict,
} = require("../utils/supervisorConflictValidation");
const {
  syncSupervisorEvaluationsForStudents,
} = require("../utils/evaluationWorkflow");

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
    queued: false,
    sent: false,
    error: null,
    receiver,
    messageId: null,
  };

  if (!receiver) return status;

  const emailConfig = getEmailConfigStatus();
  if (!emailConfig.ready) {
    status.error = `Email configuration missing on server: ${emailConfig.missing.join(", ")}`;
    console.error(status.error);
    return status;
  }

  status.queued = true;
  console.log(`${isReset ? "Reset" : "Registration"} email queued:`, {
    receiver,
    provider: emailConfig.provider,
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
  });

  sendRegistrationEmail(receiver, name, userId, code, isReset)
    .then((mailResult) => {
      console.log(
        `${isReset ? "Reset" : "Registration"} email sent:`,
        mailResult,
      );
    })
    .catch((emailError) => {
      console.error(`${isReset ? "Reset" : "Registration"} email failed:`, {
        message: emailError.message || String(emailError),
        code: emailError.code,
        responseCode: emailError.responseCode,
        command: emailError.command,
        response: emailError.response,
      });
    });

  return status;
};

const cleanProgram = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select(SAFE_USER_SELECT)
      .populate({ path: "supervisorId", select: "name email userId" })
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
      profession,
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
    const cleanProfession = String(profession || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);

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
        program: cleanProgram(program),
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
        profession: cleanProfession,
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
        : emailStatus.error
          ? "User created successfully, but registration email could not be queued."
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
        : emailStatus.error
          ? "User ZKP identity reset successfully, but reset email could not be queued."
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
        "name email userId matricNumber program profileImageUrl researchTitle researchAbstract supervisorId assignedPanels",
      )
      .populate("supervisorId", "name email")
      .populate("assignedPanels.panelId", "name email expertiseTags");

    const panels = await User.find({
      role: { $in: ["panel", "admin"] },
    }).select("name email userId profileImageUrl expertiseTags assignedStudents");

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

    // Added expertiseTags so the array can be saved
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

    const existingUser = await User.findById(id).select(
      "role name supervisorId assignedPanels",
    );
    if (!existingUser)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const updateData = {
      name,
      email,
      matricNumber,
      program: program !== undefined ? cleanProgram(program) : undefined,
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
      profession:
        profession !== undefined
          ? String(profession || "")
              .normalize("NFKC")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 160)
          : undefined,
      expertiseTags,
    };

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    if (role && req.user.role === "admin") {
      updateData.role = role;
    }

    const nextRole = updateData.role || existingUser.role;
    const previousSupervisorId = existingUser.supervisorId;
    const nextSupervisorId =
      updateData.supervisorId !== undefined
        ? updateData.supervisorId
        : existingUser.supervisorId;
    const nextAssignedPanels = existingUser.assignedPanels || [];

    if (
      nextRole === "student" &&
      hasSupervisorPanelConflict({
        supervisorId: nextSupervisorId,
        panelIds: nextAssignedPanels,
      })
    ) {
      return res.status(400).json({
        success: false,
        message: buildSupervisorConflictMessage({
          studentName: existingUser.name,
          context: "existing default panel assignment",
        }),
      });
    }

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    const supervisorChanged =
      nextRole === "student" &&
      String(previousSupervisorId || "") !== String(nextSupervisorId || "");

    if (supervisorChanged) {
      await syncSupervisorEvaluationsForStudents({ studentIds: [id] });
    }

    res.status(200).json({
      success: true,
      user,
      message: supervisorChanged
        ? "User updated. Completed supervisor evaluations remain with the previous supervisor, and pending supervisor evaluations were synchronized to the current supervisor."
        : undefined,
    });
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
