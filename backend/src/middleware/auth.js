const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const getJwtSecret = () =>
  process.env.JWT_SECRET || "your-fallback-secret-key";

const findUserFromDecodedToken = async (decoded) => {
  const possibleMongoId = decoded.id || decoded._id || decoded.userMongoId;

  if (possibleMongoId && mongoose.Types.ObjectId.isValid(possibleMongoId)) {
    const user = await User.findById(possibleMongoId);
    if (user) return user;
  }

  // Backward compatibility for older tokens that stored ObjectId in userId.
  if (decoded.userId && mongoose.Types.ObjectId.isValid(decoded.userId)) {
    const user = await User.findById(decoded.userId);
    if (user) return user;
  }

  // Current authController signs userId as the human login ID, e.g. panel_web.
  if (decoded.userId) {
    return User.findOne({ userId: decoded.userId });
  }

  return null;
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      code: "NO_TOKEN",
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await findUserFromDecodedToken(decoded);

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User no longer exists. Please login again.",
      });
    }

    const deviceId = decoded.deviceId || null;

    // ZKP sessions should be tied to an active device. This protects revoked devices,
    // but supports both old and new JWT payload shapes.
    if (deviceId) {
      const activeDevice = (user.authenticatedDevices || []).find(
        (device) =>
          String(device.deviceId || "") === String(deviceId) &&
          device.isActive !== false,
      );

      if (!activeDevice) {
        return res.status(401).json({
          success: false,
          code: "DEVICE_REVOKED_OR_STALE",
          message:
            "Session revoked or stale. This device has been removed, reset, or reseeded. Please login/register again.",
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        code: "TOKEN_MISSING_DEVICE",
        message: "This session token is missing device information. Please login again.",
      });
    }

    req.user = {
      id: String(user._id),
      _id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      deviceId,
    };

    next();
  } catch (error) {
    const isExpired = error.name === "TokenExpiredError";

    return res.status(401).json({
      success: false,
      code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      message: isExpired
        ? "Session expired. Please login again."
        : "Invalid session token. Please login again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const requireRole = (roles = []) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: "INSUFFICIENT_PERMISSION",
        message: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
};
