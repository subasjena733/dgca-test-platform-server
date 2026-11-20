const express = require("express");
const Lesson = require("../models/Lesson");
const SubjectMaster = require("../models/SubjectMaster");
const LessonNote = require("../models/LessonNote");
const mongoose = require("mongoose");
const Question = require("../models/Question");
const crypto = require("crypto");
const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const router = express.Router();

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_PDF_BUCKET || "lesson-pdfs";
  if (!url || !key) throw new Error("Supabase Storage is not configured on the server.");
  return { url, key, bucket };
}

function storageObjectUrl(config, objectPath) {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodedPath}`;
}

async function createPdfSignedUrl(objectPath) {
  const config = storageConfig();
  const response = await fetch(`${config.url}/storage/v1/object/sign/${encodeURIComponent(config.bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.key}`, apikey: config.key, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 900 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Could not create a temporary PDF link.");
  const signed = data.signedURL || data.signedUrl;
  if (!signed) throw new Error("Supabase did not return a signed PDF link.");
  if (/^https?:\/\//i.test(signed)) return signed;
  if (signed.startsWith("/storage/v1/")) return `${config.url}${signed}`;
  return `${config.url}/storage/v1/${signed.replace(/^\//, "")}`;
}

async function deleteStorageObject(config, objectPath) {
  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.key}`, apikey: config.key, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [objectPath] }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Supabase Storage could not delete the PDF.");
  }
}

router.use(protect);
router.get("/", async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { published: true };
    if (req.query.subject && req.query.subject !== "ALL") filter.subject = req.query.subject;
    const lessons = await Lesson.find(filter).sort({ sequence: 1, subject: 1, createdAt: -1 });
    if (req.user.role === "admin") return res.json(lessons);
    res.json(lessons.map((lesson) => {
      const data = lesson.toObject();
      data.hasPdf = Boolean(data.pdfPath || data.pdfUrl);
      delete data.pdfPath;
      delete data.pdfUrl;
      return data;
    }));
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get("/:id/pdf", async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role !== "admin") filter.published = true;
    const lesson = await Lesson.findOne(filter).select("pdfPath pdfUrl");
    if (!lesson) return res.status(404).json({ message: "Lesson not found." });
    if (lesson.pdfPath) return res.json({ url: await createPdfSignedUrl(lesson.pdfPath) });
    if (lesson.pdfUrl) return res.json({ url: lesson.pdfUrl });
    return res.status(404).json({ message: "No PDF is attached to this lecture." });
  } catch (error) { res.status(503).json({ message: error.message }); }
});

router.post("/:id/pdf", adminOnly, express.raw({ type: "application/pdf", limit: "25mb" }), async (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.subarray(0, 5).toString() !== "%PDF-") {
      return res.status(400).json({ message: "Select a valid PDF file (maximum 25 MB)." });
    }
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ message: "Lesson not found." });
    const config = storageConfig();
    const objectPath = `lectures/${lesson._id}/${crypto.randomUUID()}.pdf`;
    const uploadResponse = await fetch(storageObjectUrl(config, objectPath), {
      method: "POST",
      headers: { Authorization: `Bearer ${config.key}`, apikey: config.key, "Content-Type": "application/pdf", "x-upsert": "false" },
      body: req.body,
    });
    const uploadData = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) return res.status(502).json({ message: uploadData.message || "Supabase Storage could not save this PDF." });
    const previousPath = lesson.pdfPath;
    lesson.pdfPath = objectPath;
    lesson.pdfUrl = "";
    await lesson.save();
    if (previousPath) await deleteStorageObject(config, previousPath).catch(() => {});
    res.json({ message: "PDF uploaded to Supabase Storage." });
  } catch (error) { res.status(503).json({ message: error.message }); }
});

router.delete("/:id/pdf", adminOnly, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ message: "Lesson not found." });
    if (lesson.pdfPath) await deleteStorageObject(storageConfig(), lesson.pdfPath);
    lesson.pdfPath = "";
    lesson.pdfUrl = "";
    await lesson.save();
    res.json({ message: "Lecture PDF deleted from storage and detached." });
  } catch (error) { res.status(502).json({ message: error.message }); }
});

router.get("/notes", async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required." });
    const lessonIds = String(req.query.lessonIds || "").split(",").filter(Boolean);
    if (lessonIds.some((id) => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: "Invalid lesson list." });
    const notes = await LessonNote.find({ studentId: req.user.userId, lessonId: { $in: lessonIds } }).select("lessonId note");
    res.json(notes);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put("/:id/note", async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required." });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid lesson." });
    if (typeof req.body.note !== "string" || req.body.note.length > 5000) return res.status(400).json({ message: "Notes must be 5,000 characters or fewer." });
    const lesson = await Lesson.findOne({ _id: req.params.id, published: true });
    if (!lesson) return res.status(404).json({ message: "Published lesson not found." });
    const saved = await LessonNote.findOneAndUpdate(
      { studentId: req.user.userId, lessonId: req.params.id },
      { $set: { note: req.body.note } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select("lessonId note");
    res.json(saved);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get("/:id/dpp/questions", async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required." });
    const lesson = await Lesson.findOne({ _id: req.params.id, published: true }).select("title subject topic questionIds");
    if (!lesson) return res.status(404).json({ message: "Published lesson not found." });
    const found = await Question.find({ _id: { $in: lesson.questionIds }, status: "ACTIVE" }).select("subject topic difficulty questionText imageUrl options marks");
    const questionMap = new Map(found.map((question) => [question._id.toString(), question]));
    const questions = lesson.questionIds.map((id) => questionMap.get(id.toString())).filter(Boolean);
    res.json({ lesson, questions });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put("/:id/dpp", adminOnly, async (req, res) => {
  try {
    if (!Array.isArray(req.body.questionIds) || req.body.questionIds.length > 200 || req.body.questionIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Choose up to 200 valid questions." });
    }
    const questionIds = [...new Set(req.body.questionIds.map(String))];
    const count = await Question.countDocuments({ _id: { $in: questionIds }, status: "ACTIVE" });
    if (count !== questionIds.length) return res.status(400).json({ message: "One or more selected questions are unavailable." });
    const lesson = await Lesson.findByIdAndUpdate(req.params.id, { $set: { questionIds } }, { new: true, runValidators: true });
    if (!lesson) return res.status(404).json({ message: "Lesson not found." });
    res.json(lesson);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put("/order", adminOnly, async (req, res) => {
  try {
    const { lessonIds } = req.body;
    if (!Array.isArray(lessonIds) || lessonIds.length > 500
      || lessonIds.some((id) => !mongoose.isValidObjectId(id))
      || new Set(lessonIds.map(String)).size !== lessonIds.length) {
      return res.status(400).json({ message: "Provide a valid ordered list of lecture IDs." });
    }
    const existingCount = await Lesson.countDocuments({ _id: { $in: lessonIds } });
    if (existingCount !== lessonIds.length) return res.status(400).json({ message: "The lecture list changed. Refresh and try again." });
    if (lessonIds.length) {
      await Lesson.bulkWrite(lessonIds.map((id, sequence) => ({
        updateOne: { filter: { _id: id }, update: { $set: { sequence } } },
      })));
    }
    res.json(await Lesson.find().sort({ sequence: 1, subject: 1, createdAt: -1 }));
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put("/:id", adminOnly, async (req, res) => {
  try {
    const { title, subject, topic, duration, videoUrl, description, instructions } = req.body;
    if (typeof title !== "string" || !title.trim() || title.length > 160
      || typeof subject !== "string" || !subject.trim()
      || typeof videoUrl !== "string" || !/^https?:\/\//i.test(videoUrl.trim()) || videoUrl.length > 2048
      || (description !== undefined && (typeof description !== "string" || description.length > 2000))
      || (instructions !== undefined && (typeof instructions !== "string" || instructions.length > 5000))) {
      return res.status(400).json({ message: "Check the lecture title, subject, video URL, description, and instructions." });
    }
    const subjectExists = await SubjectMaster.findOne({ subjectName: subject.trim() });
    if (!subjectExists) return res.status(400).json({ message: "Choose a subject from the subject list." });
    const lesson = await Lesson.findOneAndUpdate(
      { _id: req.params.id, published: false },
      { $set: { title: title.trim(), subject: subject.trim(), topic: topic || "", duration: duration || "", videoUrl: videoUrl.trim(), description: description || "", instructions: instructions || "" } },
      { new: true, runValidators: true },
    );
    if (!lesson) {
      const exists = await Lesson.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({ message: exists ? "Unpublish this lecture before editing it." : "Lesson not found." });
    }
    res.json(lesson);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post("/", adminOnly, async (req, res) => {
  try {
    const { title, subject, topic, description, instructions, videoUrl, pdfUrl, duration } = req.body;
    if (!title?.trim() || !subject?.trim() || !videoUrl?.trim()) return res.status(400).json({ message: "Title, subject, and video link are required." });
    if (!/^https?:\/\//i.test(videoUrl.trim())) return res.status(400).json({ message: "Enter a valid http or https video link." });
    if (pdfUrl?.trim() && !/^https?:\/\//i.test(pdfUrl.trim())) return res.status(400).json({ message: "Enter a valid http or https PDF link." });
    const exists = await SubjectMaster.findOne({ subjectName: subject.trim() });
    if (!exists) return res.status(400).json({ message: "Choose a subject from the subject list." });
    const lastOrderedLesson = await Lesson.findOne({ sequence: { $exists: true } }).sort({ sequence: -1 }).select("sequence");
    const sequence = (lastOrderedLesson?.sequence ?? -1) + 1;
    res.status(201).json(await Lesson.create({ title, subject, topic, description, instructions, videoUrl, pdfUrl, duration, sequence }));
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
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ message: "Lesson not found." });
    let pdfDeleted = true;
    if (lesson.pdfPath) {
      try {
        await deleteStorageObject(storageConfig(), lesson.pdfPath);
      } catch (error) {
        if (req.body?.removeAnyway !== true) {
          return res.status(409).json({
            code: "PDF_DELETE_FAILED",
            message: "Supabase could not delete the attached PDF. Confirm if you want to remove the lecture while leaving the PDF in Supabase.",
          });
        }
        pdfDeleted = false;
      }
    }
    await lesson.deleteOne();
    res.json({ message: pdfDeleted ? "Lesson removed." : "Lesson removed; the PDF remains in Supabase Storage.", pdfDeleted });
  } catch (error) { res.status(500).json({ message: error.message }); }
});
module.exports = router;
