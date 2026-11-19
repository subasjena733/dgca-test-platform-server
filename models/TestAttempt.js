const mongoose = require("mongoose");

const TestAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    mockTestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MockTest"
    },

    mockTestTitle: {
      type: String,
      required: true
    },

    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question"
      }
    ],

    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question"
        },

        selectedOption: {
          type: String,
          default: null
        },

        timeSpent: {
          type: Number,
          default: 0
        }
      }
    ],

    currentQuestion: {
      type: Number,
      default: 0
    },

    remainingTime: {
      type: Number,
      default: 0
    },

    visitedQuestions: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    reviewQuestions: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    questionTimeMap: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    score: {
      type: Number,
      default: 0
    },

    //For Analytics
    correctCount: {
      type: Number,
      default: 0
    },

    wrongCount: {
      type: Number,
      default: 0
    },

    unattemptedCount: {   
      type: Number,
      default: 0
    },

    accuracy: {   
      type: Number,
      default: 0
    },

    percentage: {
      type: Number,
      default: 0
    },

    totalTimeSpent: {
      type: Number,
      default: 0
    },

    topicStats: [   
      {
        topic: String,
        correct: Number,
        total: Number
      }
    ],

    difficultyStats: [    
      {
        difficulty: String,
        correct: Number,
        total: Number
      }
    ],

    regradeHistory: [
      {
        regradedAt: { type: Date, default: Date.now },
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
        questionCode: String,
        reason: String,
        previousScore: Number,
        newScore: Number,
        previousCorrectCount: Number,
        newCorrectCount: Number,
        previousWrongCount: Number,
        newWrongCount: Number,
        previousAccuracy: Number,
        newAccuracy: Number,
        previousPercentage: Number,
        newPercentage: Number
      }
    ],

    status: {
      type: String,
      enum: ["IN_PROGRESS", "SUBMITTED"],
      default: "IN_PROGRESS"
    },

    startedAt: {
      type: Date,
      default: Date.now
    },



    submittedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "TestAttempt",
  TestAttemptSchema
);
