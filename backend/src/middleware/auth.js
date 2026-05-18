const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key-change-this",
    );

    // 1. Find the user using the MongoDB ObjectId stored in the JWT payload.
    // STRICT DEVICE VALIDATION
    // decoded.id = MongoDB ObjectId
    // decoded.userId = public user ID / matric number / staff ID
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists.",
      });
    }

    // 2. Check if the device issuing this token was removed or logged out
    const activeDevice = user.authenticatedDevices.find(
      (d) => d.deviceId === decoded.deviceId,
    );

    if (!activeDevice || !activeDevice.isActive) {
      return res.status(401).json({
        success: false,
        message: "Session revoked. This device has been removed or logged out.",
      });
    }

    // Pass the user data to the next function
    req.user = {
      id: user._id,
      userId: user.userId,
      role: user.role,
      deviceId: decoded.deviceId,
    };

    next();
  } catch (error) {
    return res
      .status(403)
      .json({ success: false, message: "Invalid or expired token." });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    // If roles is passed as an array, check if req.user.role is included.
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }
    next();
  };
};

// Export them cleanly at the bottom
module.exports = {
  authenticateToken,
  requireRole,
};
