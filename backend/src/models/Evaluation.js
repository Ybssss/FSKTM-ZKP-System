// src/models/Evaluation.js
const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    evaluatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rubricId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rubric",
    },
    semester: String,
    sessionType: String,


    // Match fields used in evaluationController
    scores: {
      type: Map,
      of: Number,
    },
    strengths: String,
    weaknesses: String,
    recommendations: String,

    // Legacy support for EvaluationRubric.jsx
    rubricScores: {
      type: Map,
      of: Number,
    },

    totalMarks: {
      type: Number, 
      default: 0,
    },

    // Text indexed for Dr. Samihah's Search Feature
    overallComments: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

evaluationSchema.index({ overallComments: "text" });

module.exports = mongoose.model("Evaluation", evaluationSchema);
