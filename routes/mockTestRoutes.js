const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

const {
  createMockTest,
  createMockFromCodes,
  getMockTests,
  getMockTestById,
  updateMockTest,
  deleteMockTest
} = require("../controllers/mockTestController");

router.post("/", protect, adminOnly, createMockTest);
router.post("/create-from-codes", protect, adminOnly, createMockFromCodes);
//Get Mocktests
router.get("/", protect, getMockTests);
//Get a single Mocktest by Id
router.get("/:id", protect, getMockTestById);
//Update Mocktests
router.put("/:id", protect, adminOnly, updateMockTest);
//Delete Mocktests
router.delete("/:id", protect, adminOnly, deleteMockTest);

module.exports = router;