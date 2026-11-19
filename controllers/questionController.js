const Question = require("../models/Question");
const SubjectMaster = require("../models/SubjectMaster");
const TestAttempt = require("../models/TestAttempt");
const mongoose = require("mongoose");

// Add question
const addQuestion = async (req, res) => {
  try {
    const {
      subject,
      topic,
      difficulty,
      questionText,
      options,
      correctOption,
      explanation,
      imageUrl,
      explanationImageUrl,
      solutionVideoUrl,
      marks,
      negativeMarks
    } = req.body;

    // Find Subject
    const subjectMaster = await SubjectMaster.findOne({
      subjectName: subject
    });

    if (!subjectMaster) {
      return res.status(404).json({
        message: "Subject not found."
      });
    }

    // Increment counter
    subjectMaster.questionCounter += 1;

    await subjectMaster.save();

    // Generate Question Code
    const questionCode =
      subjectMaster.subjectPrefix +
      String(subjectMaster.questionCounter).padStart(4, "0");

    const question = await Question.create({
      questionCode,
      subject,
      topic,
      difficulty,
      questionText,
      options,
      correctOption,
      explanation,
      imageUrl,
      explanationImageUrl,
      solutionVideoUrl,
      marks,
      negativeMarks
    });

    res.status(201).json(question);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

// Bulk Add Questions
const bulkAddQuestions = async (req, res) => {
  try {

    const { questions } = req.body;

    if (!questions || questions.length === 0) {
      return res.status(400).json({
        message: "No questions received."
      });
    }

    const insertedQuestions = [];

    for (const q of questions) {

      //----------------------------------
      // Find Subject
      //----------------------------------

      const subjectMaster =
        await SubjectMaster.findOne({
          subjectName: q.subject
        });

      if (!subjectMaster) {
        return res.status(400).json({
          message: `Subject '${q.subject}' not found during import.`
        });
      }

      //----------------------------------
      // Increment Question Counter
      //----------------------------------

      subjectMaster.questionCounter += 1;

      await subjectMaster.save();

      //----------------------------------
      // Generate Question Code
      //----------------------------------

      const questionCode =
        subjectMaster.subjectPrefix +
        String(subjectMaster.questionCounter)
          .padStart(4, "0");

      //----------------------------------
      // Create Question
      //----------------------------------

      const question = await Question.create({

        questionCode,

        subject: q.subject,

        topic: q.topic,

        difficulty: q.difficulty,

        questionText: q.question,

        options: q.options,

        correctOption: q.correctOption,

        explanation: q.explanation,

        imageUrl: q.imageUrl,

        explanationImageUrl: q.explanationImageUrl,

        solutionVideoUrl: q.solutionVideoUrl,

        marks: q.marks,

        negativeMarks: q.negativeMarks

      });

      insertedQuestions.push(question);

    }

    res.status(201).json({

      message:
        `${insertedQuestions.length} Questions Imported Successfully.`,

      count:
        insertedQuestions.length,

      questions:
        insertedQuestions

    });

  }

  catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};

// Get questions by subject / all questions
const getQuestions = async (req, res) => {
  try {

    const { subject } = req.query;

    const filter = {
      status: "ACTIVE",
    };

    if (
      subject &&
      subject !== "ALL"
    ) {
      filter.subject = subject;
    }

    const questions =
      await Question.find(filter);

    res.json(questions);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

//Update Questions
const updateQuestion = async (req, res) => {
  let session;
  try {
    const { id } = req.params;
    const strategy = req.body.editStrategy || "explanation-only";
    const explanationUpdates = {};
    const explanationFields = ["explanation", "explanationImageUrl", "solutionVideoUrl"];

    for (const field of explanationFields) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
      const value = req.body[field];
      if (typeof value !== "string" || value.length > (field === "explanation" ? 10000 : 2048)) {
        return res.status(400).json({ message: `Invalid ${field}.` });
      }
      explanationUpdates[field] = value.trim();
    }

    if (strategy === "explanation-only") {
      if (!Object.keys(explanationUpdates).length) {
        return res.status(400).json({ message: "Provide an explanation, explanation image, or solution video link to update." });
      }
      const question = await Question.findOneAndUpdate(
        { _id: id, status: "ACTIVE" },
        { $set: explanationUpdates },
        { new: true, runValidators: true },
      );
      if (!question) return res.status(404).json({ message: "Active question not found." });

      return res.status(200).json({ message: "Explanation updated successfully.", question });
    }

    if (!["copy-and-supersede", "update-original"].includes(strategy)) {
      return res.status(400).json({ message: "Choose how to apply the advanced question edit." });
    }

    const { subject, topic, difficulty, questionText, options, correctOption, imageUrl, marks, negativeMarks } = req.body;
    if (typeof subject !== "string" || !subject.trim()
      || typeof topic !== "string" || !topic.trim()
      || typeof questionText !== "string" || !questionText.trim() || questionText.length > 10000
      || !["Easy", "Medium", "Hard"].includes(difficulty)
      || !Array.isArray(options) || options.length !== 4
      || !options.every((option, index) => option?.label === ["A", "B", "C", "D"][index] && typeof option.text === "string" && option.text.length <= 2000 && (index >= 2 || option.text.trim().length > 0))
      || !options.some((option) => option.label === correctOption && option.text.trim())
      || !Number.isFinite(Number(marks)) || Number(marks) <= 0
      || !Number.isFinite(Number(negativeMarks)) || Number(negativeMarks) < 0
      || (imageUrl !== undefined && typeof imageUrl !== "string")
      || (typeof imageUrl === "string" && imageUrl.length > 2048)) {
      return res.status(400).json({ message: "Check the subject, question, four options, correct answer, marks, and image URL." });
    }

    const contentUpdates = {
      subject: subject.trim(),
      topic: topic.trim(),
      difficulty,
      questionText: questionText.trim(),
      options: options.map((option) => ({ label: option.label, text: option.text.trim() })),
      correctOption,
      imageUrl: (imageUrl || "").trim(),
      marks: Number(marks),
      negativeMarks: Number(negativeMarks),
      ...explanationUpdates,
    };

    if (strategy === "update-original") {
      const question = await Question.findOneAndUpdate(
        { _id: id, status: "ACTIVE" },
        { $set: contentUpdates },
        { new: true, runValidators: true },
      );
      if (!question) return res.status(404).json({ message: "Active question not found." });

      return res.status(200).json({ message: "Original question updated successfully.", question });
    }

    session = await mongoose.startSession();
    let newQuestion;
    await session.withTransaction(async () => {
      const oldQuestion = await Question.findOne({ _id: id, status: "ACTIVE" }).session(session);
      if (!oldQuestion) {
        const error = new Error("Active question not found.");
        error.statusCode = 404;
        throw error;
      }

      oldQuestion.status = "SUPERSEDED";
      await oldQuestion.save({ session });

      const newQuestionData = { ...contentUpdates };
      for (const field of explanationFields) {
        if (!Object.prototype.hasOwnProperty.call(req.body, field)) {
          newQuestionData[field] = oldQuestion[field] || "";
        }
      }

      [newQuestion] = await Question.create([{
        questionCode: oldQuestion.questionCode,
        version: (oldQuestion.version || 1) + 1,
        status: "ACTIVE",
        ...newQuestionData,
      }], { session });
    });

    res.status(200).json({
      message: "A new question version was created and the previous version was superseded.",
      question: newQuestion
    });

  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message
    });
  } finally {
    if (session) await session.endSession();
  }
};

// Recalculate and persist submitted attempts that used an edited question.
const regradeQuestionAttempts = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    if (!question) return res.status(404).json({ message: "Question not found." });

    const attempts = await TestAttempt.find({
      status: "SUBMITTED",
      questions: question._id
    });

    if (!attempts.length) {
      return res.status(200).json({ message: "No submitted attempts used this question.", regradedCount: 0 });
    }

    const questionIds = [...new Set(attempts.flatMap((attempt) => attempt.questions.map((questionId) => questionId.toString())))];
    const currentQuestions = await Question.find({ _id: { $in: questionIds } });
    const questionsById = new Map(currentQuestions.map((item) => [item._id.toString(), item]));
    const regradedAt = new Date();

    for (const attempt of attempts) {
      let score = 0;
      let correctCount = 0;
      let wrongCount = 0;
      let unattemptedCount = 0;
      let totalPossibleMarks = 0;
      const topicStats = {};
      const difficultyStats = {};
      const answersByQuestionId = new Map(attempt.answers.map((answer) => [answer.questionId.toString(), answer]));

      for (const questionId of attempt.questions) {
        const currentQuestion = questionsById.get(questionId.toString());
        if (!currentQuestion) continue;

        const marks = currentQuestion.marks || 1;
        totalPossibleMarks += marks;
        topicStats[currentQuestion.topic] ||= { topic: currentQuestion.topic, correct: 0, total: 0 };
        difficultyStats[currentQuestion.difficulty] ||= { difficulty: currentQuestion.difficulty, correct: 0, total: 0 };
        topicStats[currentQuestion.topic].total += 1;
        difficultyStats[currentQuestion.difficulty].total += 1;

        const answer = answersByQuestionId.get(questionId.toString());
        if (!answer || answer.selectedOption == null) {
          unattemptedCount += 1;
          continue;
        }

        if (answer.selectedOption === currentQuestion.correctOption) {
          score += marks;
          correctCount += 1;
          topicStats[currentQuestion.topic].correct += 1;
          difficultyStats[currentQuestion.difficulty].correct += 1;
        } else {
          score -= currentQuestion.negativeMarks || 0;
          wrongCount += 1;
        }
      }

      const attemptedCount = correctCount + wrongCount;
      const accuracy = attemptedCount > 0 ? Number(((correctCount / attemptedCount) * 100).toFixed(2)) : 0;
      const percentage = totalPossibleMarks > 0
        ? Number(Math.max(0, (score / totalPossibleMarks) * 100).toFixed(2))
        : 0;

      attempt.regradeHistory.push({
        regradedAt,
        adminId: req.user.userId,
        questionId: question._id,
        questionCode: question.questionCode,
        reason: "Admin requested regrading after updating the original question.",
        previousScore: attempt.score,
        newScore: score,
        previousCorrectCount: attempt.correctCount,
        newCorrectCount: correctCount,
        previousWrongCount: attempt.wrongCount,
        newWrongCount: wrongCount,
        previousAccuracy: attempt.accuracy,
        newAccuracy: accuracy,
        previousPercentage: attempt.percentage,
        newPercentage: percentage
      });
      attempt.score = score;
      attempt.correctCount = correctCount;
      attempt.wrongCount = wrongCount;
      attempt.unattemptedCount = unattemptedCount;
      attempt.accuracy = accuracy;
      attempt.percentage = percentage;
      attempt.topicStats = Object.values(topicStats);
      attempt.difficultyStats = Object.values(difficultyStats);
      await attempt.save();
    }

    return res.status(200).json({
      message: `Regraded ${attempts.length} submitted attempt${attempts.length === 1 ? "" : "s"}.`,
      regradedCount: attempts.length,
      questionCode: question.questionCode
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

//Delete questions
const deleteQuestion = async (req, res) => {

  try {

    const { id } = req.params;

    const question = await Question.findById(id);

    if (!question) {

      return res.status(404).json({
        message: "Question not found"
      });

    }

    question.status = "DELETED";

    await question.save();

    res.status(200).json({
      message: "Question deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

};

module.exports = {
  addQuestion,
  bulkAddQuestions,
  getQuestions,
  updateQuestion,
  regradeQuestionAttempts,
  deleteQuestion
};
