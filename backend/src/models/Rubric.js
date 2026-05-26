// src/models/Rubric.js
const mongoose = require("mongoose");

const criterionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },

    // 🔴 ADDED: Support for Quantitative vs Qualitative
    type: {
      type: String,
      enum: ["quantitative", "qualitative"],
      default: "quantitative",
    },

    // Quantitative specific fields
    weight: { type: Number, default: 0 },
    maxScore: { type: Number, default: 5 },

    // Qualitative specific field (Instructions)
    description: { type: String, default: "" },

    // Grading Scale Text
    outstanding: { type: String, default: "" }, // 5 Marks
    exemplary: { type: String, default: "" }, // 4 Marks
    proficient: { type: String, default: "" }, // 3 Marks
    satisfactory: { type: String, default: "" }, // 2 Marks
    foundational: { type: String, default: "" }, // 1 Mark
    novice: { type: String, default: "" }, // 0 Marks
  },
  { _id: false },
);

const rubricSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sessionType: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      match: /^[A-Z0-9_]+$/,
    },
    criteria: [criterionSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Rubric", rubricSchema);
