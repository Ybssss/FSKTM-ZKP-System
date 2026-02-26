const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  timetableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Timetable',
    required: true,
  },
  checkInTime: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['present', 'late', 'absent', 'excused'],
    default: 'present',
  },
  location: {
    type: String,
  },
  verificationMethod: {
    type: String,
    enum: ['qr-code', 'manual', 'automatic'],
    default: 'qr-code',
  },
  notes: {
    type: String,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
attendanceSchema.index({ studentId: 1, checkInTime: -1 });
attendanceSchema.index({ timetableId: 1 });
attendanceSchema.index({ status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
