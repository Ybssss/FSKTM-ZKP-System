const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Registration (First time setup for Panel/Admin)
router.post(
  "/register/challenge",
  authController.generateRegistrationChallenge,
);
router.post("/register/verify", authController.verifyRegistration);

// Login (Passwordless ZKP)
router.post("/login/challenge", authController.generateLoginChallenge);
router.post("/login/verify", authController.verifyDeviceProof);

module.exports = router;
