const mongoose = require("mongoose");

const MockTestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    subject: {
      type: String
    },

    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question"
      }
    ],

    durationMinutes: {
      type: Number,
      default: 90
    },

    totalMarks: {
      type: Number,
      default: 100
    },

    isPremium: {
      type: Boolean,
      default: false
    },

    isPublished: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ["ACTIVE", "DELETED"],
      default: "ACTIVE",
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MockTest", MockTestSchema);