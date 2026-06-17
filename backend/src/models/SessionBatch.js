const mongoose = require("mongoose");

const sessionBatchSchema = new mongoose.Schema(
  {
    batchName: {
      type: String,
      required: true,
      trim: true,
    },
    batchId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    academicSession: {
      type: String,
      default: "",
    },
    sessionType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    rubricId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rubric",
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    slotDurationMinutes: {
      type: Number,
      default: 60,
    },
    breakBetweenSlotsMinutes: {
      type: Number,
      default: 5,
    },
    googleMeetLink: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "completed", "cancelled"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SessionBatch", sessionBatchSchema);
