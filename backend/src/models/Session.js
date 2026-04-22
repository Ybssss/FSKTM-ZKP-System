// src/models/Session.js
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sessionType: {
      type: String,
      enum: ["MILESTONE", "PROPOSAL_DEFENSE", "UPGRADING", "PRE_VIVA"],
      required: true,
    },
    semester: {
      type: String,
      required: true,
    }, // e.g., "Semester 1, 2025/2026"

    panel1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    panel2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    supervisorEndorsed: {
      type: Boolean,
      default: false,
    }, // Required specifically for the UPGRADING form
  },
  { timestamps: true },
);

module.exports = mongoose.model("Session", sessionSchema);
