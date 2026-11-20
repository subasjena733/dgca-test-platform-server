const mongoose = require("mongoose");

const LessonNoteSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true },
  note: { type: String, trim: true, maxlength: 5000, default: "" },
}, { timestamps: true });

LessonNoteSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model("LessonNote", LessonNoteSchema);
