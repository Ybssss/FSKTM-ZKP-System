const ActivityLog = require('../models/ActivityLog');

/**
 * Utility to log user activities for the Audit Trail
 */
exports.logActivity = async (userId, action, details, req = null) => {
  try {
    let ipAddress = 'Unknown';
    let userAgent = 'Unknown';

    if (req) {
      ipAddress = req.ip || req.connection.remoteAddress;
      userAgent = req.headers['user-agent'];
    }

    await ActivityLog.create({
      userId,
      action,
      details,
      ipAddress,
      userAgent
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};