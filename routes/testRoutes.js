const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  generateMockTest,
  startPremiumMockSession,
  saveProgress,
  submitPremiumMock,
  getAttemptResult,
  getAttemptReview,
  getLeaderboard,
  resumePremiumMockSession,
  getPerformanceHistory
} = require("../controllers/testController");

router.get("/mock", generateMockTest);
router.post("/start-mock/:mockTestId", protect, startPremiumMockSession);
router.post("/save-progress/:attemptId", protect, saveProgress);
router.post("/submit/:attemptId", protect, submitPremiumMock);
router.get("/review/:attemptId", protect, getAttemptReview);
router.get("/leaderboard/:mockTestId", protect, getLeaderboard);
router.get("/result/:attemptId", protect, getAttemptResult);
router.get("/resume/:attemptId", protect, resumePremiumMockSession);
router.get("/performance-history", protect, getPerformanceHistory);

module.exports = router;