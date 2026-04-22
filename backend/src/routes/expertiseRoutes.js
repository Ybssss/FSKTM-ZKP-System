// routes/expertiseRoutes.js
const express = require("express");
const router = express.Router();
const expertiseController = require("../controllers/expertiseController");

// Define the GET route
router.get("/expertise", expertiseController.getPanelExpertise);

module.exports = router;
