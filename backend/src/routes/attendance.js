const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const attendanceController = require('../controllers/attendanceController');

// Protect all routes
router.use(authenticateToken);

// Mark attendance (panel and admin can mark for students)
// Controller should check role
router.post('/', attendanceController.markAttendance);

// Get attendance by timetable
router.get('/timetable/:id', attendanceController.getAttendanceByTimetable);

// Get my attendance (student)
// Controller should check if user is student
router.get('/my', attendanceController.getMyAttendance);

// Get attendance statistics
router.get('/stats', attendanceController.getAttendanceStats);

// Update attendance status
// Controller should check if user is admin/panel
router.put('/:id', attendanceController.updateAttendance);

// Delete attendance
// Controller should check if user is admin
router.delete('/:id', attendanceController.deleteAttendance);

module.exports = router;
