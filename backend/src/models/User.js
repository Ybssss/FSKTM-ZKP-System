const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: ["admin", "panel", "student"],
      required: true,
    },
    // 🔴 FIXED: ADDED THE MISSING UTHM DIRECTORY FIELDS
    matricNumber: { type: String, default: "" },
    profession: { type: String, default: "" },
    researchTitle: { type: String, default: "" },
    researchAbstract: {
      type: String,
      default: "",
      maxlength: 5000,
    },

    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    expertiseTags: {
      type: [String],
      default: [],
    },

    // 🔴 FIXED: ADDED THE MISSING ASSIGNMENT ARRAYS
    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    assignedPanels: [
      {
        panelId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date, default: null },
      },
    ],

    registrationCode: { type: String, default: null },
    zkpPublicKey: { type: String, default: null },
    zkpRegistered: { type: Boolean, default: false },
    zkpChallenge: { type: String, default: null },
    zkpChallengeExpiry: { type: Date, default: null },
    zkpPairingCode: { type: String, default: null },
    zkpPairingTempPublicKey: { type: String, default: null },
    zkpPairingPayload: { type: String, default: null },
    zkpPairingExpiresAt: { type: Date, default: null },

    authenticatedDevices: [
      {
        deviceId: String,
        deviceName: String,
        ipAddress: String,
        isActive: { type: Boolean, default: true },
        trusted: { type: Boolean, default: false },
        lastLogin: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    zkpIdentityCommitment: { type: String, default: null },
  },
  { timestamps: true },
);

userSchema.methods.logoutAllDevices = function () {
  this.authenticatedDevices = [];
};

module.exports = mongoose.model("User", userSchema);
