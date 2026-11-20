const express = require("express");
const Lesson = require("../models/Lesson");
const SubjectMaster = require("../models/SubjectMaster");
const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const router = express.Router();

router.use(protect);
router.get("/", async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { published: true };
    if (req.query.subject && req.query.subject !== "ALL") filter.subject = req.query.subject;
    res.json(await Lesson.find(filter).sort({ subject: 1, createdAt: -1 }));
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post("/", adminOnly, async (req, res) => {
  try {
    const { title, subject, topic, description, videoUrl, duration } = req.body;
    if (!title?.trim() || !subject?.trim() || !videoUrl?.trim()) return res.status(400).json({ message: "Title, subject, and video link are required." });
    if (!/^https?:\/\//i.test(videoUrl.trim())) return res.status(400).json({ message: "Enter a valid http or https video link." });
    const exists = await SubjectMaster.findOne({ subjectName: subject.trim() });
    if (!exists) return res.status(400).json({ message: "Choose a subject from the subject list." });
    res.status(201).json(await Lesson.create({ title, subject, topic, description, videoUrl, duration }));
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.patch("/:id", adminOnly, async (req, res) => {
  try {
    const lesson = await Lesson.findByIdAndUpdate(req.params.id, { $set: { published: Boolean(req.body.published) } }, { new: true, runValidators: true });
    if (!lesson) return res.status(404).json({ message: "Lesson not found." });
    res.json(lesson);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const lesson = await Lesson.findByIdAndDelete(req.params.id);
    if (!lesson) return res.status(404).json({ message: "Lesson not found." });
    res.json({ message: "Lesson removed." });
  } catch (error) { res.status(500).json({ message: error.message }); }
});
module.exports = router;
