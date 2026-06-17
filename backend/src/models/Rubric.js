const mongoose = require("mongoose");

const criterionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },

    type: {
      type: String,
      enum: ["quantitative", "qualitative"],
      default: "quantitative",
    },

    weight: { type: Number, default: 0 },
    maxScore: { type: Number, default: 5 },

    description: { type: String, default: "" },

    outstanding: { type: String, default: "" },
    exemplary: { type: String, default: "" },
    proficient: { type: String, default: "" },
    satisfactory: { type: String, default: "" },
    foundational: { type: String, default: "" },
    novice: { type: String, default: "" },
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
    originalSessionType: {
      type: String,
      required: true,
      default() {
        return this.sessionType;
      },
      trim: true,
      uppercase: true,
      maxlength: 50,
      match: /^[A-Z0-9_]+$/,
    },
    isObsolete: {
      type: Boolean,
      default: false,
      index: true,
    },
    obsoleteAt: {
      type: Date,
      default: null,
    },
    criteria: [criterionSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Rubric", rubricSchema);
