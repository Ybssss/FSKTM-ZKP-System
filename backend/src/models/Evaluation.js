const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Timetable", // 🔴 FIXED: Was "Session", causing Mongoose to return null!
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

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
    },

    rubricId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rubric",
      default: null,
    },
    scores: { type: Map, of: Number, default: {} },
    qualitativeFeedback: { type: Map, of: String, default: {} },
    totalMarks: { type: Number, default: 0 },

    summaryOfProgress: { type: String, default: "" },
    commentsForImprovement: { type: String, default: "" },
    overallSuggestions: { type: String, default: "" },

    formFiller: {
      type: String,
      enum: ["Panel", "Supervisor"],
      default: "Panel",
    },

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
