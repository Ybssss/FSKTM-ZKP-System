const mongoose = require("mongoose");

const permissionRequestSchema = new mongoose.Schema(
  {
    requestingPanelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetEvaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evaluation",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The panel who originally wrote the evaluation (they must approve it)
    owningPanelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    batchId: {
      type: String,
      default: null,
      index: true,
    },

    scope: {
      type: String,
      enum: ["SINGLE_EVALUATION", "STUDENT_HISTORY", "UNLOCK_EVALUATION"],
      default: "SINGLE_EVALUATION",
    },

    currentSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Timetable",
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    withdrawnBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    withdrawnAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"],
      default: "PENDING",
    },
    reason: {
      type: String,
      default: "Need to review historical context for current evaluation.",
    },
  },
  { timestamps: true },
);

// Prevent duplicate requests
permissionRequestSchema.index(
  { requestingPanelId: 1, targetEvaluationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: ["PENDING", "APPROVED"],
      },
    },
  },
);

module.exports = mongoose.model("PermissionRequest", permissionRequestSchema);
