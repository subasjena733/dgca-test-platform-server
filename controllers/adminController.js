const User = require("../models/User");
const MockTest = require("../models/MockTest");
const TestAttempt = require("../models/TestAttempt");
const mongoose = require("mongoose");

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

const getAdminStudents = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const premium = req.query.premium;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
    const filter = { role: "student" };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } }
      ];
    }
    if (premium === "true" || premium === "false") {
      filter.isPremium = premium === "true";
    }

    const [students, total] = await Promise.all([
      User.find(filter)
        .select("name email isPremium createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({ students, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAdminStudentDetails = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.studentId)) {
      return res.status(400).json({ message: "Invalid student ID." });
    }

    const student = await User.findOne({ _id: req.params.studentId, role: "student" })
      .select("name email isPremium createdAt")
      .lean();
    if (!student) return res.status(404).json({ message: "Student not found." });

    const attempts = await TestAttempt.find({ userId: student._id, status: "SUBMITTED" })
      .select("mockTestId mockTestTitle score correctCount wrongCount unattemptedCount accuracy percentage totalTimeSpent submittedAt")
      .sort({ submittedAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({ student, attempts });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateStudentPremiumStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.studentId)) {
      return res.status(400).json({ message: "Invalid student ID." });
    }
    if (typeof req.body.isPremium !== "boolean") {
      return res.status(400).json({ message: "isPremium must be true or false." });
    }

    const student = await User.findOneAndUpdate(
      { _id: req.params.studentId, role: "student" },
      { $set: { isPremium: req.body.isPremium } },
      { new: true, runValidators: true }
    ).select("name email isPremium createdAt");

    if (!student) return res.status(404).json({ message: "Student not found." });
    return res.status(200).json({ message: "Student premium access updated.", student });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAdminAnalytics,
  getAdminStudents,
  getAdminStudentDetails,
  updateStudentPremiumStatus
};
