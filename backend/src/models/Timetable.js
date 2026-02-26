const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  sessionType: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  date: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  venue: {
    type: String,
    required: true,
  },
  deadline: {
    type: Date,
  },
  requirements: {
    type: String,
  },
  attachmentUrl: {
    type: String,
  },
  
  // NEW: Student Documents for Pre-Review
  studentDocuments: [{
    title: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['report', 'slides', 'supplementary', 'other'],
      default: 'other',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    fileSize: String,
    description: String,
  }],
  
  // NEW: Panel Pre-Review Notes
  panelNotes: [{
    panelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      required: true,
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  panels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled',
  },
  qrGenerated: {
    type: Boolean,
    default: false,
  },
  qrGeneratedAt: {
    type: Date,
  },
  remarks: [{
    panelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Timetable', timetableSchema);
