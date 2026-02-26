const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  action: { 
    type: String, 
    required: true,
    // Examples: 'USER_REGISTERED', 'EVALUATION_CREATED', 'DEVICE_PAIRED', 'LOGIN_SUCCESS'
  },
  details: { 
    type: String, 
    required: true 
  },
  ipAddress: { 
    type: String 
  },
  userAgent: { 
    type: String 
  }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);