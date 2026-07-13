const MockTest = require("../models/MockTest");
const Question = require("../models/Question");
const TestAttempt = require("../models/TestAttempt");

const createMockTest = async (req, res) => {
  try {

    if (!req.body.questions || req.body.questions.length === 0) {
      return res.status(400).json({
        message: "At least one question is required"
      });
    }

    const mockTest = await MockTest.create(req.body);

    res.status(201).json(mockTest);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Old Architecture-Not used now
const createMockFromCodes = async (req, res) => {
  try {
    const {
      title,
      subject,
      questionCodes,
      durationMinutes,
      totalMarks,
      isPremium
    } = req.body;

    const questions = await Question.find({
      questionCode: { $in: questionCodes }
    });

    if (questions.length !== questionCodes.length) {
      return res.status(400).json({
        message: "Some question codes were not found"
      });
    }

    const questionIds = questions.map(q => q._id);

    const mockTest = await MockTest.create({
      title,
      subject,
      questions: questionIds,
      durationMinutes,
      totalMarks,
      isPremium
    });

    res.status(201).json(mockTest);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

//For admin table and student mock list.
const getMockTests = async (req, res) => {
  try {
  const mockTests = await MockTest.find({status: "ACTIVE",}).populate("questions");

    const mockTestsWithAttemptStatus =
      await Promise.all(
        mockTests.map(async (mock) => {

          const submittedAttempt =
            await TestAttempt.findOne({
              userId: req.user.userId,
              mockTestId: mock._id,
              status: "SUBMITTED"
            });

          const inProgressAttempt =
            await TestAttempt.findOne({
              userId: req.user.userId,
              mockTestId: mock._id,
              status: "IN_PROGRESS"
            });

          return {
            ...mock.toObject(),

            isAttempted: !!submittedAttempt,

            isInProgress: !!inProgressAttempt,

            attemptId:
              submittedAttempt?._id ||
              inProgressAttempt?._id ||
              null
          };
        })
      );
    res.status(200).json(
      mockTestsWithAttemptStatus
    );
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Fetch a single Mock test by Id
const getMockTestById = async (req, res) => {
  try {
    const mockTest = await MockTest.findById(req.params.id)
      .populate("questions");

    if (!mockTest) {
      return res.status(404).json({
        message: "Mock test not found"
      });
    }

    res.status(200).json(mockTest);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Update Mock test
const updateMockTest = async (req, res) => {
  try {
    const { id } = req.params;

    const mockTest = await MockTest.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!mockTest) {
      return res.status(404).json({
        message: "Mock test not found"
      });
    }

    res.status(200).json(mockTest);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Delete Mock test
const deleteMockTest = async (req, res) => {
  try {
    const { id } = req.params;

    const mockTest = await MockTest.findById(id);

    if (!mockTest) {
      return res.status(404).json({
        message: "Mock Test not found",
      });
    }

    if (mockTest.status === "DELETED") {
      return res.status(400).json({
        message: "Mock Test already deleted",
      });
    }

    mockTest.status = "DELETED";
    mockTest.deletedAt = new Date();

    await mockTest.save();

    res.json({
      message: "Mock Test deleted successfully",
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createMockTest,
  createMockFromCodes,
  getMockTests,
  getMockTestById,
  updateMockTest,
  deleteMockTest,
};