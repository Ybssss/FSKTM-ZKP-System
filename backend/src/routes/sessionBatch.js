const express = require("express");
const router = express.Router();

const { authenticateToken, requireRole } = require("../middleware/auth");
const {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
} = require("../controllers/sessionBatchController");

router.use(authenticateToken);

router.post("/", requireRole(["admin"]), createBatch);
router.get("/", requireRole(["admin"]), getBatches);
router.get("/:batchId", requireRole(["admin"]), getBatchById);
router.put("/:batchId", requireRole(["admin"]), updateBatch);

module.exports = router;
