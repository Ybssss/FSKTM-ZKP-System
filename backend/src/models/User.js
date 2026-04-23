// src/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: ["superadmin", "admin", "panel", "student"],
      required: true,
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
    registrationCode: {
      type: String,
      default: null,
    },
    zkpPublicKey: {
      type: String,
      default: null,
    },
    zkpRegistered: {
      type: Boolean,
      default: false,
    },
    zkpChallenge: {
      type: String,
      default: null,
    },
    zkpChallengeExpiry: {
      type: Date,
      default: null,
    },
    zkpPairingCode: {
      type: String,
      default: null,
    },
    zkpPairingTempPublicKey: {
      type: String,
      default: null,
    },
    zkpPairingPayload: {
      type: String,
      default: null,
    },
    zkpPairingExpiresAt: {
      type: Date,
      default: null,
    },
    authenticatedDevices: [
      {
        deviceId: String,
        deviceName: String, // e.g., "Chrome on Windows"
        ipAddress: String,
        isActive: { type: Boolean, default: true },
        trusted: { type: Boolean, default: false },
        lastLogin: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    zkpIdentityCommitment: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.methods.logoutAllDevices = function () {
  this.authenticatedDevices = [];
};

module.exports = mongoose.model("User", userSchema);
