const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

const {
  addQuestion,
  bulkAddQuestions,
  getQuestions,
  updateQuestion,
  regradeQuestionAttempts,
  deleteQuestion
} = require("../controllers/questionController");
const Question = require("../models/Question");
const PracticeProgress = require("../models/PracticeProgress");
const mongoose = require("mongoose");

const studentOnly = (req, res, next) => {
  if (req.user?.role !== "student") return res.status(403).json({ message: "Student access required." });
  next();
};

// Student practice endpoints deliberately keep answer keys off the question list.
router.get("/practice", protect, studentOnly, async (req, res) => {
  try {
    const { subject, topic, difficulty, limit = 20 } = req.query;
    const filter = { status: "ACTIVE" };
    if (subject && subject !== "ALL") filter.subject = subject;
    if (topic && topic !== "ALL") filter.topic = topic;
    if (["Easy", "Medium", "Hard"].includes(difficulty)) filter.difficulty = difficulty;
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);
    const questions = await Question.find(filter).select("subject topic difficulty questionText imageUrl options marks").limit(safeLimit);
    res.json(questions);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get("/practice/progress", protect, studentOnly, async (req, res) => {
  try {
    const questionIds = String(req.query.questionIds || "").split(",").filter(Boolean);
    if (questionIds.some((id) => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: "Invalid question list." });
    const progress = await PracticeProgress.find({ studentId: req.user.userId, questionId: { $in: questionIds } }).select("questionId status markedForRevision note");
    res.json(progress);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put("/practice/:id/progress", protect, studentOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid question." });
    const questionExists = await Question.exists({ _id: req.params.id });
    if (!questionExists) return res.status(404).json({ message: "Question not found." });
    const updates = {};
    if (typeof req.body.markedForRevision === "boolean") updates.markedForRevision = req.body.markedForRevision;
    if (typeof req.body.note === "string") {
      if (req.body.note.length > 5000) return res.status(400).json({ message: "Notes must be 5,000 characters or fewer." });
      updates.note = req.body.note;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: "Provide a note or revision status." });
    const progress = await PracticeProgress.findOneAndUpdate(
      { studentId: req.user.userId, questionId: req.params.id },
      { $set: updates, $setOnInsert: { status: "unattempted" } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select("questionId status markedForRevision note");
    res.json(progress);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post("/practice/:id/answer", protect, studentOnly, async (req, res) => {
  try {
    const question = await Question.findOne({ _id: req.params.id, status: "ACTIVE" });
    if (!question) return res.status(404).json({ message: "Question not found." });
    const selectedOption = String(req.body.selectedOption || "");
    if (!["A", "B", "C", "D"].includes(selectedOption)) return res.status(400).json({ message: "Choose an answer first." });
    const correct = selectedOption === question.correctOption;
    const progress = await PracticeProgress.findOneAndUpdate(
      { studentId: req.user.userId, questionId: question._id },
      { $set: { status: correct ? "correct" : "wrong", lastAttemptAt: new Date() }, $setOnInsert: { markedForRevision: false, note: "" } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select("questionId status markedForRevision note");
    res.json({ correct, correctOption: question.correctOption, explanation: question.explanation || "", explanationImageUrl: question.explanationImageUrl || "", solutionVideoUrl: question.solutionVideoUrl || "", progress });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get("/practice/:id/solution", protect, studentOnly, async (req, res) => {
  try {
    const question = await Question.findOne({ _id: req.params.id, status: "ACTIVE" }).select("correctOption explanation explanationImageUrl solutionVideoUrl");
    if (!question) return res.status(404).json({ message: "Question not found." });
    res.json({ correctOption: question.correctOption, explanation: question.explanation || "", explanationImageUrl: question.explanationImageUrl || "", solutionVideoUrl: question.solutionVideoUrl || "" });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post("/", protect, adminOnly, addQuestion);
router.post("/bulk-upload", protect, adminOnly, bulkAddQuestions);
router.get("/", protect, adminOnly, getQuestions);
router.put("/:id", protect, adminOnly, updateQuestion);
router.post("/:id/regrade-attempts", protect, adminOnly, regradeQuestionAttempts);
router.delete("/:id", protect, adminOnly, deleteQuestion);

module.exports = router;
