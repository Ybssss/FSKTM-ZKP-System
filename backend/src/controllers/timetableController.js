const Timetable = require("../models/Timetable");
const User = require("../models/User");
const Evaluation = require("../models/Evaluation");
const {
  uploadToGoogleDrive,
  deleteFromGoogleDrive,
} = require("../services/googleDriveService");

exports.createTimetable = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin")
      return res.status(403).json({ success: false, message: "Unauthorized" });
    const timetable = await Timetable.create({
      ...req.body,
      createdBy: req.user.id,
      status: req.body.status || "scheduled",
    });
    res.status(201).json({ success: true, timetable });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating timetable",
      error: error.message,
    });
  }
};

// 🔴 FORMAT DATA FOR REACT FRONTEND
const formatTimetable = (t) => {
  const doc = t.toObject ? t.toObject() : t;

  // React wants "student", "panel1Id", "panel2Id". We extract them from the MongoDB Arrays.
  doc.student =
    doc.students && doc.students.length > 0 ? doc.students[0] : null;
  doc.panel1Id = doc.panels && doc.panels.length > 0 ? doc.panels[0] : null;
  doc.panel2Id = doc.panels && doc.panels.length > 1 ? doc.panels[1] : null;

  return doc;
};

exports.getTimetables = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "student") query.students = req.user.id;
    else if (req.user.role === "panel") query.panels = req.user.id;

    const timetables = await Timetable.find(query)
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      )
      .sort({ date: -1, startTime: -1 });

    const formatted = timetables.map(formatTimetable);
    res.json({ success: true, count: formatted.length, timetables: formatted });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching timetables" });
  }
};

exports.getMyTimetable = async (req, res) => {
  try {
    let query = {};
    const myId = req.user.id || req.user.userId || req.user._id;

    if (req.user.role === "student") {
      query.students = myId;
    }
    // Allow Admins to fetch their personally assigned timetables just like Panels!
    else if (req.user.role === "panel" || req.user.role === "admin") {
      query.panels = myId;
    }

    const timetables = await Timetable.find(query)
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      )
      .sort({ date: -1, startTime: -1 });

    const formatted = timetables.map(formatTimetable);
    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
      sessions: formatted,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching timetable" });
  }
};

exports.getTimetableById = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id)
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      );

    if (!timetable)
      return res
        .status(404)
        .json({ success: false, message: "Timetable not found" });
    res.json({ success: true, timetable: formatTimetable(timetable) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching timetable" });
  }
};

// 🔴 BULK SCHEDULE GENERATOR
exports.createBulkTimetables = async (req, res) => {
  try {
    const { sessions } = req.body;

    // Push the React singular inputs safely into the Database schema Arrays
    const timetablesToInsert = sessions.map((s) => ({
      sessionType: s.sessionType,
      rubricId: s.rubricId,
      title: `${s.sessionType} Session`,
      date: s.date,
      startTime: s.time,
      endTime: s.endTime,
      venue: s.venue,
      students: [s.studentId],
      panels: [s.panel1Id, s.panel2Id].filter(Boolean),
      status: "scheduled",
      createdBy: req.user.id,
    }));

    const createdTimetables = await Timetable.insertMany(timetablesToInsert);

    // Auto-Generate Evaluations
    const evaluationsToInsert = [];
    for (let i = 0; i < createdTimetables.length; i++) {
      const session = createdTimetables[i];
      const orig = sessions[i];
      if (orig.panel1Id)
        evaluationsToInsert.push({
          sessionId: session._id,
          studentId: orig.studentId,
          evaluatorId: orig.panel1Id,
          rubricId: orig.rubricId,
          sessionType: orig.sessionType,
          status: "PENDING",
        });
      if (orig.panel2Id)
        evaluationsToInsert.push({
          sessionId: session._id,
          studentId: orig.studentId,
          evaluatorId: orig.panel2Id,
          rubricId: orig.rubricId,
          sessionType: orig.sessionType,
          status: "PENDING",
        });
    }
    if (evaluationsToInsert.length > 0)
      await Evaluation.insertMany(evaluationsToInsert);

    res.status(201).json({ success: true, count: createdTimetables.length });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error scheduling" });
  }
};

exports.updateTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const existingSession = await Timetable.findById(id);

    // Reconstruct the array for updating
    const oldP1 = existingSession.panels?.[0]?.toString();
    const oldP2 = existingSession.panels?.[1]?.toString();

    if (updates.panel1Id || updates.panel2Id) {
      updates.panels = [
        updates.panel1Id || oldP1,
        updates.panel2Id || oldP2,
      ].filter(Boolean);
    }
    if (updates.time) updates.startTime = updates.time;

    const updatedSession = await Timetable.findByIdAndUpdate(id, updates, {
      new: true,
    });

    // Panel Swaps
    if (updates.panel1Id && oldP1 && updates.panel1Id !== oldP1) {
      await Evaluation.findOneAndUpdate(
        { sessionId: id, evaluatorId: oldP1, status: "PENDING" },
        {
          evaluatorId: updates.panel1Id,
          rubricId: updates.rubricId || existingSession.rubricId,
        },
      );
    }
    if (updates.panel2Id && oldP2 && updates.panel2Id !== oldP2) {
      await Evaluation.findOneAndUpdate(
        { sessionId: id, evaluatorId: oldP2, status: "PENDING" },
        {
          evaluatorId: updates.panel2Id,
          rubricId: updates.rubricId || existingSession.rubricId,
        },
      );
    }
    if (updates.rubricId) {
      await Evaluation.updateMany(
        { sessionId: id, status: "PENDING" },
        { rubricId: updates.rubricId, sessionType: updates.sessionType },
      );
    }

    res.json({ success: true, timetable: formatTimetable(updatedSession) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error updating timetable" });
  }
};

exports.deleteTimetable = async (req, res) => {
  try {
    await Evaluation.deleteMany({ sessionId: req.params.id });
    await Timetable.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error deleting timetable" });
  }
};

// Required placeholders for routing
exports.uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, description } = req.body;

    const timetable = await Timetable.findById(id).select("students status");

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    const userId = String(req.user.id || req.user._id);
    const isAdmin = req.user.role === "admin";
    const isAssignedStudent = timetable.students.some(
      (studentId) => String(studentId) === userId,
    );

    if (!isAdmin && !isAssignedStudent) {
      return res.status(403).json({
        success: false,
        message:
          "Only the assigned student can upload materials for this session.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please choose a file to upload.",
      });
    }

    const cleanTitle = String(title || req.file.originalname || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: "Document title is required.",
      });
    }

    if (cleanTitle.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Document title must not exceed 120 characters.",
      });
    }

    const allowedTypes = ["report", "slides", "supplementary", "other"];
    const cleanType = allowedTypes.includes(type) ? type : "other";

    const uploaded = await uploadToGoogleDrive(req.file);

    const documentRecord = {
      title: cleanTitle,
      url: uploaded.webViewLink,
      driveFileId: uploaded.id,
      mimeType: uploaded.mimeType || req.file.mimetype,
      source: "google-drive",
      type: cleanType,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
      fileSize: uploaded.size
        ? `${uploaded.size} bytes`
        : `${req.file.size} bytes`,
      description: String(description || "").trim(),
    };

    const updatedTimetable = await Timetable.findByIdAndUpdate(
      id,
      {
        $push: {
          studentDocuments: documentRecord,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      );

    res.json({
      success: true,
      message: "Material uploaded to Google Drive successfully.",
      timetable: formatTimetable(updatedTimetable),
      document: documentRecord,
    });
  } catch (error) {
    console.error("Upload document error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to upload material.",
      error: error.message,
    });
  }
};
exports.deleteDocument = async (req, res) => {
  try {
    const { id, documentId } = req.params;

    const timetable = await Timetable.findById(id).select("studentDocuments");

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    const targetDocument = timetable.studentDocuments.id(documentId);

    if (!targetDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const userId = String(req.user.id || req.user._id);
    const isAdmin = req.user.role === "admin";
    const isOwner =
      targetDocument.uploadedBy && String(targetDocument.uploadedBy) === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You can only delete materials uploaded by yourself.",
      });
    }

    await deleteFromGoogleDrive(targetDocument.driveFileId);

    const updatedTimetable = await Timetable.findByIdAndUpdate(
      id,
      {
        $pull: {
          studentDocuments: {
            _id: documentId,
          },
        },
      },
      {
        new: true,
      },
    )
      .populate({
        path: "students",
        select: "name userId matricNumber researchTitle",
        populate: { path: "supervisorId", select: "name" },
      })
      .populate("panels", "name userId email expertiseTags")
      .populate(
        "studentDocuments.uploadedBy",
        "name userId matricNumber email role",
      );

    res.json({
      success: true,
      message: "Material deleted successfully.",
      timetable: formatTimetable(updatedTimetable),
    });
  } catch (error) {
    console.error("Delete document error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete material.",
      error: error.message,
    });
  }
};
exports.addPanelNotes = async (req, res) => {
  res.json({ success: true });
};
