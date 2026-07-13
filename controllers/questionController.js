const Question = require("../models/Question");
const SubjectMaster = require("../models/SubjectMaster");

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
  try {
    const { id } = req.params;

    const oldQuestion = await Question.findById(id);

    if (!oldQuestion) {
      return res.status(404).json({
        message: "Question not found"
      });
    }

    // Mark current version as superseded
    oldQuestion.status = "SUPERSEDED";
    await oldQuestion.save();

    // Create new version
    const newQuestion = await Question.create({
      questionCode: oldQuestion.questionCode,
      version: oldQuestion.version + 1,
      status: "ACTIVE",

      subject: req.body.subject,
      topic: req.body.topic,
      difficulty: req.body.difficulty,
      questionText: req.body.questionText,

      options: req.body.options,

      correctOption: req.body.correctOption,
      explanation: req.body.explanation,

      marks: req.body.marks,
      negativeMarks: req.body.negativeMarks
    });

    res.status(200).json({
      message: "Question updated successfully",
      question: newQuestion
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

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
  deleteQuestion
};