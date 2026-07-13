const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

const {
  addQuestion,
  bulkAddQuestions,
  getQuestions,
  updateQuestion,
  deleteQuestion
} = require("../controllers/questionController");

router.post("/", protect, adminOnly, addQuestion);
router.post("/bulk-upload", protect, adminOnly, bulkAddQuestions);
router.get("/", protect, adminOnly, getQuestions);
router.put("/:id", protect, adminOnly, updateQuestion);
router.delete("/:id", protect, adminOnly, deleteQuestion);

module.exports = router;