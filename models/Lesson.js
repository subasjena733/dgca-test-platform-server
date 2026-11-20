const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  subject: { type: String, required: true, trim: true },
  topic: { type: String, trim: true, default: "" },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  instructions: { type: String, trim: true, maxlength: 5000, default: "" },
  videoUrl: { type: String, required: true, trim: true, maxlength: 2048 },
  pdfUrl: { type: String, trim: true, maxlength: 2048, default: "" },
  pdfPath: { type: String, trim: true, default: "" },
  questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
  duration: { type: String, trim: true, default: "" },
  sequence: { type: Number },
  published: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Lesson", LessonSchema);
