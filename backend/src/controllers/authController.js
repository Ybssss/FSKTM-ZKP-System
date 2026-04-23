// src/controllers/authController.js
const { plonk } = require("snarkjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ec: EC } = require("elliptic");
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Ensure this path is correct
const zkpService = require("../services/zkpService");

const EC_INSTANCE = new EC("secp256k1");
const vkeyPath =
  process.env.ZKP_VERIFICATION_KEY_PATH ||
  path.join(__dirname, "../../zkp/keys/login_verification_key.json");

let verificationKey = null;
const loadVerificationKey = () => {
  if (verificationKey) return verificationKey;

  if (!fs.existsSync(vkeyPath)) {
    throw new Error(
      `ZKP verification key not found at ${vkeyPath}. Set ZKP_VERIFICATION_KEY_PATH or add the key file to the project.`,
    );
  }

  verificationKey = require(vkeyPath);
  return verificationKey;
};

const verifySchnorrProof = (proof, challenge, publicKeyHex) => {
  try {
    if (!proof || !challenge || !publicKeyHex) return false;

    const parsedProof = typeof proof === "string" ? JSON.parse(proof) : proof;
    const { R, s } = parsedProof;
    if (!R || !s) return false;

    const publicKey = EC_INSTANCE.keyFromPublic(publicKeyHex, "hex");
    const R_point = EC_INSTANCE.curve.decodePoint(R, "hex");

    const hInput = publicKeyHex + R + challenge;
    const hHex = crypto.createHash("sha256").update(hInput).digest("hex");
    const hBN = EC_INSTANCE.keyFromPrivate(hHex, "hex").getPrivate();
    const sBN = EC_INSTANCE.keyFromPrivate(s, "hex").getPrivate();

    const left = EC_INSTANCE.g.mul(sBN);
    const right = R_point.add(publicKey.getPublic().mul(hBN));

    return left.eq(right);
  } catch (error) {
    console.error("Schnorr proof verification error:", error);
    return false;
  }
};

const JWT_SECRET = process.env.JWT_SECRET || "your-fallback-secret-key";

// 1. ZKP REGISTRATION CONTROLLER
exports.registerZKP = async (req, res) => {
  try {
    const { userId, publicKey, registrationCode } = req.body;
    if (!userId || !publicKey || !registrationCode) {
      return res.status(400).json({
        success: false,
        message: "userId, publicKey, and registrationCode are required.",
      });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (user.zkpRegistered) {
      return res.status(400).json({
        success: false,
        message: "This user already has a registered ZKP identity.",
      });
    }

    if (!user.registrationCode || user.registrationCode !== registrationCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration code.",
      });
    }

    user.zkpPublicKey = publicKey;
    user.zkpRegistered = true;
    user.registrationCode = null;
    await user.save();

    res.json({
      success: true,
      message: "ZKP registration completed successfully.",
    });
  } catch (error) {
    console.error("🔴 ZKP Registration Error:", error.message);
    console.error("🔴 Error Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || "An internal server error occurred.",
    });
  }
};

exports.checkRegistration = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required." });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.json({ success: true, userExists: false, registered: false });
    }

    res.json({
      success: true,
      userExists: true,
      registered: !!user.zkpRegistered,
      role: user.role,
      name: user.name,
    });
  } catch (error) {
    console.error("Check Registration Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.generateRegistrationChallenge = async (req, res) => {
  res.status(501).json({
    success: false,
    message: "Registration challenge endpoint is not implemented.",
  });
};

exports.verifyRegistration = async (req, res) => {
  res.status(501).json({
    success: false,
    message: "Registration verification endpoint is not implemented.",
  });
};

exports.generateLoginChallenge = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required." });
    }

    const user = await User.findOne({ userId });
    if (!user || !user.zkpRegistered) {
      return res
        .status(404)
        .json({ success: false, message: "User not found or not registered." });
    }

    const challenge = zkpService.generateChallenge();
    user.zkpChallenge = challenge;
    user.zkpChallengeExpiry = new Date(
      Date.now() + (parseInt(process.env.ZKP_CHALLENGE_EXPIRY, 10) || 300000),
    );
    await user.save();

    res.json({ success: true, challenge, expiresAt: user.zkpChallengeExpiry });
  } catch (error) {
    console.error("Generate Login Challenge Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.verifyDeviceProof = async (req, res) => {
  try {
    const { userId, proof, trustDevice = false, deviceId } = req.body;
    if (!userId || !proof) {
      return res
        .status(400)
        .json({ success: false, message: "userId and proof are required." });
    }

    const user = await User.findOne({ userId });
    if (!user || !user.zkpRegistered || !user.zkpPublicKey) {
      return res
        .status(404)
        .json({ success: false, message: "User not found or not registered." });
    }

    if (
      !user.zkpChallenge ||
      !user.zkpChallengeExpiry ||
      new Date() > user.zkpChallengeExpiry
    ) {
      return res.status(400).json({
        success: false,
        message: "Challenge expired or missing. Request a new challenge.",
      });
    }

    const valid = verifySchnorrProof(
      proof,
      user.zkpChallenge,
      user.zkpPublicKey,
    );
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ZKP proof." });
    }

    const userAgent = req.headers["user-agent"] || "";
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Safari")) browser = "Safari";
    else if (userAgent.includes("Edge")) browser = "Edge";

    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac")) os = "MacOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iPhone") || userAgent.includes("iPad"))
      os = "iOS";

    const deviceName = `${browser} on ${os}`;
    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "Unknown IP";

    const finalDeviceId =
      deviceId || `dev_${Math.random().toString(36).substring(2, 15)}`;
    const existingDevice = user.authenticatedDevices.find(
      (d) => d.deviceId === finalDeviceId,
    );

    if (existingDevice) {
      existingDevice.isActive = true;
      existingDevice.trusted = trustDevice;
      existingDevice.lastLogin = new Date();
      existingDevice.ipAddress = ipAddress;
      existingDevice.deviceName = deviceName;
    } else {
      user.authenticatedDevices.push({
        deviceId: finalDeviceId,
        deviceName: deviceName,
        ipAddress: ipAddress,
        isActive: true,
        trusted: trustDevice,
        lastLogin: new Date(),
        createdAt: new Date(),
      });
    }

    user.zkpChallenge = null;
    user.zkpChallengeExpiry = null;
    await user.save();

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        name: user.name,
        deviceId: finalDeviceId,
      },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        userId: user.userId,
        deviceId: finalDeviceId,
        trusted: trustDevice,
      },
    });
  } catch (error) {
    console.error("Verify Device Proof Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.loginWithZKP = exports.verifyDeviceProof;

exports.requestPairingCode = async (req, res) => {
  try {
    const { userId, tempPublicKeyBase64 } = req.body;
    if (!userId || !tempPublicKeyBase64) {
      return res.status(400).json({
        success: false,
        message: "userId and tempPublicKeyBase64 are required.",
      });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.zkpPairingCode = pairingCode;
    user.zkpPairingTempPublicKey = tempPublicKeyBase64;
    user.zkpPairingPayload = null;
    user.zkpPairingExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    res.json({
      success: true,
      pairingCode,
      expiresAt: user.zkpPairingExpiresAt,
    });
  } catch (error) {
    console.error("Request Pairing Code Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.getTempPublicKey = async (req, res) => {
  try {
    const { pairingCode } = req.body;
    if (!pairingCode) {
      return res
        .status(400)
        .json({ success: false, message: "pairingCode is required." });
    }

    const user = await User.findOne({ zkpPairingCode: pairingCode });
    if (!user || !user.zkpPairingTempPublicKey) {
      return res
        .status(404)
        .json({ success: false, message: "Pairing session not found." });
    }

    if (!user.zkpPairingExpiresAt || new Date() > user.zkpPairingExpiresAt) {
      return res
        .status(400)
        .json({ success: false, message: "Pairing session expired." });
    }

    res.json({
      success: true,
      tempPublicKeyBase64: user.zkpPairingTempPublicKey,
      expiresAt: user.zkpChallengeExpiry,
    });
  } catch (error) {
    console.error("Get Temp Public Key Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.submitEncryptedKey = async (req, res) => {
  try {
    const { pairingCode, encryptedPayload } = req.body;
    if (!pairingCode || !encryptedPayload) {
      return res.status(400).json({
        success: false,
        message: "pairingCode and encryptedPayload are required.",
      });
    }

    const user = await User.findOne({ zkpPairingCode: pairingCode });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Pairing session not found." });
    }

    user.zkpPairingPayload = encryptedPayload;
    await user.save();

    res.json({
      success: true,
      message: "Encrypted key submitted successfully.",
    });
  } catch (error) {
    console.error("Submit Encrypted Key Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.pollEncryptedKey = async (req, res) => {
  try {
    const { userId, pairingCode } = req.body;
    if (!userId || !pairingCode) {
      return res.status(400).json({
        success: false,
        message: "userId and pairingCode are required.",
      });
    }

    const user = await User.findOne({
      userId,
      zkpPairingCode: pairingCode,
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Pairing session not found." });
    }

    if (!user.zkpPairingExpiresAt || new Date() > user.zkpPairingExpiresAt) {
      return res
        .status(400)
        .json({ success: false, message: "Pairing session expired." });
    }

    if (!user.zkpPairingPayload) {
      return res.json({ success: true, status: "waiting" });
    }

    const payload = user.zkpPairingPayload;
    user.zkpPairingCode = null;
    user.zkpPairingTempPublicKey = null;
    user.zkpPairingPayload = null;
    user.zkpChallengeExpiry = null;
    await user.save();

    return res.json({
      success: true,
      status: "complete",
      encryptedPayload: payload,
    });
  } catch (error) {
    console.error("Poll Encrypted Key Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name role userId email",
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    res.json({ success: true, user });
  } catch (error) {
    console.error("Get Me Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.getMyDevices = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "authenticatedDevices",
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    res.json({ success: true, devices: user.authenticatedDevices || [] });
  } catch (error) {
    console.error("Get My Devices Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.removeDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });

    user.authenticatedDevices = user.authenticatedDevices.filter(
      (d) => d.deviceId !== deviceId,
    );
    await user.save();

    res.json({ success: true, message: "Device removed successfully." });
  } catch (error) {
    console.error("Remove Device Error:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

exports.updateKeys = async (req, res) => {
  res.status(501).json({
    success: false,
    message: "Key update endpoint is not implemented.",
  });
};

exports.verifyAuth = async (req, res) => {
  res.json({ success: true, message: "Token is valid.", user: req.user });
};
