const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  evaluatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rubricId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rubric',
    required: true,
  },
  semester: {
    type: String,
    required: true,
  },
  sessionType: {
    type: String,
    // Not required - optional field
  },
  scores: {
    type: Map,
    of: Number,
    required: true,
  },
  overallScore: {
    type: Number,
    required: true,
  },
  strengths: {
    type: String,
  },
  weaknesses: {
    type: String,
  },
  recommendations: {
    type: String,
  },
  overallComments: {
    type: String,
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'finalized'],
    default: 'submitted',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Evaluation', evaluationSchema);
