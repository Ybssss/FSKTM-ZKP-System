const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  createTimetable,
  getTimetables,
  getMyTimetable,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
  assignPanelToStudent,
  uploadDocument,
  deleteDocument,
  addPanelNotes,
  // You will need to create this in your controller later:
  // createBulkTimetables 
} = require('../controllers/timetableController');

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// VIEWING ROUTES (All Authenticated Users)
// ==========================================
router.get('/', getTimetables); // Controller should filter based on role involvement
router.get('/my', getMyTimetable); // For Students and Panels to see their assigned sessions
router.get('/:id', getTimetableById);

// ==========================================
// DOCUMENT & NOTES ROUTES
// ==========================================
// Students upload their proposal/progress documents
router.post('/:id/documents', requireRole('student', 'admin'), uploadDocument);
router.delete('/:id/documents/:documentId', requireRole('student', 'admin'), deleteDocument);

// Panels leave notes during the session
router.post('/:id/notes', requireRole('panel', 'admin'), addPanelNotes);

// ==========================================
// SCHEDULING & ADMIN ROUTES (STRICT)
// ==========================================
// Only Admins can create, update, or delete sessions
router.post('/', requireRole('admin'), createTimetable);
router.put('/:id', requireRole('admin'), updateTimetable);
router.delete('/:id', requireRole('admin'), deleteTimetable);

// NEW: Bulk Scheduling Route (Admin only)
// router.post('/bulk', requireRole('admin'), createBulkTimetables);

// Panel Assignment (Admin only) - Maps 2 panels to 1 student
router.post('/assign-panel', requireRole('admin'), assignPanelToStudent);

module.exports = router;