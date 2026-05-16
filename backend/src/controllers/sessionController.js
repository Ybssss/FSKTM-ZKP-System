// src/controllers/sessionController.js
const Session = require("../models/Session");
const Evaluation = require("../models/Evaluation");
const User = require("../models/User");
const Rubric = require("../models/Rubric");

exports.createSession = async (req, res) => {
  try {
    const { studentId, sessionType, semester, panel1Id, panel2Id } = req.body;

    const student = await User.findById(studentId);

    if (
      student.supervisorId?.toString() === panel1Id ||
      student.supervisorId?.toString() === panel2Id
    ) {
      return res.status(400).json({
        error: "Conflict of Interest: A Supervisor cannot be a panel.",
      });
    }

    if (panel1Id === panel2Id) {
      return res
        .status(400)
        .json({ error: "Panel 1 and Panel 2 must be different examiners." });
    }

    const newSession = await Session.create({
      studentId,
      sessionType,
      semester,
      panel1Id,
      panel2Id,
    });

    // EVERY session must have a rubric now
    const rubric = await Rubric.findOne({ sessionType });
    const rubricId = rubric ? rubric._id : null;

    // Auto-create Pending Evaluations
    const eval1 = new Evaluation({
      sessionId: newSession._id,
      studentId,
      evaluatorId: panel1Id,
      sessionType,
      semester,
      rubricId,
      status: "PENDING",
    });

    const eval2 = new Evaluation({
      sessionId: newSession._id,
      studentId,
      evaluatorId: panel2Id,
      sessionType,
      semester,
      rubricId,
      status: "PENDING",
    });

    await Promise.all([eval1.save(), eval2.save()]);

    res.status(201).json({
      success: true,
      message: "Session created successfully",
      session: newSession,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// This fetches the sessions for the Timetable Dashboard
exports.getMySessions = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id || req.user.userId;
    const role = req.user.role;

    let query = {};
    if (role === "panel") {
      query = { $or: [{ panel1Id: userId }, { panel2Id: userId }] };
    } else if (role === "student") {
      query = { studentId: userId };
    }
    // Admins see all (query remains {})

    // 🔴 DEEP POPULATION: Get Session -> Student -> Supervisor
    const sessions = await Session.find(query)
      .populate({
        path: "studentId",
        select: "name matricNumber program researchTitle supervisorId",
        select: "name matricNumber program researchTitle supervisorId email",
        populate: { path: "supervisorId", select: "name" }, // 👈 Gets the SV!
      })
      .populate("panel1Id", "name expertiseTags")
      .populate("panel2Id", "name expertiseTags")
      .sort({ date: 1, time: 1 }); // Sort by upcoming schedule

    // Format the data perfectly for your React Table
    const formattedSessions = sessions.map((session) => {
      // Safely extract names (in case a user was deleted from DB)
      const studentName = session.studentId
        ? session.studentId.name
        : "Unknown Student";
      const svName =
        session.studentId && session.studentId.supervisorId
          ? session.studentId.supervisorId.name
          : "No SV Assigned";
      const panel1Name = session.panel1Id ? session.panel1Id.name : "TBD";
      const panel2Name = session.panel2Id ? session.panel2Id.name : "TBD";

      // Format the rubric/session type nicely (e.g., "PROPOSAL_DEFENSE" -> "Proposal Defense")
      const rubricName = session.sessionType
        .replace("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase());

      return {
        id: session._id,
        sessionType: session.sessionType,
        rubric: rubricName, // 👈 Beautifully formatted Rubric Name
        semester: session.semester,
        schedule: {
          date: session.date,
          time: session.time,
          venue: session.venue,
        },
        student: {
          id: session.studentId?._id,
          name: studentName,
          matricNumber: session.studentId?.matricNumber,
          program: session.studentId?.program,
          researchTitle: session.studentId?.researchTitle,
          svName: svName, // 👈 The Supervisor's Name!
        },
        panels: [panel1Name, panel2Name], // 👈 Array of Panel Names
      };
    });

    res.status(200).json({
      success: true,
      data: formattedSessions,
      sessions: formattedSessions,
    });
  } catch (error) {
    console.error("🔥 Session Fetch Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBulkSessions = async (req, res) => {
  try {
    const { sessions } = req.body;

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid payload. Expected an array of sessions." });
    }

    const createdSessions = [];
    const pendingEvaluations = [];

    // Process each session in the bulk request
    for (const sessionData of sessions) {
      const { studentId, sessionType, date, time, venue, panel1Id, panel2Id } =
        sessionData;

      if (!panel1Id || !panel2Id) {
        return res.status(400).json({
          error: "Both Panel 1 and Panel 2 must be provided for every student.",
        });
      }

      // 1. Conflict of Interest Check
      const student = await User.findById(studentId);
      if (student && student.supervisorId) {
        const svIdStr = student.supervisorId.toString();
        if (svIdStr === panel1Id || svIdStr === panel2Id) {
          return res.status(400).json({
            error: `Conflict of Interest: Supervisor cannot evaluate student ${student.name}.`,
          });
        }
      }

      if (panel1Id === panel2Id) {
        return res
          .status(400)
          .json({ error: "Panel 1 and Panel 2 must be different examiners." });
      }

      // 2. Create the Session
      const newSession = await Session.create({
        studentId,
        sessionType,
        semester: "Semester 1, 2025/2026",
        date,
        time,
        venue,
        panel1Id,
        panel2Id,
      });

      createdSessions.push(newSession);

      // 3. Fetch Rubric & Create EXACTLY TWO Pending Evaluations (One for each Panel)
      const rubric = await Rubric.findOne({ sessionType });
      const rubricId = rubric ? rubric._id : null;

      pendingEvaluations.push({
        sessionId: newSession._id,
        studentId,
        evaluatorId: panel1Id,
        sessionType,
        semester: newSession.semester,
        rubricId,
        status: "PENDING",
      });

      pendingEvaluations.push({
        sessionId: newSession._id,
        studentId,
        evaluatorId: panel2Id,
        sessionType,
        semester: newSession.semester,
        rubricId,
        status: "PENDING",
      });
    }

    // 4. Save all pending evaluations so the panels can see them!
    if (pendingEvaluations.length > 0) {
      await Evaluation.insertMany(pendingEvaluations);
    }

    res.status(201).json({
      success: true,
      message: `${createdSessions.length} sessions created successfully!`,
      count: createdSessions.length,
    });
  } catch (error) {
    console.error("Bulk Creation Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the session
    const deletedSession = await Session.findByIdAndDelete(id);
    if (!deletedSession) {
      return res.status(404).json({ error: "Session not found." });
    }

    // Crucial: Also delete the Pending Evaluations linked to this session!
    await Evaluation.deleteMany({ sessionId: id });

    res.status(200).json({
      success: true,
      message: "Session and linked evaluations deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      studentId,
      sessionType,
      semester,
      date,
      time,
      venue,
      panel1Id,
      panel2Id,
    } = req.body;

    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ error: "Session not found." });

    const student = await User.findById(studentId);
    if (
      student?.supervisorId?.toString() === panel1Id ||
      student?.supervisorId?.toString() === panel2Id
    ) {
      return res.status(400).json({
        error: "Conflict of Interest: A Supervisor cannot be a panel.",
      });
    }

    if (panel1Id === panel2Id) {
      return res
        .status(400)
        .json({ error: "Panel 1 and Panel 2 must be different examiners." });
    }

    // 1. Update the actual session
    session.studentId = studentId;
    session.sessionType = sessionType;
    session.semester = semester;
    session.date = date;
    session.time = time;
    session.venue = venue;
    session.panel1Id = panel1Id;
    session.panel2Id = panel2Id;
    await session.save();

    // 2. Fetch the correct Rubric if it's a Scored Session
    let rubricId = null;
    if (sessionType === "PROPOSAL_DEFENSE" || sessionType === "PRE_VIVA") {
      const rubric = await Rubric.findOne({ sessionType });
      if (rubric) rubricId = rubric._id;
    }

    // 3. Manage Pending Evaluations
    // First, delete any PENDING evaluations for this session (in case panels changed)
    await Evaluation.deleteMany({ sessionId: id, status: "PENDING" });

    // Ensure Evaluation for Panel 1 exists
    const eval1Exists = await Evaluation.findOne({
      sessionId: id,
      evaluatorId: panel1Id,
    });
    if (
      !eval1Exists &&
      (sessionType === "PROPOSAL_DEFENSE" ||
        sessionType === "PRE_VIVA" ||
        sessionType === "PROGRESS_ASSESSMENT")
    ) {
      await Evaluation.create({
        sessionId: id,
        studentId,
        evaluatorId: panel1Id,
        sessionType,
        semester,
        rubricId,
        status: "PENDING",
      });
    }

    // Ensure Evaluation for Panel 2 exists
    const eval2Exists = await Evaluation.findOne({
      sessionId: id,
      evaluatorId: panel2Id,
    });
    if (
      !eval2Exists &&
      (sessionType === "PROPOSAL_DEFENSE" ||
        sessionType === "PRE_VIVA" ||
        sessionType === "PROGRESS_ASSESSMENT")
    ) {
      await Evaluation.create({
        sessionId: id,
        studentId,
        evaluatorId: panel2Id,
        sessionType,
        semester,
        rubricId,
        status: "PENDING",
      });
    }

    res.status(200).json({
      success: true,
      message: "Session updated and evaluations synced successfully!",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
