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
    semester: String,
    sessionType: String,

    // Track if the panel has filled this out yet
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
    },

    // --- SCORED Rubrics (Proposal & Pre-Viva) ---
    rubricId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rubric",
      default: null,
    },
    scores: { type: Map, of: Number, default: {} },
    totalMarks: { type: Number, default: 0 },

    // --- QUALITATIVE Forms (Progress Assessment) ---
    summaryOfProgress: { type: String, default: "" },
    commentsForImprovement: { type: String, default: "" },
    overallSuggestions: { type: String, default: "" },
    formFiller: {
      type: String,
      enum: ["Panel", "Supervisor"],
      default: "Panel",
    },

    // Overall Comments (Indexed for Search)
    overallComments: { type: String, default: "" },
  },
  { timestamps: true },
);

evaluationSchema.index({
  overallComments: "text",
  summaryOfProgress: "text",
  commentsForImprovement: "text",
  overallSuggestions: "text",
});

module.exports = mongoose.model("Evaluation", evaluationSchema);
