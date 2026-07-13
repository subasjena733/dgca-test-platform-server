const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getDashboardSummary,
  getWeakTopics,
  getTestHistory
} = require("../controllers/dashboardController");

router.get("/summary", protect, getDashboardSummary);
router.get("/weak-topics", protect, getWeakTopics);
router.get("/history", protect, getTestHistory);

module.exports = router;