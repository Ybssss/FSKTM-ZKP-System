const QRCode = require('qrcode');
const crypto = require('crypto');
const Timetable = require('../models/Timetable');

// @desc    Generate QR code for timetable session
// @route   POST /api/qr/generate/:timetableId
// @access  Private (Panel, Admin)
exports.generateQRCode = async (req, res) => {
  try {
    const { timetableId } = req.params;

    console.log('🎫 Generating QR code for timetable:', timetableId);

    // Check if timetable exists
    const timetable = await Timetable.findById(timetableId)
      .populate('studentId', 'name matricNumber')
      .populate('panelMembers', 'name');

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found',
      });
    }

    // Generate unique token for this session
    const token = crypto.randomBytes(32).toString('hex');
    
    // Create QR code data (JSON format)
    const qrData = JSON.stringify({
      timetableId: timetable._id,
      sessionType: timetable.sessionType,
      token: token,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    });

    console.log('📊 QR Data:', qrData);

    // Generate QR code as Data URL (base64 image)
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Save QR code token to timetable
    timetable.qrCode = token;
    await timetable.save();

    console.log('✅ QR code generated successfully');

    res.json({
      success: true,
      qrCode: qrCodeDataURL,
      token: token,
      timetable: {
        id: timetable._id,
        sessionType: timetable.sessionType,
        date: timetable.date,
        venue: timetable.venue,
        student: timetable.studentId?.name,
      },
    });
  } catch (error) {
    console.error('❌ Generate QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating QR code',
      error: error.message,
    });
  }
};

// @desc    Verify QR code and mark attendance
// @route   POST /api/qr/verify
// @access  Public (for students scanning QR)
exports.verifyQRCode = async (req, res) => {
  try {
    const { timetableId, token, studentId } = req.body;

    console.log('🔍 Verifying QR code:', { timetableId, token, studentId });

    if (!timetableId || !token || !studentId) {
      return res.status(400).json({
        success: false,
        message: 'Timetable ID, token, and student ID are required',
      });
    }

    // Find timetable and verify token
    const timetable = await Timetable.findById(timetableId);

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found',
      });
    }

    if (timetable.qrCode !== token) {
      console.log('❌ Invalid QR code token');
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired QR code',
      });
    }

    console.log('✅ QR code verified successfully');

    res.json({
      success: true,
      message: 'QR code verified',
      timetable: {
        id: timetable._id,
        sessionType: timetable.sessionType,
        date: timetable.date,
        venue: timetable.venue,
      },
    });
  } catch (error) {
    console.error('❌ Verify QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying QR code',
      error: error.message,
    });
  }
};

// @desc    Get QR code for timetable
// @route   GET /api/qr/:timetableId
// @access  Private
exports.getQRCode = async (req, res) => {
  try {
    const { timetableId } = req.params;

    console.log('🔍 Getting QR code for timetable:', timetableId);

    const timetable = await Timetable.findById(timetableId);

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found',
      });
    }

    if (!timetable.qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not generated yet',
      });
    }

    // Regenerate QR code from saved token
    const qrData = JSON.stringify({
      timetableId: timetable._id,
      sessionType: timetable.sessionType,
      token: timetable.qrCode,
      timestamp: new Date().toISOString(),
    });

    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 300,
    });

    res.json({
      success: true,
      qrCode: qrCodeDataURL,
      token: timetable.qrCode,
    });
  } catch (error) {
    console.error('❌ Get QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving QR code',
      error: error.message,
    });
  }
};
