const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logActivity } = require('../utils/logger');
const { ec: EC } = require('elliptic'); // ✅ ADDED TRUE ELLIPTIC CURVE

// Initialize the secp256k1 Elliptic Curve for verification
const ec = new EC('secp256k1');

// Helper: Generate device ID from user agent and IP
const generateDeviceId = (userAgent, ipAddress) => {
  const data = `${userAgent}-${ipAddress}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
};

// Helper: Parse user agent to device name
const parseDeviceName = (userAgent) => {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  return `${browser} on ${os}`;
};

// ==========================================
// REGISTRATION & VERIFICATION
// ==========================================

exports.checkRegistration = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

    const user = await User.findOne({ userId: userId.toString() });
    if (!user) return res.json({ success: true, userExists: false, registered: false, message: 'User not found. Contact admin.' });

    const isRegistered = user.zkpRegistered && !!user.zkpPublicKey;
    
    res.json({ 
      success: true, 
      userExists: true, 
      registered: isRegistered, 
      requiresCode: !!user.registrationCode,
      message: isRegistered ? 'Registered' : 'Not registered' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check registration status', error: error.message });
  }
};

exports.registerZKP = async (req, res) => {
  try {
    const { userId, publicKey, registrationCode } = req.body;
    if (!userId || !publicKey) return res.status(400).json({ success: false, message: 'User ID and public key are required' });

    const user = await User.findOne({ userId: userId.toString() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.zkpRegistered) return res.status(400).json({ success: false, message: 'User already registered' });

    if (user.registrationCode) {
      if (!registrationCode || user.registrationCode !== registrationCode) {
        if(logActivity) await logActivity(user._id, 'REGISTRATION_FAILED', `Invalid registration code attempt`, req);
        return res.status(401).json({ success: false, message: 'Invalid Registration Code. Please check with the Admin.' });
      }
    }

    user.zkpPublicKey = publicKey;
    user.zkpRegistered = true;
    user.registrationCode = null; 
    await user.save();

    if(logActivity) await logActivity(user._id, 'USER_REGISTERED', `Successfully registered ZKP Identity bound to device`, req);

    res.json({ success: true, message: 'ZKP identity registered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
};

exports.generateChallenge = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

    const user = await User.findOne({ userId: userId.toString() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.zkpRegistered || !user.zkpPublicKey) return res.status(403).json({ success: false, message: 'Not registered for ZKP' });

    const challengeValue = crypto.randomBytes(32).toString('hex');
    user.zkpChallenge = challengeValue;
    user.zkpChallengeExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    await user.save();

    res.json({ success: true, challenge: challengeValue, expiresAt: user.zkpChallengeExpiry });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating challenge', error: error.message });
  }
};

exports.verifyProof = async (req, res) => {
  try {
    const { userId, proof, trustDevice, deviceId: clientDeviceId } = req.body;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';

    // ✅ NEW: Expecting { R, s } from the frontend
    if (!userId || !proof || !proof.R || !proof.s) {
      return res.status(400).json({ success: false, message: 'Invalid mathematical proof format.' });
    }

    const user = await User.findOne({ userId: userId.toString() });
    if (!user || !user.zkpChallenge || new Date() > user.zkpChallengeExpiry) {
      return res.status(400).json({ success: false, message: 'Invalid or expired challenge' });
    }

    // ==========================================
    // REAL SCHNORR ZKP VERIFICATION
    // ==========================================
    let isValid = false;
    try {
      // 1. Reconstruct the mathematical challenge scalar (h)
      const h_input = user.zkpPublicKey + proof.R + user.zkpChallenge;
      const h_hex = crypto.createHash('sha256').update(h_input).digest('hex');
      const h_bn = ec.keyFromPrivate(h_hex).getPrivate(); // Convert Hex to BigNumber

      // 2. Set up the Elliptic Curve Points
      const s_bn = ec.keyFromPrivate(proof.s).getPrivate();
      const sG = ec.g.mul(s_bn); // Left side of equation: s * G

      const Y = ec.keyFromPublic(user.zkpPublicKey, 'hex').getPublic(); // User's Public Key
      const R_point = ec.keyFromPublic(proof.R, 'hex').getPublic();     // Commitment (R)
      
      // 3. Right side of equation: R + (h * Y)
      const hY = Y.mul(h_bn);
      const R_plus_hY = R_point.add(hY);

      // 4. Verification Check: Does s * G == R + (h * Y)?
      isValid = sG.eq(R_plus_hY);
    } catch (mathError) {
      console.error('❌ ZKP Math Verification Error:', mathError);
      isValid = false;
    }

    if (!isValid) return res.status(401).json({ success: false, message: 'Cryptographic proof verification failed.' });

    const deviceId = clientDeviceId || generateDeviceId(userAgent, ipAddress);
    
    if (typeof user.addDevice === 'function') {
      user.addDevice({ deviceId, deviceName: parseDeviceName(userAgent), userAgent, ipAddress, trustStatus: trustDevice || false });
    }

    user.zkpChallenge = null;
    user.zkpChallengeExpiry = null;
    user.lastLogin = new Date();
    await user.save();

    if(logActivity) await logActivity(user._id, 'LOGIN_SUCCESS', `Logged in from ${parseDeviceName(userAgent)}`, req);

    const token = jwt.sign(
      { userId: user._id, role: user.role, deviceId },
      process.env.JWT_SECRET || 'your-secret-key-change-this',
      { expiresIn: '7d' }
    );

    res.json({
      success: true, token,
      user: { id: user._id, userId: user.userId, name: user.name, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed', error: error.message });
  }
};

// ==========================================
// SECURE DEVICE PAIRING (QR & NO-CAMERA SYNC)
// ==========================================

exports.requestPairingCode = async (req, res) => {
  try {
    const { userId, tempPublicKeyBase64 } = req.body;
    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.zkpPairingCode = pairingCode;
    user.zkpTempPublicKey = tempPublicKeyBase64 || null; 
    user.zkpPairingExpiry = new Date(Date.now() + 3 * 60 * 1000); 
    user.zkpEncryptedPayload = null;
    await user.save();

    if(logActivity) await logActivity(user._id, 'DEVICE_SYNC_REQUESTED', `Requested pairing code to sync to a new device`, req);

    res.json({ success: true, pairingCode, expiresAt: user.zkpPairingExpiry });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating code', error: error.message });
  }
};

exports.getTempPublicKey = async (req, res) => {
  try {
    const { pairingCode } = req.body;
    const user = await User.findById(req.user.id); 

    if (user.zkpPairingCode !== pairingCode || new Date() > user.zkpPairingExpiry) {
      return res.status(400).json({ success: false, message: 'Invalid or expired 6-digit code' });
    }

    if (!user.zkpTempPublicKey) {
      return res.status(400).json({ success: false, message: 'The requesting device did not provide a secure key.' });
    }

    res.json({ success: true, tempPublicKeyBase64: user.zkpTempPublicKey });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch pairing key', error: error.message });
  }
};

exports.submitEncryptedKey = async (req, res) => {
  try {
    const { pairingCode, encryptedPayload } = req.body;
    const user = await User.findById(req.user.id);

    if (user.zkpPairingCode !== pairingCode || new Date() > user.zkpPairingExpiry) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    }

    user.zkpEncryptedPayload = encryptedPayload;
    await user.save();
    
    if(logActivity) await logActivity(user._id, 'DEVICE_SYNC_SUBMITTED', `Securely encrypted and transferred private keys`, req);
    
    res.json({ success: true, message: 'Key transferred securely' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error submitting key', error: error.message });
  }
};

exports.pollEncryptedKey = async (req, res) => {
  try {
    const { userId, pairingCode } = req.body;
    const user = await User.findOne({ userId });

    if (!user || user.zkpPairingCode !== pairingCode || new Date() > user.zkpPairingExpiry) {
      return res.status(400).json({ success: false, message: 'Invalid or expired session' });
    }

    if (!user.zkpEncryptedPayload) {
      return res.status(202).json({ success: true, status: 'waiting' });
    }

    const payload = user.zkpEncryptedPayload;
    
    user.zkpPairingCode = null;
    user.zkpPairingExpiry = null;
    user.zkpEncryptedPayload = null;
    user.zkpTempPublicKey = null; 
    await user.save();

    if(logActivity) await logActivity(user._id, 'DEVICE_SYNC_COMPLETED', `Successfully synced keys to a new device`, req);

    res.json({ success: true, status: 'complete', encryptedPayload: payload });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error polling key', error: error.message });
  }
};

// ==========================================
// UTILITIES & USER MANAGEMENT
// ==========================================

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-zkpChallenge -zkpChallengeExpiry -zkpPublicKey -zkpPairingCode -zkpEncryptedPayload -zkpTempPublicKey');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user', error: error.message });
  }
};

exports.getMyDevices = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const devices = (user.authenticatedDevices || []).map(device => ({
      deviceId: device.deviceId, deviceName: device.deviceName, trustStatus: device.trustStatus, lastLogin: device.lastLogin, isActive: device.isActive
    }));
    res.json({ success: true, devices });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get devices', error: error.message });
  }
};

exports.removeDevice = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (typeof user.removeDevice === 'function') {
      user.removeDevice(req.params.deviceId);
      await user.save();
    }
    if(logActivity) await logActivity(user._id, 'DEVICE_REMOVED', `Revoked access for a device`, req);
    res.json({ success: true, message: 'Device removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove device', error: error.message });
  }
};

exports.updateKeys = async (req, res) => {
  try {
    const { zkpPublicKey } = req.body;
    if (!zkpPublicKey) return res.status(400).json({ success: false, message: 'ZKP public key is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.zkpPublicKey = zkpPublicKey;
    user.zkpChallenge = null; 
    await user.save();

    if(logActivity) await logActivity(user._id, 'KEYS_UPDATED', `Updated cryptographic keys`, req);

    res.json({ success: true, message: 'ZKP keys updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating keys', error: error.message });
  }
};

exports.verifyAuth = async (req, res) => {
  try {
    res.json({
      success: true, authenticated: true,
      user: { id: req.user._id, userId: req.user.userId, name: req.user.name, role: req.user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error verifying authentication' });
  }
};