const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const qrController = require('../controllers/qrController');

// Generate QR code (protected - panel/admin)
// Controller should check if user is admin/panel
router.post('/generate/:timetableId', authenticateToken, qrController.generateQRCode);

// Verify QR code (public or protected - for students)
router.post('/verify', qrController.verifyQRCode);

// Get existing QR code (protected)
router.get('/:timetableId', authenticateToken, qrController.getQRCode);

module.exports = router;
