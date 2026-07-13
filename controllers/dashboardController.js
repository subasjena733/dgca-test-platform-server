//student Dashboard data

const TestAttempt = require("../models/TestAttempt");
const MockTest = require("../models/MockTest");

const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const availableTests = await MockTest.countDocuments({isPublished: true});

    const attempts = await TestAttempt.find({
      userId,
      status: "SUBMITTED"
    }).sort({ submittedAt: -1 });

    if (attempts.length === 0) {
      return res.json({
        availableTests,
        totalTests: 0,
        averagePercentage: 0,
        averageAccuracy: 0,
        latestPercentage: 0,
        bestPercentage: 0
      });
    }

    const totalTests = attempts.length;

    const totalPercentage = attempts.reduce(
      (sum, attempt) => sum + (attempt.percentage || 0),
      0
    );

    const totalAccuracy = attempts.reduce(
      (sum, attempt) => sum + (attempt.accuracy || 0),
      0
    );

    const averagePercentage = Number(
      (totalPercentage / totalTests).toFixed(2)
    );

    const averageAccuracy = Number(
      (totalAccuracy / totalTests).toFixed(2)
    );

    const latestPercentage = attempts[0].percentage || 0;

    const bestPercentage = Math.max(
      ...attempts.map(attempt => attempt.percentage || 0)
    );

    res.status(200).json({
      availableTests,
      totalTests,
      averagePercentage,
      averageAccuracy,
      latestPercentage,
      bestPercentage
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const getWeakTopics = async (req, res) => {
  try {
    const userId = req.user.userId;

    const attempts = await TestAttempt.find({
      userId,
      status: "SUBMITTED"
    });

    if (attempts.length === 0) {
      return res.json({
        weakTopics: []
      });
    }

    const topicMap = {};

    attempts.forEach(attempt => {
      attempt.topicStats.forEach(topicStat => {
        const topic = topicStat.topic;

        if (!topicMap[topic]) {
          topicMap[topic] = {
            topic,
            correct: 0,
            total: 0
          };
        }

        topicMap[topic].correct += topicStat.correct;
        topicMap[topic].total += topicStat.total;
      });
    });

    const weakTopics = Object.values(topicMap)
      .map(topic => ({
        topic: topic.topic,
        accuracy: Number(
          ((topic.correct / topic.total) * 100).toFixed(2)
        )
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

      res.status(200).json({
        weakTopics
      });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const getTestHistory = async (req, res) => {
  try {
    const userId = req.user.userId;

    const attempts = await TestAttempt.find({
      userId,
      status: "SUBMITTED"
    }).populate("mockTestId", "title").sort({ submittedAt: -1 });

    const history = attempts.map(attempt => ({
      attemptId: attempt._id,
      title: attempt.mockTestId
        ? attempt.mockTestId.title
        : "Deleted Mock Test",
      score: attempt.score,
      percentage: attempt.percentage || 0,
      accuracy: attempt.accuracy || 0,
      submittedAt: attempt.submittedAt
    }));

    res.status(200).json({
      history
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

module.exports = {
  getDashboardSummary,
  getWeakTopics,
  getTestHistory
};