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
      enum: ["PROGRESS_ASSESSMENT", "PROPOSAL_DEFENSE", "PRE_VIVA"],
      required: true,
    },

    semester: { type: String, required: true },

    // 🔴 ADDED DATE, TIME, AND VENUE FOR THE DASHBOARD
    date: { type: Date, required: true },
    time: { type: String, required: true }, // e.g., "10:00 AM"
    venue: { type: String, default: "Online / Webex" },

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
  },
  { timestamps: true },
);

module.exports = mongoose.model("Session", sessionSchema);
