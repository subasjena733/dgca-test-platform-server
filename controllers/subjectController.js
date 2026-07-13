const SubjectMaster = require("../models/SubjectMaster");

// GET ALL SUBJECTS

const getSubjects = async (req, res) => {
  try {

    const subjects = await SubjectMaster.find()
      .sort({ subjectName: 1 });

    res.status(200).json(subjects);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};

// ADD NEW SUBJECT

const addSubject = async (req, res) => {

  try {

    let {
      subjectName,
      subjectPrefix
    } = req.body;

    if (!subjectName || !subjectPrefix) {
      return res.status(400).json({
        message: "Subject Name and Prefix are required."
      });
    }

    subjectName = subjectName.trim();
    subjectPrefix = subjectPrefix.trim().toUpperCase();

    // Check duplicate Subject Name

    const existingSubject =
      await SubjectMaster.findOne({
        subjectName
      });

    if (existingSubject) {
      return res.status(400).json({
        message: "Subject already exists."
      });
    }

    // Check duplicate Prefix

    const existingPrefix =
      await SubjectMaster.findOne({
        subjectPrefix
      });

    if (existingPrefix) {
      return res.status(400).json({
        message: "Subject Prefix already exists."
      });
    }

    // Create Subject

    const newSubject =
      await SubjectMaster.create({
        subjectName,
        subjectPrefix,
        questionCounter: 0
      });

    res.status(201).json({
      message: "Subject created successfully.",
      subject: newSubject
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

module.exports = {
  getSubjects,
  addSubject
};