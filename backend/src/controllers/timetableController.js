const Timetable = require('../models/Timetable');
const User = require('../models/User');

// @desc    Create timetable
// @route   POST /api/timetables
// @access  Private (Admin Only)
exports.createTimetable = async (req, res) => {
  try {
    const { sessionType, title, description, date, startTime, endTime, venue, deadline, requirements, attachmentUrl, students, panels, status } = req.body;

    // STRICT ROLE CHECK (Reinforces the router)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can create schedules.' });
    }

    const timetable = await Timetable.create({
      sessionType,
      title,
      description,
      date,
      startTime,
      endTime,
      venue,
      deadline,
      requirements,
      attachmentUrl,
      students: students || [],
      panels: panels || [],
      status: status || 'scheduled',
      createdBy: req.user.id,
      studentDocuments: [],
      panelNotes: [],
    });

    res.status(201).json({ success: true, timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating timetable', error: error.message });
  }
};

// @desc    Upload document to session
// @route   POST /api/timetables/:id/documents
// @access  Private (Student/Admin)
exports.uploadDocument = async (req, res) => {
  try {
    const { title, url, type, description, fileSize } = req.body;
    const timetable = await Timetable.findById(req.params.id);

    if (!timetable) return res.status(404).json({ success: false, message: 'Session not found' });

    // Students can only upload to their assigned sessions
    if (req.user.role === 'student') {
      const hasAccess = timetable.students.some(s => s.toString() === req.user.id.toString());
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this session.' });
    }
    // Admin bypasses check

    const document = { title, url, type: type || 'other', description, fileSize, uploadedBy: req.user.id, uploadedAt: new Date() };
    timetable.studentDocuments.push(document);
    await timetable.save();

    res.status(201).json({ success: true, message: 'Document uploaded successfully', document: timetable.studentDocuments[timetable.studentDocuments.length - 1] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error uploading document', error: error.message });
  }
};

// @desc    Delete document from session
// @route   DELETE /api/timetables/:id/documents/:documentId
// @access  Private (Uploader/Admin)
exports.deleteDocument = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return res.status(404).json({ success: false, message: 'Session not found' });

    const document = timetable.studentDocuments.id(req.params.documentId);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

    // Only the uploader or an Admin can delete
    if (req.user.role !== 'admin' && document.uploadedBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own documents' });
    }

    document.deleteOne();
    await timetable.save();
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting document', error: error.message });
  }
};

// @desc    Add/Update panel notes
// @route   POST /api/timetables/:id/notes
// @access  Private (Panel/Admin)
exports.addPanelNotes = async (req, res) => {
  try {
    const { notes, isDraft } = req.body;
    const timetable = await Timetable.findById(req.params.id);

    if (!timetable) return res.status(404).json({ success: false, message: 'Session not found' });

    // Only assigned panels (or Admins) can add notes
    if (req.user.role === 'panel') {
      const hasAccess = timetable.panels.some(p => p.toString() === req.user.id.toString());
      if (!hasAccess) return res.status(403).json({ success: false, message: 'You are not assigned to this session' });
    }

    const existingNoteIndex = timetable.panelNotes.findIndex(note => note.panelId.toString() === req.user.id.toString());
    if (existingNoteIndex >= 0) {
      timetable.panelNotes[existingNoteIndex].notes = notes;
      timetable.panelNotes[existingNoteIndex].isDraft = isDraft || false;
      timetable.panelNotes[existingNoteIndex].updatedAt = new Date();
    } else {
      timetable.panelNotes.push({ panelId: req.user.id, notes, isDraft: isDraft || false, createdAt: new Date(), updatedAt: new Date() });
    }

    await timetable.save();
    res.status(201).json({ success: true, message: 'Notes saved successfully', notes: timetable.panelNotes.find(n => n.panelId.toString() === req.user.id.toString()) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving notes', error: error.message });
  }
};

// @desc    Get all timetables
// @route   GET /api/timetables
// @access  Private
exports.getTimetables = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'student') query.students = req.user.id;
    else if (req.user.role === 'panel') query.panels = req.user.id;
    // Admins and Coordinators query remains {}

    const timetables = await Timetable.find(query)
      .populate('students', 'name userId matricNumber')
      .populate('panels', 'name userId')
      .populate('createdBy', 'name')
      .populate('studentDocuments.uploadedBy', 'name userId role')
      .populate('panelNotes.panelId', 'name userId')
      .sort({ date: -1, startTime: -1 });

    res.json({ success: true, count: timetables.length, timetables });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching timetables', error: error.message });
  }
};

// @desc    Get my timetable
// @route   GET /api/timetables/my
// @access  Private
exports.getMyTimetable = async (req, res) => {
  try {
    let query = { date: { $gte: new Date() } };
    
    // Both Panels and Students can query "My Timetable"
    if (req.user.role === 'student') query.students = req.user.id;
    else if (req.user.role === 'panel') query.panels = req.user.id;
    else return res.status(403).json({ success: false, message: 'Only panels and students have personal timetables.' });

    const timetables = await Timetable.find(query)
      .populate('panels', 'name userId')
      .populate('students', 'name userId')
      .populate('studentDocuments.uploadedBy', 'name userId role')
      .sort({ date: 1, startTime: 1 });

    res.json({ success: true, count: timetables.length, timetables });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching timetable', error: error.message });
  }
};

// @desc    Get timetable by ID
// @route   GET /api/timetables/:id
// @access  Private
exports.getTimetableById = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id)
      .populate('students', 'name userId matricNumber email program')
      .populate('panels', 'name userId email')
      .populate('createdBy', 'name')
      .populate('studentDocuments.uploadedBy', 'name userId role')
      .populate('panelNotes.panelId', 'name userId');

    if (!timetable) return res.status(404).json({ success: false, message: 'Timetable not found' });

    // Access Check
    if (req.user.role === 'student') {
      const hasAccess = timetable.students.some(s => s._id.toString() === req.user.id.toString());
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });
    } else if (req.user.role === 'panel') {
      const hasAccess = timetable.panels.some(p => p._id.toString() === req.user.id.toString());
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching timetable', error: error.message });
  }
};

// @desc    Update timetable
// @route   PUT /api/timetables/:id
// @access  Private (Admin Only)
exports.updateTimetable = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can update schedules.' });
    }

    const timetable = await Timetable.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('students', 'name userId matricNumber')
      .populate('panels', 'name userId');

    if (!timetable) return res.status(404).json({ success: false, message: 'Timetable not found' });
    res.json({ success: true, timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating timetable', error: error.message });
  }
};

// @desc    Delete timetable
// @route   DELETE /api/timetables/:id
// @access  Private (Admin Only)
exports.deleteTimetable = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can delete schedules.' });
    }

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return res.status(404).json({ success: false, message: 'Timetable not found' });

    await timetable.deleteOne();
    res.json({ success: true, message: 'Timetable deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting timetable', error: error.message });
  }
};

// @desc    Assign panels to student (Enforces 2 panels per student rule)
// @route   POST /api/timetables/assign-panel
// @access  Private (Admin Only)
exports.assignPanelToStudent = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can assign panels.' });
    }

    const { panelIds, studentId, startDate, endDate } = req.body; // Expect an array of panelIds now
    
    if (!panelIds || panelIds.length !== 2) {
       return res.status(400).json({ success: false, message: 'Exactly 2 panels must be assigned to a student.' });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
        return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Process both panels
    for (const panelId of panelIds) {
      const panel = await User.findById(panelId);
      if (!panel || panel.role !== 'panel') {
          return res.status(404).json({ success: false, message: `Panel ID ${panelId} not found or invalid role.` });
      }

      // Assign Panel -> Student
      if (!panel.assignedStudents) panel.assignedStudents = [];
      if (!panel.assignedStudents.some(s => s.toString() === studentId)) {
        panel.assignedStudents.push(studentId);
        await panel.save();
      }

      // Assign Student -> Panel
      if (!student.assignedPanels) student.assignedPanels = [];
      // Ensure we don't assign the same panel twice
      if(!student.assignedPanels.some(p => p.panelId.toString() === panelId)) {
         student.assignedPanels.push({ panelId, startDate: startDate || new Date(), endDate: endDate || null });
      }
    }
    
    await student.save();

    res.json({ success: true, message: 'Panels assigned successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error assigning panel', error: error.message });
  }
};