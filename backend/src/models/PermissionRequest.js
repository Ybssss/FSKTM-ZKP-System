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

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
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
  { unique: true },
);

module.exports = mongoose.model("PermissionRequest", permissionRequestSchema);
