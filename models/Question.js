const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  questionCode: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard"],
    default: "Medium"
  },
  questionText: {
    type: String,
    required: true
  },
  imageUrl: { type: String, trim: true, maxlength: 2048, default: "" },
  options: [
    {
      label: String,
      text: String
    }
  ],
  correctOption: {
    type: String,
    required: true
  },
  explanation: String,
  explanationImageUrl: { type: String, trim: true, maxlength: 2048, default: "" },
  solutionVideoUrl: { type: String, trim: true, maxlength: 2048, default: "" },
  marks: {
    type: Number,
    default: 1
  },
  negativeMarks: {
    type: Number,
    default: 0
  },
  // NEW
  status: {
    type: String,
    enum: ["ACTIVE", "SUPERSEDED", "DELETED"],
    default: "ACTIVE"
  },

    // NEW
  version: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

module.exports = mongoose.model("Question", QuestionSchema);
