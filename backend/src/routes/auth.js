const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');
const User = require('../models/User'); // Required for the admin routes at the bottom

// ==========================================
// PUBLIC ZKP ROUTES
// ==========================================
router.post('/check-registration', authController.checkRegistration);
router.post('/register', authController.registerZKP);
router.post('/challenge', authController.generateChallenge);
router.post('/verify', authController.verifyProof);

// ==========================================
// SECURE DEVICE PAIRING ROUTES
// ==========================================
// 1. PC asks for a code
router.post('/pairing/request', authController.requestPairingCode);
router.post('/pairing/key', authenticateToken, authController.getTempPublicKey);
// 2. Phone sends encrypted key (Needs to be logged in!)

router.post('/pairing/submit', authenticateToken, authController.submitEncryptedKey);
// 3. PC polls for the key
router.post('/pairing/poll', authController.pollEncryptedKey);

// ==========================================
// PROTECTED USER ROUTES
// ==========================================
router.get('/me', authenticateToken, authController.getMe);
router.get('/my-devices', authenticateToken, authController.getMyDevices);
router.delete('/device/:deviceId', authenticateToken, authController.removeDevice);

// Logout (Clear challenge and session data)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { zkpChallenge: null, zkpPairingCode: null });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

router.post('/logout-all-devices', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (typeof user.logoutAllDevices === 'function') {
      user.logoutAllDevices();
      await user.save();
    }
    res.json({ success: true, message: 'Logged out from all devices' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to logout from all devices' });
  }
});

router.put('/update-keys', authenticateToken, authController.updateKeys);
router.get('/verify', authenticateToken, authController.verifyAuth);
// ==========================================
// ADMIN ONLY ROUTES
// ==========================================
router.post('/admin/reset-zkp/:userId', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const targetUser = await User.findOne({ userId: req.params.userId });
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    targetUser.zkpPublicKey = null;
    targetUser.zkpRegistered = false;
    targetUser.zkpChallenge = null;
    if (typeof targetUser.logoutAllDevices === 'function') targetUser.logoutAllDevices();
    await targetUser.save();

    res.json({ success: true, message: 'ZKP identity reset successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset ZKP' });
  }
});

router.post('/admin/logout-user/:userId', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const targetUser = await User.findOne({ userId: req.params.userId });
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    if (typeof targetUser.logoutAllDevices === 'function') {
      targetUser.logoutAllDevices();
      await targetUser.save();
    }
    res.json({ success: true, message: `${targetUser.name} logged out from all devices` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to logout user' });
  }
});

router.get('/admin/user-devices/:userId', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const targetUser = await User.findOne({ userId: req.params.userId });
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, devices: targetUser.authenticatedDevices || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get user devices' });
  }
});

module.exports = router;

