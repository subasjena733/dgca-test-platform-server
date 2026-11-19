const Question = require("../models/Question");
const MockTest = require("../models/MockTest");
const TestAttempt = require("../models/TestAttempt");
const User = require("../models/User");

const generateMockTest = async (req, res) => {
  try {
    const questions = await Question.aggregate([
      { $sample: { size: 5 } }
    ]);

    res.json(questions);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const startPremiumMockSession = async (req, res) => {
  try {
    const { mockTestId } = req.params;

    const mockTest = await MockTest.findById(mockTestId)
      .populate("questions");

    if (!mockTest) {
      return res.status(404).json({
        message: "Mock test not found"
      });
    }

    

    const existingAttempt = await TestAttempt.findOne({
      userId: req.user.userId,
      mockTestId: mockTest._id,
      status: "SUBMITTED"
    });

    if (existingAttempt) {
      return res.status(400).json({
        message: "You have already attempted this mock test"
      });
    }
    //This block is replaced by below one to block duplicate creation due to react stric mode, duplicate click or anything like that
    /*const attempt = await TestAttempt.create({
      userId: req.user.userId,
      mockTestId: mockTest._id,
      questions: mockTest.questions.map(q => q._id),
      status: "IN_PROGRESS"
    });*/
    //Updated below with atomic upsert
    const attempt = await TestAttempt.findOneAndUpdate(
    {
      userId: req.user.userId,
      mockTestId: mockTest._id,
      status: "IN_PROGRESS"
    },
    {
      $setOnInsert: {
        userId: req.user.userId,
        mockTestId: mockTest._id,
        mockTestTitle: mockTest.title,
        questions: mockTest.questions.map(q => q._id),
        status: "IN_PROGRESS"
      }
    },
    {
      returnDocument: "after",
      upsert: true
    }
  );


    const sanitizedQuestions = mockTest.questions.map(q => ({
      _id: q._id,
      questionCode: q.questionCode,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      questionText: q.questionText,
      imageUrl: q.imageUrl || "",
      options: q.options
    }));

    res.status(201).json({
      
      attemptId: attempt._id,
      mockTestId: mockTest._id,
      title: mockTest.title,
      durationMinutes: mockTest.durationMinutes,
      questions: sanitizedQuestions
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const submitPremiumMock = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers, totalTimeSpent } = req.body;

    const attempt = await TestAttempt.findOne({
      _id: attemptId,
      userId: req.user.userId
    });

    if (!attempt) {
      return res.status(404).json({
        message: "Attempt not found or unauthorized"
      });
    }

    if (attempt.status === "SUBMITTED") {
      return res.status(400).json({
        message: "Test already submitted"
      });
    }

    const questions = await Question.find({
      _id: { $in: attempt.questions }
    });

    let score = 0;
    let correct = 0;
    let wrong = 0;

    const topicStatsMap = {};
    const difficultyStatsMap = {};

    questions.forEach(question => {

      if (!topicStatsMap[question.topic]) {
        topicStatsMap[question.topic] = {
          topic: question.topic,
          correct: 0,
          total: 0
        };
      }

      if (!difficultyStatsMap[question.difficulty]) {
        difficultyStatsMap[question.difficulty] = {
          difficulty: question.difficulty,
          correct: 0,
          total: 0
        };
      }

      topicStatsMap[question.topic].total += 1;
      difficultyStatsMap[question.difficulty].total += 1;
    });

    // New answer.forEach replaced to accomodate time stamp so that skipped is not counted as wrong
    answers.forEach(answer => {
      const question = questions.find(
        q => q._id.toString() === answer.questionId
      );

      if (question) {

        if (
          answer.selectedOption === null ||
          answer.selectedOption === undefined
        ) {
          return;
        }

        if (question.correctOption === answer.selectedOption) {
          score += question.marks || 1;
          correct += 1;

          topicStatsMap[question.topic].correct += 1;
          difficultyStatsMap[question.difficulty].correct += 1;
        } else {
          wrong += 1;
          score -= question.negativeMarks || 0;
        }
      }
    });
    
    //const unattempted = attempt.questions.length - answers.length;---> replaced by below block
    const unattempted = answers.filter(
      answer =>
        answer.selectedOption === null ||
        answer.selectedOption === undefined
    ).length;

    const attempted = correct + wrong;

    const accuracy = attempted > 0 ? Number(((correct / attempted) * 100).toFixed(2)) : 0;

    const totalPossibleMarks = questions.reduce(
      (sum, question) => sum + (question.marks || 1),
      0
    );

    const rawPercentage = totalPossibleMarks > 0 ? (score / totalPossibleMarks) * 100 : 0;
    const percentage = Number(Math.max(0, rawPercentage).toFixed(2));

    const topicStats = Object.values(topicStatsMap);
    const difficultyStats = Object.values(difficultyStatsMap);

    attempt.answers = answers;
    attempt.score = score;
    attempt.correctCount = correct;
    attempt.wrongCount = wrong;
    attempt.unattemptedCount = unattempted;
    attempt.accuracy = accuracy;
    attempt.percentage = percentage;
    attempt.totalTimeSpent = totalTimeSpent;
    attempt.topicStats = topicStats;
    attempt.difficultyStats = difficultyStats;
    attempt.status = "SUBMITTED";
    attempt.submittedAt = new Date();

    await attempt.save();

    //Rank calculator
    const betterAttempts = await TestAttempt.countDocuments({
      mockTestId: attempt.mockTestId,
      status: "SUBMITTED",
      $or: [
        {
          percentage: { $gt: attempt.percentage }
        },
        {
          percentage: attempt.percentage,
          accuracy: { $gt: attempt.accuracy }
        },
        {
          percentage: attempt.percentage,
          accuracy: attempt.accuracy,
          submittedAt: { $lt: attempt.submittedAt }
        }
      ]
    });

    const rank = betterAttempts + 1;

    const totalParticipants = await TestAttempt.countDocuments({
      mockTestId: attempt.mockTestId,
      status: "SUBMITTED"
    });

    res.status(200).json({
      message: "Test submitted successfully",
      attemptId: attempt._id,
      mockTestTitle: attempt.mockTestTitle,
      score,
      correct,
      wrong,
      unattempted,
      accuracy,
      percentage,
      rank,
      totalParticipants,
      topicStats,
      difficultyStats,
      totalTimeSpent
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const getAttemptResult = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await TestAttempt.findOne({
      _id: attemptId,
      userId: req.user.userId,
      status: "SUBMITTED"
    });

    if (!attempt) {
      return res.status(404).json({
        message: "Attempt not found"
      });
    }

    const betterAttempts = await TestAttempt.countDocuments({
      mockTestId: attempt.mockTestId,
      status: "SUBMITTED",
      $or: [
        {
          percentage: { $gt: attempt.percentage }
        },
        {
          percentage: attempt.percentage,
          accuracy: { $gt: attempt.accuracy }
        },
        {
          percentage: attempt.percentage,
          accuracy: attempt.accuracy,
          submittedAt: { $lt: attempt.submittedAt }
        }
      ]
    });

    const rank = betterAttempts + 1;

    const totalParticipants = await TestAttempt.countDocuments({
      mockTestId: attempt.mockTestId,
      status: "SUBMITTED"
    });

    res.status(200).json({
      mockTestId: attempt.mockTestId,
      mockTestTitle: attempt.mockTestTitle,
      score: attempt.score,
      correct: attempt.correctCount,
      wrong: attempt.wrongCount,
      unattempted: attempt.unattemptedCount,
      accuracy: attempt.accuracy,
      percentage: attempt.percentage,
      rank,
      totalParticipants,
      totalTimeSpent: attempt.totalTimeSpent
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const getAttemptReview = async (req, res) => {
  try {
    const { attemptId } = req.params;

    let attempt;

    if (req.user.role === "admin") {
      attempt = await TestAttempt.findOne({
        _id: attemptId,
        status: "SUBMITTED"
      })
        .populate("userId", "name email")
        .populate("regradeHistory.adminId", "name email");
    } else {
      attempt = await TestAttempt.findOne({
        _id: attemptId,
        userId: req.user.userId,
        status: "SUBMITTED"
      }).populate("userId", "name email");
    }

    if (!attempt) {
      return res.status(404).json({
        message: "Attempt not found"
      });
    }

    const fetchedQuestions = await Question.find({
      _id: { $in: attempt.questions }
    });
    const questionsById = new Map(
      fetchedQuestions.map(question => [question._id.toString(), question])
    );
    const questions = attempt.questions
      .map(questionId => questionsById.get(questionId.toString()))
      .filter(Boolean);

    const review = questions.map(question => {
      const answer = attempt.answers.find(
        ans => ans.questionId.toString() === question._id.toString()
      );

      let status = "SKIPPED";
      let selectedOption = null;
      let timeSpent = 0;

      if (answer) {
        selectedOption = answer.selectedOption;
        timeSpent = answer.timeSpent || 0;

        if (answer.selectedOption === null || answer.selectedOption === undefined) {
          status = "SKIPPED";
        } else {
          status = answer.selectedOption === question.correctOption ? "CORRECT" : "WRONG";
        }
      }

      return {
        questionId: question._id,
        questionCode: question.questionCode,
        subject: question.subject,
        topic: question.topic,
        difficulty: question.difficulty,
        questionText: question.questionText,
        imageUrl: question.imageUrl || "",
        options: question.options,
        selectedOption,
        correctOption: question.correctOption,
        status,
        timeSpent,
        marks: question.marks || 1,
        negativeMarks: question.negativeMarks || 0,
        explanation: question.explanation || null,
        explanationImageUrl: question.explanationImageUrl || "",
        solutionVideoUrl: question.solutionVideoUrl || ""
      };
    });

    res.status(200).json({
      attemptId,
      candidateName: attempt.userId.name,
      candidateEmail: attempt.userId.email,
      mockTestTitle: attempt.mockTestTitle,
      totalTimeSpent: attempt.totalTimeSpent,
      ...(req.user.role === "admin" ? { regradeHistory: attempt.regradeHistory } : {}),
      review
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Leaderboard

const getLeaderboard = async (req, res) => {
  try {
    const { mockTestId } = req.params;
    const userId = req.user.userId;

    let attempted = null;

    // Students must attempt before viewing leaderboard
    if (req.user.role !== "admin") {
      attempted = await TestAttempt.findOne({
        userId,
        mockTestId,
        status: "SUBMITTED"
      });

      if (!attempted) {
        return res.status(403).json({
          message:
            "You must attempt this mock test to view leaderboard"
        });
      }
    }

    const attempts = await TestAttempt.find({
      mockTestId,
      status: "SUBMITTED"
    })
      .populate("userId", "name")
      .sort({
        score: -1,
        totalTimeSpent: 1,
        submittedAt: 1
      });

    const leaderboard = attempts.map((attempt, index) => ({
      rank: index + 1,
      attemptId: attempt._id,
      studentName: attempt.userId.name,
      score: attempt.score,
      correct: attempt.correctCount,
      wrong: attempt.wrongCount,
      unattempted: attempt.unattemptedCount,
      accuracy: attempt.accuracy,
      totalTimeSpent: attempt.totalTimeSpent,
      submittedAt: attempt.submittedAt,
    }));

    res.status(200).json({
      totalParticipants: leaderboard.length,
      leaderboard
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const resumePremiumMockSession = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await TestAttempt.findOne({
      _id: attemptId,
      userId: req.user.userId,
      status: "IN_PROGRESS"
    });

    if (!attempt) {
      return res.status(404).json({
        message: "No resumable attempt found"
      });
    }

    const mockTest = await MockTest.findById(
      attempt.mockTestId
    ).populate("questions");

    if (!mockTest) {
      return res.status(404).json({
        message: "Mock Test not found"
      });
    }

    const sanitizedQuestions = mockTest.questions.map(q => ({
      _id: q._id,
      questionCode: q.questionCode,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      questionText: q.questionText,
      imageUrl: q.imageUrl || "",
      options: q.options
    }));

    const selectedAnswers = {};

    attempt.answers.forEach(answer => {
      selectedAnswers[answer.questionId.toString()] =
        answer.selectedOption;
    });

    res.status(200).json({
      resume: true,

      attemptId: attempt._id,

      mockTestId: mockTest._id,

      title: mockTest.title,

      durationMinutes: mockTest.durationMinutes,

      questions: sanitizedQuestions,

      selectedAnswers,

      currentQuestionIndex:
        attempt.currentQuestion || 0,

      timeLeftSeconds:
        attempt.remainingTime ??
        mockTest.durationMinutes * 60,

      visitedQuestions:
        attempt.visitedQuestions || {},

      reviewQuestions:
        attempt.reviewQuestions || {},

      questionTimeMap:
        attempt.questionTimeMap || {}
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Auto save of test
const saveProgress = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const {
      answers,
      currentQuestion,
      remainingTime,
      visitedQuestions,
      reviewQuestions,
      questionTimeMap
    } = req.body;
    /*------------------Replaced with New block------------------*/
    
    /* const attempt = await TestAttempt.findOne({
      _id: attemptId,
      userId: req.user.userId,
      status: "IN_PROGRESS"
    });

    if (!attempt) {
      return res.status(404).json({
        message: "Attempt not found"
      });
    }

    attempt.answers = answers;
    attempt.currentQuestion = currentQuestion;
    attempt.remainingTime = remainingTime;
    attempt.visitedQuestions = visitedQuestions;
    attempt.reviewQuestions = reviewQuestions;
    attempt.questionTimeMap = questionTimeMap;

    await attempt.save();

    res.status(200).json({
      message: "Progress saved"
    }); */
    //--------------------New Block---------------------
    const attempt = await TestAttempt.findOne({
      _id: attemptId,
      userId: req.user.userId,
      status: "IN_PROGRESS"
    });

    if (!attempt) {
      return res.status(404).json({
        message: "Attempt not found"
      });
    }

    await TestAttempt.findByIdAndUpdate(
      attemptId,
      {
        answers,
        currentQuestion,
        remainingTime,
        visitedQuestions,
        reviewQuestions,
        questionTimeMap
      }
    );

    res.status(200).json({
      message: "Progress saved"
    });
    //--------------------------------------------------
  } catch (error) {
    console.error("SAVE PROGRESS ERROR");
    console.error(error);
    res.status(500).json({
      message: error.message
    });
  }
};

//For Charts and Analysis-Graphs
const getPerformanceHistory = async (req, res) => {
  try {
    const attempts = await TestAttempt.find({
      userId: req.user.userId,
      status: "SUBMITTED"
    })
      .populate("mockTestId", "title")
      .sort({ submittedAt: 1 });

    const performance = [];

    for (const attempt of attempts) {
      const betterAttempts =
        await TestAttempt.countDocuments({
          mockTestId: attempt.mockTestId._id,
          status: "SUBMITTED",
          $or: [
            {
              percentage: {
                $gt: attempt.percentage
              }
            },
            {
              percentage:
                attempt.percentage,
              accuracy: {
                $gt: attempt.accuracy
              }
            },
            {
              percentage:
                attempt.percentage,
              accuracy:
                attempt.accuracy,
              submittedAt: {
                $lt: attempt.submittedAt
              }
            }
          ]
        });

      const rank = betterAttempts + 1;

      const totalParticipants =
        await TestAttempt.countDocuments({
          mockTestId:
            attempt.mockTestId._id,
          status: "SUBMITTED"
        });

      const percentile =
        totalParticipants > 0
          ? Number(
              (
                ((totalParticipants -
                  rank + 1) /
                  totalParticipants) *
                100
              ).toFixed(2)
            )
          : 0;

      performance.push({
        attemptId: attempt._id,
        mockTestTitle:
          attempt.mockTestId.title,
        date: attempt.submittedAt,
        score: attempt.score,
        percentage: attempt.percentage,
        accuracy: attempt.accuracy,
        rank,
        totalParticipants,
        percentile
      });
    }

    res.status(200).json({
      performance
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Leader Board
const getStudentLeaderboard = async (req, res) => {
  try {
    const { mockTestId } = req.params;

    const attempts = await TestAttempt.find({
      mockTestId,
      status: "SUBMITTED"
    })
      .populate("userId", "name")
      .sort({
        score: -1,
        totalTimeSpent: 1,
        submittedAt: 1
      });

    const ranked = attempts.map((attempt, index) => ({
      rank: index + 1,
      attemptId: attempt._id,
      studentName: attempt.userId?.name || "Unknown",
      score: attempt.score,
      correct: attempt.correctCount,
      wrong: attempt.wrongCount,
      unattempted: attempt.unattemptedCount,
      accuracy: attempt.accuracy,
      totalTimeSpent: attempt.totalTimeSpent
    }));

    const top10 = ranked.slice(0, 10);

    const myRank =
      ranked.find(
        (r) =>
          r.attemptId.toString() ===
          req.query.attemptId
      ) || null;

    res.json({
      top10,
      myRank
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch leaderboard"
    });
  }
};

//Exports
module.exports = {
  generateMockTest,
  startPremiumMockSession,
  saveProgress,
  submitPremiumMock,
  getAttemptResult,
  getAttemptReview,
  getLeaderboard,
  resumePremiumMockSession,
  getPerformanceHistory,
  getStudentLeaderboard
};
