const mongoose = require("mongoose");

const PracticeProgressSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
  status: { type: String, enum: ["unattempted", "correct", "wrong"], default: "unattempted" },
  markedForRevision: { type: Boolean, default: false },
  note: { type: String, default: "", maxlength: 5000 },
  lastAttemptAt: { type: Date, default: null },
}, { timestamps: true });

PracticeProgressSchema.index({ studentId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model("PracticeProgress", PracticeProgressSchema);
