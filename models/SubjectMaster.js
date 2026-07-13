const mongoose = require("mongoose");

const SubjectMasterSchema = new mongoose.Schema(
  {
    subjectName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    subjectPrefix: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    questionCounter: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "SubjectMaster",
  SubjectMasterSchema
);