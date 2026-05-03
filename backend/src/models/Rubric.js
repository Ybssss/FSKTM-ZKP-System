const mongoose = require("mongoose");

const criterionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },

    // 🔴 ADDED: The exact text from the PDFs for each grade level
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
      enum: ["PROPOSAL_DEFENSE", "PRE_VIVA", "PROGRESS_ASSESSMENT"],
      required: true,
      unique: true,
    },
    criteria: [criterionSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Rubric", rubricSchema);
