const User = require("../models/User");
const MockTest = require("../models/MockTest");
const TestAttempt = require("../models/TestAttempt");

const getAdminAnalytics = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({
      role: "student"
    });

    const premiumStudents = await User.countDocuments({
      role: "student",
      isPremium: true
    });

    const totalMocks = await MockTest.countDocuments();

    const totalAttempts = await TestAttempt.countDocuments({
      status: "SUBMITTED"
    });

    const attempts = await TestAttempt.find({
      status: "SUBMITTED"
    });

    // Giving number of students appeared for each Mock tests in descending order.
    const mockAttemptMap = {};
    attempts.forEach(attempt => {
      const mockId = attempt.mockTestId.toString();

      mockAttemptMap[mockId] =
        (mockAttemptMap[mockId] || 0) + 1;
    });
    const mockAttemptList = Object.entries(
      mockAttemptMap
    );
    mockAttemptList.sort(
      (a, b) => b[1] - a[1]
    );
    const mockAttemptRanking = [];
    for (const [mockId, attemptsCount] of mockAttemptList) {
      const mock = await MockTest.findById(mockId);

      if (mock) {
        mockAttemptRanking.push({
          title: mock.title,
          attempts: attemptsCount
        });
      }
    }

    //Finding hardest topic from accuracy
    const topicPerformanceMap = {};
    attempts.forEach(attempt => {
      attempt.topicStats.forEach(stat => {

        if (!topicPerformanceMap[stat.topic]) {
          topicPerformanceMap[stat.topic] = {
            correct: 0,
            total: 0
          };
        }

        topicPerformanceMap[stat.topic].correct += stat.correct;
        topicPerformanceMap[stat.topic].total += stat.total;

      });
    });
    let hardestTopic = null;
    let lowestAccuracy = Infinity;

    for (const topic in topicPerformanceMap) {
      const stats = topicPerformanceMap[topic];

      const accuracy =
        stats.total > 0
          ? (stats.correct / stats.total) * 100
          : 0;

      if (accuracy < lowestAccuracy) {
        lowestAccuracy = accuracy;

        hardestTopic = {
          topic,
          accuracy: Number(accuracy.toFixed(2))
        };
      }
    }

    const averagePercentage =
      attempts.length > 0
        ? Number(
            (
              attempts.reduce(
                (sum, attempt) =>
                  sum + (attempt.percentage || 0),
                0
              ) / attempts.length
            ).toFixed(2)
          )
        : 0;

    const averageAccuracy =
      attempts.length > 0
        ? Number(
            (
              attempts.reduce(
                (sum, attempt) =>
                  sum + (attempt.accuracy || 0),
                0
              ) / attempts.length
            ).toFixed(2)
          )
        : 0;

    res.status(200).json({
      totalStudents,
      premiumStudents,
      totalMocks,
      totalAttempts,
      averagePercentage,
      averageAccuracy,
      mockAttemptRanking,
      hardestTopic
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

module.exports = {
  getAdminAnalytics
};